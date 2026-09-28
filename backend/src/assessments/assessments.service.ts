import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { MailService } from '../mail/mail.service';
import {
  AssessmentSelectionMode,
  AssessmentStatus,
  CandidateStage,
  Difficulty,
  Prisma,
} from '@prisma/client';
import { CreateAssessmentDto } from './dto/create-assessment.dto';
import { UpdateAssessmentDto } from './dto/update-assessment.dto';
import { InviteCandidateDto } from './dto/invite-candidate.dto';
import { UpdateCandidateDecisionDto } from './dto/update-candidate-decision.dto';
import { randomUUID } from 'crypto';
import { parseCandidateCsv } from '../common/csv/parse-candidate-csv';
import { BulkCsvInviteDto } from './dto/bulk-csv-invite.dto';
import { ScreeningService } from '../screening/screening.service';
import { EmailTemplatesService } from '../email-templates/email-templates.service';

// ─── Blueprint / Pool config shapes ─────────────────────────────────────────

interface BlueprintDomain {
  domain: string;
  percentage: number;
}

interface BlueprintConfig {
  totalQuestions: number;
  domains: BlueprintDomain[];
  difficulty?: string;
  certificationId?: string;
}

export interface PoolConfig {
  drawCount: number;
  certificationId?: string;
  difficulty?: string;
  categories?: string[];
  tags?: string[];
}

@Injectable()
export class AssessmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orgsService: OrganizationsService,
    private readonly mailService: MailService,
    private readonly screeningService: ScreeningService,
    private readonly emailTemplatesService: EmailTemplatesService,
  ) {}

  // ─── Private helpers ───────────────────────────────────────────────────────

  /**
   * Shared Prisma `where` clause builder for pool/count queries.
   * Fixes #7: eliminates four copies of identical filter logic.
   * Fix #5: domain matching is case-insensitive via `{ equals: …, mode: 'insensitive' }`.
   */
  private buildPoolWhere(
    orgId: string,
    config: Partial<PoolConfig>,
  ): Prisma.OrgQuestionWhereInput {
    const orClauses: Prisma.OrgQuestionWhereInput[] = config.categories?.length
      ? config.categories.map((c) => ({
          category: { equals: c, mode: 'insensitive' as const },
        }))
      : [];

    return {
      orgId,
      status: 'APPROVED',
      ...(config.difficulty && { difficulty: config.difficulty as Difficulty }),
      ...(config.certificationId && {
        certificationId: config.certificationId,
      }),
      ...(orClauses.length > 0 && { OR: orClauses }),
      ...(config.tags?.length && { tags: { hasSome: config.tags } }),
    };
  }

  /**
   * Build AssessmentQuestion rows for BLUEPRINT mode.
   * Fix #3: single batched query per unique (difficulty, certificationId) instead of N+1.
   * Fix #5: domain (category) matching is case-insensitive.
   */
  private async buildBlueprintQuestions(
    orgId: string,
    config: BlueprintConfig,
  ): Promise<{ orgQuestionId: string; sortOrder: number }[]> {
    const { totalQuestions, domains, difficulty, certificationId } = config;

    if (!domains || domains.length === 0) {
      throw new BadRequestException(
        'Blueprint config must include at least one domain',
      );
    }
    if (totalQuestions < 1) {
      throw new BadRequestException('totalQuestions must be >= 1');
    }

    const totalPct = domains.reduce((s, d) => s + d.percentage, 0);
    if (Math.abs(totalPct - 100) > 1) {
      throw new BadRequestException(
        `Domain percentages must sum to 100 (got ${totalPct})`,
      );
    }

    // Compute per-domain quotas; last domain absorbs rounding remainder
    const quotas: { domain: string; count: number }[] = [];
    let allocated = 0;
    for (let i = 0; i < domains.length; i++) {
      const isLast = i === domains.length - 1;
      const count = isLast
        ? totalQuestions - allocated
        : Math.round((domains[i].percentage / 100) * totalQuestions);
      quotas.push({ domain: domains[i].domain, count });
      allocated += count;
    }

    // Fix #3: one batched query for all needed domains, then partition in memory
    const domainNames = quotas.filter((q) => q.count > 0).map((q) => q.domain);
    const batchWhere: any = {
      orgId,
      status: 'APPROVED',
      // case-insensitive IN via OR
      OR: domainNames.map((d) => ({
        category: { equals: d, mode: 'insensitive' },
      })),
    };
    if (difficulty) batchWhere.difficulty = difficulty;
    if (certificationId) batchWhere.certificationId = certificationId;

    const allRows = await this.prisma.orgQuestion.findMany({
      where: batchWhere,
      select: { id: true, category: true },
    });

    // Group by lowercased category for O(1) lookup
    const byDomain = new Map<string, string[]>();
    for (const row of allRows) {
      const key = (row.category ?? '').toLowerCase();
      if (!byDomain.has(key)) byDomain.set(key, []);
      byDomain.get(key)!.push(row.id);
    }

    const picked: { orgQuestionId: string; sortOrder: number }[] = [];
    let sortOrder = 0;

    for (const { domain, count } of quotas) {
      if (count <= 0) continue;
      const available = byDomain.get(domain.toLowerCase()) ?? [];
      if (available.length < count) {
        throw new BadRequestException(
          `Not enough approved questions in domain "${domain}": need ${count}, found ${available.length}`,
        );
      }
      const shuffled = [...available].sort(() => Math.random() - 0.5);
      for (const id of shuffled.slice(0, count)) {
        picked.push({ orgQuestionId: id, sortOrder: sortOrder++ });
      }
    }

    return picked;
  }

  /**
   * Count APPROVED questions matching a pool filter config.
   * Fix #2/#7: uses shared buildPoolWhere.
   */
  async countPoolQuestions(
    orgId: string,
    config: Partial<PoolConfig>,
  ): Promise<number> {
    return this.prisma.orgQuestion.count({
      where: this.buildPoolWhere(orgId, config),
    });
  }

  /**
   * Draw `drawCount` random OrgQuestion IDs from pool.
   * Fix #2: single query — eliminates separate count + findMany round-trip.
   * Fix #7: uses shared buildPoolWhere.
   * Public — called by CandidateService.
   */
  async drawFromPool(orgId: string, config: PoolConfig): Promise<string[]> {
    const allIds = await this.prisma.orgQuestion.findMany({
      where: this.buildPoolWhere(orgId, config),
      select: { id: true },
    });
    if (allIds.length < config.drawCount) {
      throw new BadRequestException(
        `Not enough approved questions for pool: need ${config.drawCount}, found ${allIds.length}`,
      );
    }
    return [...allIds]
      .sort(() => Math.random() - 0.5)
      .slice(0, config.drawCount)
      .map((q) => q.id);
  }

  // ─── CRUD ──────────────────────────────────────────────────────────────────

  async list(slugOrId: string, page = 1, limit = 20) {
    limit = Math.min(limit, 100);
    const orgId = await this.orgsService.resolveOrgId(slugOrId);
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.assessment.findMany({
        where: { orgId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { candidateInvites: true, questions: true } },
          jobRole: { select: { id: true, title: true, department: true } },
        },
      }),
      this.prisma.assessment.count({ where: { orgId } }),
    ]);

    const ids = data.map((a) => a.id);
    const statRows = await this.prisma.candidateInvite.groupBy({
      by: ['assessmentId'],
      where: { assessmentId: { in: ids }, status: 'SUBMITTED' },
      _avg: { score: true },
      _count: { id: true },
    });
    const statsMap = new Map(statRows.map((r) => [r.assessmentId, r]));
    const enriched = data.map((a) => {
      const stat = statsMap.get(a.id);
      return {
        ...a,
        submittedCount: stat ? stat._count.id : 0,
        avgScore: stat?._avg.score ? Number(stat._avg.score) : null,
      };
    });

    return {
      data: enriched,
      meta: { total, page, limit, lastPage: Math.ceil(total / limit) },
    };
  }

  async create(slugOrId: string, userId: string, dto: CreateAssessmentDto) {
    const orgId = await this.orgsService.resolveOrgId(slugOrId);
    const mode = dto.selectionMode ?? AssessmentSelectionMode.MANUAL;

    return this.prisma.$transaction(async (tx) => {
      // ── BLUEPRINT ──
      if (mode === AssessmentSelectionMode.BLUEPRINT) {
        if (!dto.selectionConfig) {
          throw new BadRequestException(
            'selectionConfig is required for BLUEPRINT mode',
          );
        }
        const config = dto.selectionConfig as BlueprintConfig;
        const questionRows = await this.buildBlueprintQuestions(orgId, config);

        return tx.assessment.create({
          data: {
            orgId,
            title: dto.title,
            description: dto.description,
            jobRoleId: dto.jobRoleId ?? null,
            selectionMode: AssessmentSelectionMode.BLUEPRINT,
            selectionConfig: dto.selectionConfig,
            questionCount: questionRows.length,
            timeLimit: dto.timeLimit,
            passingScore: dto.passingScore,
            randomizeQuestions: dto.randomizeQuestions ?? true,
            randomizeChoices: dto.randomizeChoices ?? true,
            detectTabSwitch: dto.detectTabSwitch ?? false,
            blockCopyPaste: dto.blockCopyPaste ?? false,
            requireFullscreen: dto.requireFullscreen ?? false,
            requireOtp: dto.requireOtp ?? false,
            maxAttempts: dto.maxAttempts ?? 1,
            linkExpiryHours: dto.linkExpiryHours ?? 72,
            createdBy: userId,
            questions: {
              create: questionRows.map((q) => ({
                orgQuestionId: q.orgQuestionId,
                sortOrder: q.sortOrder,
              })),
            },
          },
          include: {
            _count: { select: { questions: true, candidateInvites: true } },
          },
        });
      }

      // ── POOL ──
      if (mode === AssessmentSelectionMode.POOL) {
        if (!dto.selectionConfig) {
          throw new BadRequestException(
            'selectionConfig is required for POOL mode',
          );
        }
        const config = dto.selectionConfig as PoolConfig;
        if (!config.drawCount || config.drawCount < 1) {
          throw new BadRequestException(
            'selectionConfig.drawCount must be >= 1 for POOL mode',
          );
        }
        const available = await this.countPoolQuestions(orgId, config);
        if (available < config.drawCount) {
          throw new BadRequestException(
            `Not enough approved questions for pool: need ${config.drawCount}, found ${available}`,
          );
        }

        return tx.assessment.create({
          data: {
            orgId,
            title: dto.title,
            description: dto.description,
            jobRoleId: dto.jobRoleId ?? null,
            selectionMode: AssessmentSelectionMode.POOL,
            selectionConfig: dto.selectionConfig,
            questionCount: config.drawCount,
            timeLimit: dto.timeLimit,
            passingScore: dto.passingScore,
            randomizeQuestions: dto.randomizeQuestions ?? true,
            randomizeChoices: dto.randomizeChoices ?? true,
            detectTabSwitch: dto.detectTabSwitch ?? false,
            blockCopyPaste: dto.blockCopyPaste ?? false,
            requireFullscreen: dto.requireFullscreen ?? false,
            requireOtp: dto.requireOtp ?? false,
            maxAttempts: dto.maxAttempts ?? 1,
            linkExpiryHours: dto.linkExpiryHours ?? 72,
            createdBy: userId,
            // No AssessmentQuestion rows — drawn per-candidate at startAttempt
          },
          include: {
            _count: { select: { questions: true, candidateInvites: true } },
          },
        });
      }

      // ── MANUAL ──
      const questions = dto.questions ?? [];
      return tx.assessment.create({
        data: {
          orgId,
          title: dto.title,
          description: dto.description,
          jobRoleId: dto.jobRoleId ?? null,
          selectionMode: AssessmentSelectionMode.MANUAL,
          questionCount: questions.length,
          timeLimit: dto.timeLimit,
          passingScore: dto.passingScore,
          randomizeQuestions: dto.randomizeQuestions ?? true,
          randomizeChoices: dto.randomizeChoices ?? true,
          detectTabSwitch: dto.detectTabSwitch ?? false,
          blockCopyPaste: dto.blockCopyPaste ?? false,
          linkExpiryHours: dto.linkExpiryHours ?? 72,
          createdBy: userId,
          questions: {
            create: questions.map((q, i) => ({
              orgQuestionId: q.orgQuestionId ?? null,
              publicQuestionId: q.publicQuestionId ?? null,
              sortOrder: q.sortOrder ?? i,
            })),
          },
        },
        include: {
          _count: { select: { questions: true, candidateInvites: true } },
        },
      });
    });
  }

  async getDetail(slugOrId: string, assessmentId: string) {
    const orgId = await this.orgsService.resolveOrgId(slugOrId);
    const assessment = await this.prisma.assessment.findFirst({
      where: { id: assessmentId, orgId },
      include: {
        questions: {
          orderBy: { sortOrder: 'asc' },
          include: {
            orgQuestion: {
              include: { choices: { orderBy: { sortOrder: 'asc' } } },
            },
            publicQuestion: {
              include: { choices: { orderBy: { sortOrder: 'asc' } } },
            },
          },
        },
        _count: { select: { candidateInvites: true } },
      },
    });
    if (!assessment) throw new NotFoundException('Assessment not found');
    return assessment;
  }

  async update(
    slugOrId: string,
    assessmentId: string,
    dto: UpdateAssessmentDto,
  ) {
    const orgId = await this.orgsService.resolveOrgId(slugOrId);
    const assessment = await this.prisma.assessment.findFirst({
      where: { id: assessmentId, orgId },
    });
    if (!assessment) throw new NotFoundException('Assessment not found');
    if (assessment.status !== AssessmentStatus.DRAFT) {
      throw new BadRequestException('Only DRAFT assessments can be edited');
    }

    // Fix #4: prevent silently changing selection mode after creation
    if (
      dto.selectionMode !== undefined &&
      dto.selectionMode !== assessment.selectionMode
    ) {
      throw new BadRequestException(
        `Cannot change selectionMode from ${assessment.selectionMode} to ${dto.selectionMode} after creation`,
      );
    }

    const mode = assessment.selectionMode as AssessmentSelectionMode;

    return this.prisma.$transaction(async (tx) => {
      // ── BLUEPRINT: rebuild question list ──
      if (mode === AssessmentSelectionMode.BLUEPRINT) {
        const config = (dto.selectionConfig ??
          assessment.selectionConfig) as BlueprintConfig;
        if (!config) {
          throw new BadRequestException(
            'selectionConfig is required for BLUEPRINT mode',
          );
        }
        const questionRows = await this.buildBlueprintQuestions(orgId, config);

        await tx.assessmentQuestion.deleteMany({ where: { assessmentId } });
        await tx.assessmentQuestion.createMany({
          data: questionRows.map((q) => ({
            assessmentId,
            orgQuestionId: q.orgQuestionId,
            sortOrder: q.sortOrder,
          })),
        });

        return tx.assessment.update({
          where: { id: assessmentId },
          data: {
            ...(dto.title !== undefined && { title: dto.title }),
            ...(dto.description !== undefined && {
              description: dto.description,
            }),
            ...(dto.timeLimit !== undefined && { timeLimit: dto.timeLimit }),
            ...(dto.passingScore !== undefined && {
              passingScore: dto.passingScore,
            }),
            ...(dto.randomizeQuestions !== undefined && {
              randomizeQuestions: dto.randomizeQuestions,
            }),
            ...(dto.randomizeChoices !== undefined && {
              randomizeChoices: dto.randomizeChoices,
            }),
            ...(dto.detectTabSwitch !== undefined && {
              detectTabSwitch: dto.detectTabSwitch,
            }),
            ...(dto.blockCopyPaste !== undefined && {
              blockCopyPaste: dto.blockCopyPaste,
            }),
            ...(dto.requireFullscreen !== undefined && {
              requireFullscreen: dto.requireFullscreen,
            }),
            ...(dto.requireOtp !== undefined && { requireOtp: dto.requireOtp }),
            ...(dto.maxAttempts !== undefined && {
              maxAttempts: dto.maxAttempts,
            }),
            ...(dto.linkExpiryHours !== undefined && {
              linkExpiryHours: dto.linkExpiryHours,
            }),
            selectionMode: AssessmentSelectionMode.BLUEPRINT,
            selectionConfig: (dto.selectionConfig ??
              assessment.selectionConfig) as any,
            questionCount: questionRows.length,
          },
          include: {
            _count: { select: { questions: true, candidateInvites: true } },
          },
        });
      }

      // ── POOL: update config ──
      if (mode === AssessmentSelectionMode.POOL) {
        const config = (dto.selectionConfig ??
          assessment.selectionConfig) as PoolConfig;
        if (!config?.drawCount) {
          throw new BadRequestException(
            'selectionConfig.drawCount is required for POOL mode',
          );
        }
        const available = await this.countPoolQuestions(orgId, config);
        if (available < config.drawCount) {
          throw new BadRequestException(
            `Not enough approved questions for pool: need ${config.drawCount}, found ${available}`,
          );
        }
        await tx.assessmentQuestion.deleteMany({ where: { assessmentId } });

        return tx.assessment.update({
          where: { id: assessmentId },
          data: {
            ...(dto.title !== undefined && { title: dto.title }),
            ...(dto.description !== undefined && {
              description: dto.description,
            }),
            ...(dto.timeLimit !== undefined && { timeLimit: dto.timeLimit }),
            ...(dto.passingScore !== undefined && {
              passingScore: dto.passingScore,
            }),
            ...(dto.randomizeQuestions !== undefined && {
              randomizeQuestions: dto.randomizeQuestions,
            }),
            ...(dto.randomizeChoices !== undefined && {
              randomizeChoices: dto.randomizeChoices,
            }),
            ...(dto.detectTabSwitch !== undefined && {
              detectTabSwitch: dto.detectTabSwitch,
            }),
            ...(dto.blockCopyPaste !== undefined && {
              blockCopyPaste: dto.blockCopyPaste,
            }),
            ...(dto.requireFullscreen !== undefined && {
              requireFullscreen: dto.requireFullscreen,
            }),
            ...(dto.requireOtp !== undefined && { requireOtp: dto.requireOtp }),
            ...(dto.maxAttempts !== undefined && {
              maxAttempts: dto.maxAttempts,
            }),
            ...(dto.linkExpiryHours !== undefined && {
              linkExpiryHours: dto.linkExpiryHours,
            }),
            selectionMode: AssessmentSelectionMode.POOL,
            selectionConfig: (dto.selectionConfig ??
              assessment.selectionConfig) as any,
            questionCount: config.drawCount,
          },
          include: {
            _count: { select: { questions: true, candidateInvites: true } },
          },
        });
      }

      // ── MANUAL ──
      if (dto.questions !== undefined) {
        await tx.assessmentQuestion.deleteMany({ where: { assessmentId } });
        if (dto.questions.length > 0) {
          await tx.assessmentQuestion.createMany({
            data: dto.questions.map((q, i) => ({
              assessmentId,
              orgQuestionId: q.orgQuestionId ?? null,
              publicQuestionId: q.publicQuestionId ?? null,
              sortOrder: q.sortOrder ?? i,
            })),
          });
        }
      }

      return tx.assessment.update({
        where: { id: assessmentId },
        data: {
          ...(dto.title !== undefined && { title: dto.title }),
          ...(dto.description !== undefined && {
            description: dto.description,
          }),
          ...(dto.timeLimit !== undefined && { timeLimit: dto.timeLimit }),
          ...(dto.passingScore !== undefined && {
            passingScore: dto.passingScore,
          }),
          ...(dto.randomizeQuestions !== undefined && {
            randomizeQuestions: dto.randomizeQuestions,
          }),
          ...(dto.randomizeChoices !== undefined && {
            randomizeChoices: dto.randomizeChoices,
          }),
          ...(dto.detectTabSwitch !== undefined && {
            detectTabSwitch: dto.detectTabSwitch,
          }),
          ...(dto.blockCopyPaste !== undefined && {
            blockCopyPaste: dto.blockCopyPaste,
          }),
          ...(dto.linkExpiryHours !== undefined && {
            linkExpiryHours: dto.linkExpiryHours,
          }),
          selectionMode: AssessmentSelectionMode.MANUAL,
          selectionConfig: Prisma.JsonNull,
          ...(dto.questions !== undefined && {
            questionCount: dto.questions.length,
          }),
        },
        include: {
          _count: { select: { questions: true, candidateInvites: true } },
        },
      });
    });
  }

  async updateStatus(
    slugOrId: string,
    assessmentId: string,
    status: AssessmentStatus,
  ) {
    const orgId = await this.orgsService.resolveOrgId(slugOrId);
    const assessment = await this.prisma.assessment.findFirst({
      where: { id: assessmentId, orgId },
      include: { _count: { select: { questions: true } } },
    });
    if (!assessment) throw new NotFoundException('Assessment not found');

    if (status === AssessmentStatus.ACTIVE) {
      const isPool = assessment.selectionMode === AssessmentSelectionMode.POOL;
      const hasQuestions = isPool
        ? (assessment.selectionConfig as any)?.drawCount > 0
        : assessment._count.questions > 0;

      if (!hasQuestions) {
        throw new BadRequestException(
          'Cannot activate assessment with no questions',
        );
      }
    }

    return this.prisma.assessment.update({
      where: { id: assessmentId },
      data: { status },
    });
  }

  async inviteCandidates(
    slugOrId: string,
    assessmentId: string,
    dto: InviteCandidateDto,
  ) {
    const orgId = await this.orgsService.resolveOrgId(slugOrId);
    const assessment = await this.prisma.assessment.findFirst({
      where: { id: assessmentId, orgId },
    });
    if (!assessment) throw new NotFoundException('Assessment not found');
    if (assessment.status !== AssessmentStatus.ACTIVE) {
      throw new BadRequestException(
        'Assessment must be ACTIVE to invite candidates',
      );
    }

    const invites = await this.prisma.$transaction(
      dto.candidates.map((c) => {
        const token = randomUUID();
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + assessment.linkExpiryHours);
        return this.prisma.candidateInvite.create({
          data: {
            assessmentId,
            candidateEmail: c.email,
            candidateName: c.name ?? null,
            token,
            expiresAt,
          },
        });
      }),
    );

    for (const invite of invites) {
      this.mailService.sendAssessmentInvite(
        invite.candidateEmail,
        invite.candidateName ?? '',
        assessment.title,
        invite.token,
        invite.expiresAt,
      );
    }

    return { invited: invites.length, invites };
  }

  async getResults(
    slugOrId: string,
    assessmentId: string,
    filter?: string,
    viewerRole?: string,
  ) {
    const orgId = await this.orgsService.resolveOrgId(slugOrId);
    const assessment = await this.prisma.assessment.findFirst({
      where: { id: assessmentId, orgId },
      include: { jobRole: true },
    });
    if (!assessment) throw new NotFoundException('Assessment not found');

    const inviteWhere: Record<string, unknown> = { assessmentId };
    if (
      filter === 'submitted' ||
      filter === 'passed' ||
      filter === 'shortlisted'
    ) {
      inviteWhere['status'] = 'SUBMITTED';
    }
    if (filter === 'shortlisted') {
      inviteWhere['stage'] = 'SHORTLISTED';
    }
    let invites = await this.prisma.candidateInvite.findMany({
      where: inviteWhere,
      orderBy: [{ score: 'desc' }, { createdAt: 'asc' }],
    });
    if (filter === 'passed' && assessment.passingScore != null) {
      invites = invites.filter(
        (i) => i.score != null && Number(i.score) >= assessment.passingScore!,
      );
    }

    // US-G3: Blind review masking — OWNER/ADMIN always see full identity
    const isPrivileged = viewerRole === 'OWNER' || viewerRole === 'ADMIN';
    const decidedStages = new Set([
      'SHORTLISTED',
      'INTERVIEW',
      'HIRED',
      'REJECTED',
    ]);
    const shouldBlind = assessment.blindReviewEnabled && !isPrivileged;

    // Compute percentile rank for each submitted candidate
    const submitted = invites.filter((i) => i.status === 'SUBMITTED');
    const submittedCount = submitted.length;
    const candidates = invites.map((invite) => {
      const withPercentile =
        invite.status !== 'SUBMITTED' || invite.score == null
          ? { ...invite, percentile: null }
          : (() => {
              const score = Number(invite.score);
              const below = submitted.filter(
                (s) => s.score != null && Number(s.score) < score,
              ).length;
              const percentile =
                submittedCount > 1
                  ? Math.round((below / (submittedCount - 1)) * 100)
                  : 100;
              return { ...invite, percentile };
            })();

      // US-G3: mask PII; use stable ID suffix so identity is consistent across sessions
      if (shouldBlind && !decidedStages.has(invite.stage as string)) {
        return {
          ...withPercentile,
          candidateName: null,
          candidateEmail: `Cand-${invite.id.slice(-6).toUpperCase()}`,
        };
      }
      return withPercentile;
    });

    const total = invites.length;
    const started = invites.filter((i) => i.status !== 'INVITED').length;
    const passed =
      assessment.passingScore != null
        ? submitted.filter(
            (i) =>
              i.score != null && Number(i.score) >= assessment.passingScore!,
          ).length
        : null;

    return {
      assessment,
      funnel: { total, started, submitted: submittedCount, passed },
      candidates,
    };
  }

  // US-G3: Blind review toggle — allowed on DRAFT and ACTIVE, not CLOSED
  async updateBlindReview(
    slugOrId: string,
    assessmentId: string,
    blindReviewEnabled: boolean,
  ) {
    const orgId = await this.orgsService.resolveOrgId(slugOrId);
    const assessment = await this.prisma.assessment.findFirst({
      where: { id: assessmentId, orgId },
    });
    if (!assessment) throw new NotFoundException('Assessment not found');
    if (assessment.status === 'CLOSED') {
      throw new BadRequestException(
        'Cannot change blind review setting on a closed assessment',
      );
    }
    return this.prisma.assessment.update({
      where: { id: assessmentId },
      data: { blindReviewEnabled },
    });
  }

  // US-G3: Reveal candidate identity (OWNER/ADMIN only) — writes audit log
  async revealCandidateIdentity(
    slugOrId: string,
    assessmentId: string,
    inviteId: string,
    requesterId: string,
  ) {
    const orgId = await this.orgsService.resolveOrgId(slugOrId);
    const invite = await this.prisma.candidateInvite.findFirst({
      where: { id: inviteId, assessment: { id: assessmentId, orgId } },
      select: {
        id: true,
        candidateName: true,
        candidateEmail: true,
        stage: true,
      },
    });
    if (!invite) throw new NotFoundException('Candidate invite not found');

    await this.prisma.auditLog.create({
      data: {
        userId: requesterId,
        action: 'candidate_identity_revealed',
        targetType: 'CandidateInvite',
        targetId: inviteId,
        metadata: { inviteId, revealedBy: requesterId },
      },
    });

    return {
      candidateName: invite.candidateName,
      candidateEmail: invite.candidateEmail,
      stage: invite.stage,
    };
  }

  // US-G2: Mark invite for data erasure — job will anonymise within 24h
  async requestDeletion(
    slugOrId: string,
    assessmentId: string,
    inviteId: string,
    requesterId: string,
  ) {
    const orgId = await this.orgsService.resolveOrgId(slugOrId);
    const invite = await this.prisma.candidateInvite.findFirst({
      where: { id: inviteId, assessment: { id: assessmentId, orgId } },
    });
    if (!invite) throw new NotFoundException('Candidate invite not found');

    await this.prisma.candidateInvite.update({
      where: { id: inviteId },
      data: { deleteRequestedAt: new Date() },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: requesterId,
        action: 'candidate_deletion_requested',
        targetType: 'CandidateInvite',
        targetId: inviteId,
        metadata: { requestedBy: requesterId },
      },
    });

    return {
      message: 'Deletion scheduled — PII will be anonymised within 24 hours',
    };
  }

  async updateCandidateDecision(
    slugOrId: string,
    assessmentId: string,
    inviteId: string,
    dto: UpdateCandidateDecisionDto,
    decidedByUserId: string,
  ) {
    const orgId = await this.orgsService.resolveOrgId(slugOrId);
    const assessment = await this.prisma.assessment.findFirst({
      where: { id: assessmentId, orgId },
    });
    if (!assessment) throw new NotFoundException('Assessment not found');

    const invite = await this.prisma.candidateInvite.findFirst({
      where: { id: inviteId, assessmentId },
    });
    if (!invite) throw new NotFoundException('Candidate invite not found');

    // US-F2: Validate stage transitions
    if (dto.stage !== undefined && dto.stage !== invite.stage) {
      const validTransitions: Partial<Record<string, string[]>> = {
        APPLIED: ['SCREENING', 'SHORTLISTED', 'REJECTED'],
        SCREENING: ['SHORTLISTED', 'REJECTED'],
        SHORTLISTED: ['INTERVIEW', 'HIRED', 'REJECTED'],
        INTERVIEW: ['HIRED', 'REJECTED'],
      };
      const allowed = validTransitions[invite.stage as string] ?? [];
      if (!allowed.includes(dto.stage as string)) {
        throw new BadRequestException(
          `Invalid stage transition: ${invite.stage} → ${dto.stage}`,
        );
      }
    }

    // US-F2: Require interviewScheduledAt when moving to INTERVIEW
    if (dto.stage === CandidateStage.INTERVIEW && !dto.interviewScheduledAt) {
      throw new BadRequestException(
        'interviewScheduledAt is required when moving to INTERVIEW stage',
      );
    }

    const isStageDecision =
      dto.stage === CandidateStage.HIRED ||
      dto.stage === CandidateStage.REJECTED ||
      dto.stage === CandidateStage.SHORTLISTED;

    const data: Record<string, any> = {
      ...(dto.stage !== undefined && { stage: dto.stage }),
      ...(dto.rating !== undefined && { rating: dto.rating }),
      ...(dto.recruiterNote !== undefined && {
        recruiterNote: dto.recruiterNote,
      }),
      ...(isStageDecision && {
        decidedBy: decidedByUserId,
        decidedAt: new Date(),
      }),
      ...(dto.stage === CandidateStage.INTERVIEW &&
        dto.interviewScheduledAt && {
          interviewScheduledAt: new Date(dto.interviewScheduledAt),
        }),
    };

    // No-op guard — avoid hitting the DB if nothing changed
    if (Object.keys(data).length === 0) return invite;

    const updated = await this.prisma.candidateInvite.update({
      where: { id: inviteId },
      data,
    });

    if (
      (isStageDecision || dto.stage === CandidateStage.INTERVIEW) &&
      dto.stage
    ) {
      await this.screeningService.writeManualDecisionLog(
        inviteId,
        invite.stage,
        dto.stage,
        decidedByUserId,
        dto.recruiterNote,
      );

      // US-C3: fire-and-forget stage email — do not await to avoid blocking response
      this.emailTemplatesService
        .sendForStage({ orgId: slugOrId, inviteId, toStage: dto.stage })
        .catch(() => undefined);
    }

    return updated;
  }

  async exportCsv(
    slugOrId: string,
    assessmentId: string,
    filter?: string,
  ): Promise<string> {
    const results = await this.getResults(slugOrId, assessmentId, filter);
    const header =
      'Name,Email,Attempt Status,Stage,Score (%),Percentile,Total Correct,Total Questions,Rating,Time Spent (s),Tab Switches,Started At,Submitted At,Recruiter Note';
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const rows = results.candidates.map((c) =>
      [
        esc(c.candidateName ?? ''),
        esc(c.candidateEmail),
        c.status,
        c.stage ?? 'APPLIED',
        c.score != null ? Number(c.score).toFixed(2) : '',
        c.percentile != null ? c.percentile : '',
        c.totalCorrect ?? '',
        c.totalQuestions ?? '',
        c.rating ?? '',
        c.timeSpent ?? '',
        c.tabSwitchCount ?? 0,
        c.startedAt?.toISOString() ?? '',
        c.submittedAt?.toISOString() ?? '',
        esc(c.recruiterNote ?? ''),
      ].join(','),
    );
    return [header, ...rows].join('\n');
  }

  async delete(slugOrId: string, assessmentId: string) {
    const orgId = await this.orgsService.resolveOrgId(slugOrId);
    return this.prisma.assessment.delete({
      where: { id: assessmentId, orgId },
    });
  }

  // ── US-C1: Bulk CSV Invite ─────────────────────────────────────────────────

  async bulkCsvInvite(
    slugOrId: string,
    assessmentId: string,
    dto: BulkCsvInviteDto,
  ): Promise<{
    created: number;
    skipped: number;
    errors: { row: number; email: string; reason: string }[];
  }> {
    const orgId = await this.orgsService.resolveOrgId(slugOrId);
    const assessment = await this.prisma.assessment.findFirst({
      where: { id: assessmentId, orgId },
    });
    if (!assessment) throw new NotFoundException('Assessment not found');
    if (assessment.status !== AssessmentStatus.ACTIVE) {
      throw new BadRequestException(
        'Assessment must be ACTIVE to invite candidates',
      );
    }

    const { valid, invalid } = parseCandidateCsv(dto.csv);
    const errors: { row: number; email: string; reason: string }[] =
      invalid.map((e: { row: number; raw: string; reason: string }) => ({
        row: e.row,
        email: e.raw,
        reason: e.reason,
      }));

    if (valid.length === 0) return { created: 0, skipped: 0, errors };

    const emails = valid.map((r: { email: string; name?: string }) => r.email);
    const existing = await this.prisma.candidateInvite.findMany({
      where: { assessmentId, candidateEmail: { in: emails } },
      select: { candidateEmail: true },
    });
    const existingSet = new Set(existing.map((e) => e.candidateEmail));

    const toCreate = valid.filter(
      (r: { email: string; name?: string }) => !existingSet.has(r.email),
    );
    const skipped = valid.length - toCreate.length;

    if (toCreate.length > 0) {
      await this.prisma.candidateInvite.createMany({
        data: toCreate.map((r: { email: string; name?: string }) => ({
          assessmentId,
          candidateEmail: r.email,
          candidateName: r.name ?? null,
          token: randomUUID() as string,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        })),
        skipDuplicates: true,
      });
    }

    return { created: toCreate.length, skipped, errors };
  }

  // ─── Pool count (preview for UI) ───────────────────────────────────────────

  async getPoolCount(
    slugOrId: string,
    config: Partial<PoolConfig>,
  ): Promise<{ available: number }> {
    const orgId = await this.orgsService.resolveOrgId(slugOrId);
    const available = await this.countPoolQuestions(orgId, config);
    return { available };
  }

  // ─── US-D1: Pool stats ─────────────────────────────────────────────────────

  async getPoolStats(slugOrId: string, assessmentId: string) {
    const orgId = await this.orgsService.resolveOrgId(slugOrId);

    const assessment = await this.prisma.assessment.findFirst({
      where: { id: assessmentId, orgId },
      select: {
        id: true,
        selectionMode: true,
        selectionConfig: true,
        questionCount: true,
        _count: { select: { questions: true } },
      },
    });
    if (!assessment) throw new NotFoundException('Assessment not found');

    const poolConfig =
      (assessment.selectionConfig as Partial<PoolConfig>) ?? {};
    const poolSize = await this.countPoolQuestions(orgId, poolConfig);
    const drawCount = assessment.questionCount ?? assessment._count.questions;

    const usageStats = await this.prisma.candidateAnswer.groupBy({
      by: ['questionId'],
      where: {
        invite: { assessmentId },
      },
      _count: { questionId: true },
      orderBy: { _count: { questionId: 'asc' } },
    });

    const leastUsed = usageStats.slice(0, 10).map((s) => ({
      questionId: s.questionId,
      usedCount: s._count.questionId,
    }));

    const overlapPct =
      poolSize > 0 ? Math.round((drawCount / poolSize) * 100) : 100;

    return {
      assessmentId,
      selectionMode: assessment.selectionMode,
      poolSize,
      drawCount,
      overlapPct,
      uniqueQuestionRatio:
        poolSize > 0 ? Math.round((1 - drawCount / poolSize) * 100) : 0,
      leastUsedQuestions: leastUsed,
    };
  }

  async getPoolInfo(slugOrId: string, assessmentId: string) {
    const orgId = await this.orgsService.resolveOrgId(slugOrId);

    const assessment = await this.prisma.assessment.findFirst({
      where: { id: assessmentId, orgId },
      select: {
        selectionMode: true,
        selectionConfig: true,
        questionCount: true,
      },
    });
    if (!assessment) throw new NotFoundException('Assessment not found');

    const poolConfig =
      (assessment.selectionConfig as Partial<PoolConfig>) ?? {};
    const available = await this.countPoolQuestions(orgId, poolConfig);

    return {
      assessmentId,
      selectionMode: assessment.selectionMode,
      selectionConfig: poolConfig,
      questionCount: assessment.questionCount,
      poolAvailable: available,
    };
  }

  // ─── US-D2: Risk config ────────────────────────────────────────────────────

  async updateRiskConfig(
    slugOrId: string,
    assessmentId: string,
    dto: { riskThreshold?: number; autoFlagRisk?: boolean },
  ) {
    const orgId = await this.orgsService.resolveOrgId(slugOrId);
    const assessment = await this.prisma.assessment.findFirst({
      where: { id: assessmentId, orgId },
    });
    if (!assessment) throw new NotFoundException('Assessment not found');

    return this.prisma.assessment.update({
      where: { id: assessmentId },
      data: {
        ...(dto.riskThreshold !== undefined && {
          riskThreshold: dto.riskThreshold,
        }),
        ...(dto.autoFlagRisk !== undefined && {
          autoFlagRisk: dto.autoFlagRisk,
        }),
      },
      select: { id: true, riskThreshold: true, autoFlagRisk: true },
    });
  }
}
