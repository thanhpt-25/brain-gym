import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { MailService } from '../mail/mail.service';
import { AssessmentStatus } from '@prisma/client';
import { CreateAssessmentDto } from './dto/create-assessment.dto';
import { UpdateAssessmentDto } from './dto/update-assessment.dto';
import { InviteCandidateDto } from './dto/invite-candidate.dto';
import { randomUUID } from 'crypto';

@Injectable()
export class AssessmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orgsService: OrganizationsService,
    private readonly mailService: MailService,
  ) {}

  async list(slugOrId: string, page = 1, limit = 20) {
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
        },
      }),
      this.prisma.assessment.count({ where: { orgId } }),
    ]);

    // Enrich with aggregated candidate stats
    const enriched = await Promise.all(
      data.map(async (a) => {
        const stats = await this.prisma.candidateInvite.aggregate({
          where: { assessmentId: a.id, status: 'SUBMITTED' },
          _avg: { score: true },
          _count: { id: true },
        });
        return {
          ...a,
          submittedCount: stats._count.id,
          avgScore: stats._avg.score ? Number(stats._avg.score) : null,
        };
      }),
    );

    return {
      data: enriched,
      meta: { total, page, limit, lastPage: Math.ceil(total / limit) },
    };
  }

  async create(slugOrId: string, userId: string, dto: CreateAssessmentDto) {
    const orgId = await this.orgsService.resolveOrgId(slugOrId);

    return this.prisma.$transaction(async (tx) => {
      const assessment = await tx.assessment.create({
        data: {
          orgId,
          title: dto.title,
          description: dto.description,
          questionCount: dto.questions.length,
          timeLimit: dto.timeLimit,
          passingScore: dto.passingScore,
          randomizeQuestions: dto.randomizeQuestions ?? true,
          randomizeChoices: dto.randomizeChoices ?? true,
          detectTabSwitch: dto.detectTabSwitch ?? false,
          blockCopyPaste: dto.blockCopyPaste ?? false,
          linkExpiryHours: dto.linkExpiryHours ?? 72,
          createdBy: userId,
          questions: {
            create: dto.questions.map((q, i) => ({
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
      return assessment;
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

    return this.prisma.$transaction(async (tx) => {
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

    if (
      status === AssessmentStatus.ACTIVE &&
      assessment._count.questions === 0
    ) {
      throw new BadRequestException(
        'Cannot activate assessment with no questions',
      );
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

    // Send emails (fire-and-forget)
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

  async getResults(slugOrId: string, assessmentId: string) {
    const orgId = await this.orgsService.resolveOrgId(slugOrId);
    const assessment = await this.prisma.assessment.findFirst({
      where: { id: assessmentId, orgId },
    });
    if (!assessment) throw new NotFoundException('Assessment not found');

    const invites = await this.prisma.candidateInvite.findMany({
      where: { assessmentId },
      orderBy: [{ score: 'desc' }, { createdAt: 'asc' }],
    });

    const total = invites.length;
    const started = invites.filter((i) => i.status !== 'INVITED').length;
    const submitted = invites.filter((i) => i.status === 'SUBMITTED').length;
    const passed =
      assessment.passingScore != null
        ? invites.filter(
            (i) =>
              i.score != null && Number(i.score) >= assessment.passingScore!,
          ).length
        : null;

    return {
      assessment,
      funnel: { total, started, submitted, passed },
      candidates: invites,
    };
  }

  async exportCsv(slugOrId: string, assessmentId: string): Promise<string> {
    const results = await this.getResults(slugOrId, assessmentId);
    const header =
      'Name,Email,Status,Score (%),Total Correct,Total Questions,Time Spent (s),Tab Switches,Started At,Submitted At';
    const rows = results.candidates.map((c) =>
      [
        c.candidateName ?? '',
        c.candidateEmail,
        c.status,
        c.score != null ? Number(c.score).toFixed(2) : '',
        c.totalCorrect ?? '',
        c.totalQuestions ?? '',
        c.timeSpent ?? '',
        c.tabSwitchCount ?? 0,
        c.startedAt?.toISOString() ?? '',
        c.submittedAt?.toISOString() ?? '',
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
}
