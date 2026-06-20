import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { CandidateStage } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { CreateScreeningRuleDto } from './dto/create-screening-rule.dto';
import { UpdateScreeningRuleDto } from './dto/update-screening-rule.dto';

const SYSTEM_USER_ID = 'system';

@Injectable()
export class ScreeningService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orgsService: OrganizationsService,
  ) {}

  // ── CRUD ──────────────────────────────────────────────────────────────────

  async listRules(slugOrId: string, assessmentId: string) {
    const orgId = await this.orgsService.resolveOrgId(slugOrId);
    await this.assertAssessmentInOrg(orgId, assessmentId);
    return this.prisma.screeningRule.findMany({
      where: { assessmentId },
      orderBy: { priority: 'desc' },
    });
  }

  async createRule(
    slugOrId: string,
    assessmentId: string,
    dto: CreateScreeningRuleDto,
  ) {
    const orgId = await this.orgsService.resolveOrgId(slugOrId);
    await this.assertAssessmentInOrg(orgId, assessmentId);
    this.validateRuleConditions(dto);
    return this.prisma.screeningRule.create({
      data: {
        orgId,
        assessmentId,
        action: dto.action,
        minScore: dto.minScore ?? null,
        maxScore: dto.maxScore ?? null,
        minIntegrity: dto.minIntegrity ?? null,
        minDomainScores: dto.minDomainScores ?? undefined,
        priority: dto.priority ?? 0,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async updateRule(
    slugOrId: string,
    assessmentId: string,
    ruleId: string,
    dto: UpdateScreeningRuleDto,
  ) {
    const orgId = await this.orgsService.resolveOrgId(slugOrId);
    const rule = await this.prisma.screeningRule.findFirst({
      where: { id: ruleId, assessmentId, orgId },
    });
    if (!rule) throw new NotFoundException('Screening rule not found');
    this.validateRuleConditions({
      minScore:
        dto.minScore !== undefined
          ? dto.minScore
          : rule.minScore !== null
            ? Number(rule.minScore)
            : undefined,
      maxScore:
        dto.maxScore !== undefined
          ? dto.maxScore
          : rule.maxScore !== null
            ? Number(rule.maxScore)
            : undefined,
    });
    return this.prisma.screeningRule.update({
      where: { id: ruleId },
      data: {
        ...(dto.action !== undefined && { action: dto.action }),
        ...(dto.minScore !== undefined && { minScore: dto.minScore }),
        ...(dto.maxScore !== undefined && { maxScore: dto.maxScore }),
        ...(dto.minIntegrity !== undefined && {
          minIntegrity: dto.minIntegrity,
        }),
        ...(dto.minDomainScores !== undefined && {
          minDomainScores: dto.minDomainScores,
        }),
        ...(dto.priority !== undefined && { priority: dto.priority }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  async deleteRule(slugOrId: string, assessmentId: string, ruleId: string) {
    const orgId = await this.orgsService.resolveOrgId(slugOrId);
    const rule = await this.prisma.screeningRule.findFirst({
      where: { id: ruleId, assessmentId, orgId },
    });
    if (!rule) throw new NotFoundException('Screening rule not found');
    await this.prisma.screeningRule.delete({ where: { id: ruleId } });
  }

  async getDecisionLog(
    slugOrId: string,
    assessmentId: string,
    inviteId: string,
  ) {
    const orgId = await this.orgsService.resolveOrgId(slugOrId);
    await this.assertAssessmentInOrg(orgId, assessmentId);
    const invite = await this.prisma.candidateInvite.findFirst({
      where: { id: inviteId, assessmentId },
    });
    if (!invite) throw new NotFoundException('Invite not found');
    return this.prisma.decisionLog.findMany({
      where: { inviteId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ── Auto-screening engine ─────────────────────────────────────────────────

  async evaluate(inviteId: string): Promise<void> {
    const invite = await this.prisma.candidateInvite.findUnique({
      where: { id: inviteId },
      select: {
        id: true,
        assessmentId: true,
        stage: true,
        score: true,
        integrityScore: true,
        domainScores: true,
      },
    });
    if (!invite || invite.stage !== CandidateStage.APPLIED) return;

    const rules = await this.prisma.screeningRule.findMany({
      where: { assessmentId: invite.assessmentId, isActive: true },
      orderBy: { priority: 'desc' },
    });

    for (const rule of rules) {
      if (!this.ruleMatches(rule, invite)) continue;

      const toStage =
        rule.action === 'SHORTLIST'
          ? CandidateStage.SHORTLISTED
          : CandidateStage.REJECTED;

      await this.prisma.$transaction([
        this.prisma.candidateInvite.update({
          where: { id: inviteId },
          data: { stage: toStage },
        }),
        this.prisma.decisionLog.create({
          data: {
            inviteId,
            fromStage: invite.stage,
            toStage,
            decidedBy: SYSTEM_USER_ID,
            ruleId: rule.id,
            ruleSnapshot: { ...rule },
            scoreSnapshot: {
              score: invite.score,
              integrityScore: invite.integrityScore,
              domainScores: invite.domainScores,
            },
          },
        }),
      ]);
      return;
    }
  }

  async writeManualDecisionLog(
    inviteId: string,
    fromStage: string | null,
    toStage: string,
    decidedBy: string,
    note?: string,
  ): Promise<void> {
    const invite = await this.prisma.candidateInvite.findUnique({
      where: { id: inviteId },
      select: { score: true, integrityScore: true, domainScores: true },
    });
    if (!invite) return;

    await this.prisma.decisionLog.create({
      data: {
        inviteId,
        fromStage: fromStage ?? undefined,
        toStage,
        decidedBy,
        scoreSnapshot: {
          score: invite.score,
          integrityScore: invite.integrityScore,
          domainScores: invite.domainScores,
        },
        note: note ?? undefined,
      },
    });
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private ruleMatches(
    rule: {
      minScore: any;
      maxScore: any;
      minIntegrity: any;
      minDomainScores: any;
    },
    invite: {
      score: any;
      integrityScore: any;
      domainScores: any;
    },
  ): boolean {
    const score = Number(invite.score ?? 0);
    const integrity = invite.integrityScore ?? 100;

    if (rule.minScore !== null && score < Number(rule.minScore)) return false;
    if (rule.maxScore !== null && score > Number(rule.maxScore)) return false;
    if (rule.minIntegrity !== null && integrity < rule.minIntegrity)
      return false;

    if (rule.minDomainScores && typeof rule.minDomainScores === 'object') {
      const domainScores = invite.domainScores as Record<
        string,
        { correct: number; total: number }
      > | null;
      for (const [domain, minPct] of Object.entries(
        rule.minDomainScores as Record<string, number>,
      )) {
        const ds = domainScores?.[domain];
        if (!ds) return false;
        const pct = ds.total > 0 ? (ds.correct / ds.total) * 100 : 0;
        if (pct < minPct) return false;
      }
    }

    return true;
  }

  private validateRuleConditions(dto: { minScore?: any; maxScore?: any }) {
    if (
      dto.minScore !== undefined &&
      dto.maxScore !== undefined &&
      Number(dto.minScore) > Number(dto.maxScore)
    ) {
      throw new BadRequestException('minScore cannot exceed maxScore');
    }
  }

  private async assertAssessmentInOrg(orgId: string, assessmentId: string) {
    const assessment = await this.prisma.assessment.findFirst({
      where: { id: assessmentId, orgId },
    });
    if (!assessment) throw new NotFoundException('Assessment not found');
  }
}
