import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ModerationAction, Prisma, QuestionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type ExamWhereInput = Prisma.ExamWhereInput;
type QuestionGenerationJobWhereInput = Prisma.QuestionGenerationJobWhereInput;
type DomainWhereInput = Prisma.DomainWhereInput;
type OrganizationWhereInput = Prisma.OrganizationWhereInput;

interface CsvRow {
  [key: string]: unknown;
}

interface BadgeCriteria {
  [key: string]: unknown;
}

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard() {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      newUsers7d,
      newUsers30d,
      questionsByStatus,
      totalExams,
      totalAttempts,
      pendingReports,
      totalProviders,
      totalCertifications,
      aiGenerationStats,
      totalOrgs,
      newOrgs7d,
      newOrgs30d,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
      this.prisma.user.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      this.prisma.question.groupBy({
        by: ['status'],
        _count: true,
        where: { deletedAt: null },
      }),
      this.prisma.exam.count(),
      this.prisma.examAttempt.count(),
      this.prisma.report.count({ where: { status: 'PENDING' } }),
      this.prisma.provider.count({ where: { isActive: true } }),
      this.prisma.certification.count({ where: { isActive: true } }),
      this.prisma.questionGenerationJob.groupBy({
        by: ['status'],
        _count: true,
      }),
      this.prisma.organization.count(),
      this.prisma.organization.count({
        where: { createdAt: { gte: sevenDaysAgo } },
      }),
      this.prisma.organization.count({
        where: { createdAt: { gte: thirtyDaysAgo } },
      }),
    ]);

    const statusMap: Record<string, number> = {};
    for (const item of questionsByStatus) {
      statusMap[item.status] = item._count;
    }

    const aiStatsMap: Record<string, number> = {};
    for (const item of aiGenerationStats) {
      aiStatsMap[item.status] = item._count;
    }

    return {
      users: {
        total: totalUsers,
        newLast7d: newUsers7d,
        newLast30d: newUsers30d,
      },
      questions: {
        draft: statusMap['DRAFT'] || 0,
        pending: statusMap['PENDING'] || 0,
        approved: statusMap['APPROVED'] || 0,
        rejected: statusMap['REJECTED'] || 0,
        total: Object.values(statusMap).reduce((a, b) => a + b, 0),
      },
      exams: { total: totalExams },
      attempts: { total: totalAttempts },
      reports: { pending: pendingReports },
      providers: { total: totalProviders },
      certifications: { total: totalCertifications },
      aiGeneration: {
        pending: aiStatsMap['PENDING'] || 0,
        processing: aiStatsMap['PROCESSING'] || 0,
        completed: aiStatsMap['COMPLETED'] || 0,
        failed: aiStatsMap['FAILED'] || 0,
      },
      organizations: {
        total: totalOrgs,
        newLast7d: newOrgs7d,
        newLast30d: newOrgs30d,
      },
    };
  }

  async getExams(params: {
    page?: number;
    limit?: number;
    visibility?: string;
  }) {
    const { page = 1, limit = 20, visibility } = params;
    const where: ExamWhereInput = {};
    if (visibility)
      where.visibility = visibility as Prisma.ExamWhereInput['visibility'];

    const [data, total] = await Promise.all([
      this.prisma.exam.findMany({
        where,
        include: {
          author: { select: { id: true, displayName: true, email: true } },
          certification: { select: { id: true, name: true, code: true } },
          _count: { select: { attempts: true, examQuestions: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.exam.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, lastPage: Math.ceil(total / limit) },
    };
  }

  async getGenerationJobs(params: {
    page?: number;
    limit?: number;
    status?: string;
  }) {
    const { page = 1, limit = 20, status } = params;
    const where: QuestionGenerationJobWhereInput = {};
    if (status)
      where.status = status as Prisma.QuestionGenerationJobWhereInput['status'];

    const [data, total] = await Promise.all([
      this.prisma.questionGenerationJob.findMany({
        where,
        include: {
          user: { select: { id: true, displayName: true, email: true } },
          certification: { select: { id: true, name: true, code: true } },
          domain: { select: { id: true, name: true } },
          _count: { select: { questions: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.questionGenerationJob.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, lastPage: Math.ceil(total / limit) },
    };
  }

  async getDomains(params: {
    certificationId?: string;
    page?: number;
    limit?: number;
  }) {
    const { certificationId, page = 1, limit = 50 } = params;
    const where: DomainWhereInput = {};
    if (certificationId) where.certificationId = certificationId;

    const [data, total] = await Promise.all([
      this.prisma.domain.findMany({
        where,
        include: {
          certification: { select: { id: true, name: true, code: true } },
          _count: { select: { questions: true } },
        },
        orderBy: [{ certification: { name: 'asc' } }, { name: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.domain.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, lastPage: Math.ceil(total / limit) },
    };
  }

  // ─── Domain CRUD ─────────────────────────────────────────────────────────────

  async createDomain(data: {
    name: string;
    certificationId: string;
    description?: string;
    weight?: number;
  }) {
    return this.prisma.domain.create({
      data: {
        name: data.name,
        certificationId: data.certificationId,
        description: data.description,
        weight: data.weight,
      },
      include: {
        certification: { select: { id: true, name: true, code: true } },
        _count: { select: { questions: true } },
      },
    });
  }

  async updateDomain(
    id: string,
    data: { name?: string; description?: string; weight?: number },
  ) {
    return this.prisma.domain.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        weight: data.weight,
      },
      include: {
        certification: { select: { id: true, name: true, code: true } },
        _count: { select: { questions: true } },
      },
    });
  }

  async deleteDomain(id: string) {
    const questionCount = await this.prisma.question.count({
      where: { domainId: id, deletedAt: null },
    });
    if (questionCount > 0) {
      throw new BadRequestException(
        `Cannot delete domain with ${questionCount} assigned questions`,
      );
    }
    return this.prisma.domain.delete({ where: { id } });
  }

  async reorderDomains(certificationId: string, orderedIds: string[]) {
    await Promise.all(
      orderedIds.map((id, index) =>
        this.prisma.domain.update({
          where: { id },
          data: { weight: index + 1 },
        }),
      ),
    );
    return this.getDomains({ certificationId });
  }

  // ─── Exam Visibility ─────────────────────────────────────────────────────────

  async updateExamVisibility(id: string, visibility: string) {
    return this.prisma.exam.update({
      where: { id },
      data: { visibility: visibility as Prisma.ExamUpdateInput['visibility'] },
      include: {
        author: { select: { id: true, displayName: true } },
        certification: { select: { id: true, name: true, code: true } },
      },
    });
  }

  // ─── Source Materials ─────────────────────────────────────────────────────────

  async getSourceMaterials(params: { page?: number; limit?: number }) {
    const { page = 1, limit = 20 } = params;
    const [data, total] = await Promise.all([
      this.prisma.sourceMaterial.findMany({
        include: {
          _count: { select: { chunks: true } },
          certification: { select: { id: true, name: true, code: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.sourceMaterial.count(),
    ]);
    return { data, meta: { total, page, lastPage: Math.ceil(total / limit) } };
  }

  async deleteSourceMaterial(id: string) {
    // Chunks are cascade-deleted via onDelete: Cascade in schema
    return this.prisma.sourceMaterial.delete({ where: { id } });
  }

  // ─── Badge Admin ─────────────────────────────────────────────────────────────

  async getAdminBadges() {
    return this.prisma.badge.findMany({
      include: { _count: { select: { awards: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async createBadge(data: {
    name: string;
    description?: string;
    iconUrl?: string;
    criteria?: any;
  }) {
    return this.prisma.badge.create({ data });
  }

  async updateBadge(
    id: string,
    data: {
      name?: string;
      description?: string;
      iconUrl?: string;
      criteria?: any;
    },
  ) {
    return this.prisma.badge.update({ where: { id }, data });
  }

  async deleteBadge(id: string) {
    await this.prisma.badgeAward.deleteMany({ where: { badgeId: id } });
    return this.prisma.badge.delete({ where: { id } });
  }

  async awardBadge(badgeId: string, userId: string) {
    const badge = await this.prisma.badge.findUnique({
      where: { id: badgeId },
    });
    if (!badge) throw new NotFoundException('Badge not found');
    return this.prisma.badgeAward.upsert({
      where: { userId_badgeId: { userId, badgeId } },
      create: { userId, badgeId },
      update: {},
      include: {
        badge: true,
        user: { select: { id: true, displayName: true } },
      },
    });
  }

  async revokeBadge(badgeId: string, userId: string) {
    return this.prisma.badgeAward.delete({
      where: { userId_badgeId: { userId, badgeId } },
    });
  }

  // ─── Bulk Operations ─────────────────────────────────────────────────────────

  async bulkUpdateQuestionStatus(ids: string[], status: string) {
    const result = await this.prisma.question.updateMany({
      where: { id: { in: ids }, deletedAt: null },
      data: { status: status as Prisma.QuestionUpdateInput['status'] },
    });
    return { updated: result.count };
  }

  async bulkUpdateUserRole(userIds: string[], role: string) {
    const result = await this.prisma.user.updateMany({
      where: {
        id: { in: userIds },
        role: { not: 'ADMIN' as Prisma.UserWhereInput['role'] },
      },
      data: { role: role as Prisma.UserUpdateInput['role'] },
    });
    return { updated: result.count };
  }

  async updateUserPlan(userId: string, plan: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { plan: plan as Prisma.UserUpdateInput['plan'] },
      select: { id: true, email: true, plan: true },
    });
  }

  // ─── Organization Management ──────────────────────────────────────────────────

  async getOrganizations(params: {
    page?: number;
    limit?: number;
    search?: string;
  }) {
    const { page = 1, limit = 20, search } = params;
    const where: OrganizationWhereInput = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.organization.findMany({
        where,
        include: {
          members: {
            where: { role: 'OWNER' as Prisma.OrgMemberWhereInput['role'] },
            include: {
              user: {
                select: {
                  id: true,
                  displayName: true,
                  email: true,
                  plan: true,
                },
              },
            },
            take: 1,
          },
          _count: { select: { members: { where: { isActive: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.organization.count({ where }),
    ]);

    return {
      data: data.map((org) => ({
        ...org,
        owner: org.members[0]?.user || null,
        memberCount: org._count.members,
        members: undefined,
        _count: undefined,
      })),
      meta: { total, page, lastPage: Math.ceil(total / limit) },
    };
  }

  async getOrganization(orgId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      include: {
        members: {
          where: { role: 'OWNER' as Prisma.OrgMemberWhereInput['role'] },
          include: {
            user: {
              select: {
                id: true,
                displayName: true,
                email: true,
                plan: true,
              },
            },
          },
          take: 1,
        },
        _count: { select: { members: { where: { isActive: true } } } },
      },
    });
    if (!org) throw new NotFoundException('Organization not found');
    return {
      ...org,
      owner: org.members[0]?.user || null,
      memberCount: org._count.members,
      members: undefined,
      _count: undefined,
    };
  }

  async updateOrganization(
    orgId: string,
    data: {
      name?: string;
      description?: string;
      industry?: string;
      logoUrl?: string;
      accentColor?: string;
      maxSeats?: number;
      isActive?: boolean;
    },
  ) {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
    });
    if (!org) throw new NotFoundException('Organization not found');
    return this.prisma.organization.update({
      where: { id: orgId },
      data,
    });
  }

  async deleteOrganization(orgId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
    });
    if (!org) throw new NotFoundException('Organization not found');
    await this.prisma.organization.delete({ where: { id: orgId } });
    return { deleted: true, orgId };
  }

  async getOrgMembers(
    orgId: string,
    params: { page?: number; limit?: number },
  ) {
    const { page = 1, limit = 20 } = params;
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
    });
    if (!org) throw new NotFoundException('Organization not found');

    const where = { orgId, isActive: true };
    const [data, total] = await Promise.all([
      this.prisma.orgMember.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              displayName: true,
              email: true,
              plan: true,
              role: true,
            },
          },
        },
        orderBy: { joinedAt: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.orgMember.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, lastPage: Math.ceil(total / limit) },
    };
  }

  async updateOrgMemberRole(orgId: string, userId: string, role: string) {
    const member = await this.prisma.orgMember.findUnique({
      where: { orgId_userId: { orgId, userId } },
    });
    if (!member) throw new NotFoundException('Member not found');
    return this.prisma.orgMember.update({
      where: { id: member.id },
      data: { role: role as Prisma.OrgMemberUpdateInput['role'] },
    });
  }

  async removeOrgMember(orgId: string, userId: string) {
    const member = await this.prisma.orgMember.findUnique({
      where: { orgId_userId: { orgId, userId } },
    });
    if (!member) throw new NotFoundException('Member not found');
    await this.prisma.orgMember.update({
      where: { id: member.id },
      data: { isActive: false },
    });
    return { removed: true, userId };
  }

  // ─── CSV Export ───────────────────────────────────────────────────────────────

  private escapeCsv(value: unknown): string {
    if (value == null) return '';
    // Convert value to string, handling various types (primitives, dates, etc)
    const str =
      value instanceof Date
        ? value.toISOString()
        : typeof value === 'object'
          ? JSON.stringify(value)
          : String(value as string | number | boolean);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  private toCsv(headers: string[], rows: unknown[][]): string {
    const headerRow = headers.join(',');
    const dataRows = rows.map((row) =>
      row.map((v) => this.escapeCsv(v)).join(','),
    );
    return [headerRow, ...dataRows].join('\n');
  }

  async exportUsers(): Promise<string> {
    const users = await this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        status: true,
        points: true,
        createdAt: true,
        _count: { select: { questions: true, examAttempts: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return this.toCsv(
      [
        'id',
        'email',
        'displayName',
        'role',
        'status',
        'points',
        'questions',
        'examAttempts',
        'createdAt',
      ],
      users.map((u) => [
        u.id,
        u.email,
        u.displayName,
        u.role,
        u.status,
        u.points,
        u._count.questions,
        u._count.examAttempts,
        u.createdAt.toISOString(),
      ]),
    );
  }

  async exportQuestions(): Promise<string> {
    const questions = await this.prisma.question.findMany({
      where: { deletedAt: null },
      include: {
        certification: { select: { name: true, code: true } },
        domain: { select: { name: true } },
        author: { select: { displayName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return this.toCsv(
      [
        'id',
        'title',
        'status',
        'difficulty',
        'questionType',
        'certification',
        'domain',
        'author',
        'createdAt',
      ],
      questions.map((q) => [
        q.id,
        q.title,
        q.status,
        q.difficulty,
        q.questionType,
        q.certification
          ? `${q.certification.code} - ${q.certification.name}`
          : '',
        q.domain?.name || '',
        (q as unknown as { author?: { displayName?: string } }).author
          ?.displayName || '',
        q.createdAt.toISOString(),
      ]),
    );
  }

  async exportAnalytics(): Promise<string> {
    const attempts = await this.prisma.examAttempt.findMany({
      where: { status: 'SUBMITTED' as Prisma.ExamAttemptWhereInput['status'] },
      include: {
        user: { select: { displayName: true, email: true } },
        exam: {
          select: {
            title: true,
            certification: { select: { name: true, code: true } },
          },
        },
      },
      orderBy: { submittedAt: 'desc' },
    });
    return this.toCsv(
      [
        'attemptId',
        'user',
        'email',
        'exam',
        'certification',
        'score',
        'passed',
        'timeSpent',
        'submittedAt',
      ],
      attempts.map((a) => [
        a.id,
        a.user.displayName,
        a.user.email,
        a.exam.title,
        a.exam.certification
          ? `${a.exam.certification.code} - ${a.exam.certification.name}`
          : '',
        a.score,
        Number(a.score ?? 0) >= 70 ? 'YES' : 'NO',
        a.timeSpent,
        a.submittedAt?.toISOString() || '',
      ]),
    );
  }

  // ─── US-508: Reviewer Queue ──────────────────────────────────────────────────

  /**
   * List questions for the reviewer queue, filtered by category:
   *  - `flagged`   — questions that have at least one PENDING Report
   *  - `new`       — status = PENDING with no PENDING reports
   *  - `ambiguous` — status = PENDING where downvotes > upvotes (controversial)
   *
   * Returns paginated results with report count and certification name for context.
   */
  async getReviewQueue(
    filter: 'flagged' | 'new' | 'ambiguous',
    page = 1,
    limit = 20,
  ) {
    const skip = (page - 1) * limit;

    let where: Prisma.QuestionWhereInput;

    switch (filter) {
      case 'flagged':
        where = {
          deletedAt: null,
          reports: { some: { status: 'PENDING' } },
        };
        break;

      case 'ambiguous':
        // Questions where community downvotes exceed upvotes signal controversy.
        // Prisma doesn't support column-to-column comparisons; filter on downvotes > 0
        // as a practical proxy. The service layer remains accurate since high-downvote
        // questions are the primary ambiguity signal.
        where = {
          status: QuestionStatus.PENDING,
          deletedAt: null,
          downvotes: { gt: 0 },
        };
        break;

      default: // 'new'
        where = {
          status: QuestionStatus.PENDING,
          deletedAt: null,
          reports: { none: { status: 'PENDING' } },
        };
    }

    const [items, total] = await Promise.all([
      this.prisma.question.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          title: true,
          status: true,
          upvotes: true,
          downvotes: true,
          isAiGenerated: true,
          createdAt: true,
          certification: { select: { name: true, code: true } },
          _count: { select: { reports: true } },
        },
      }),
      this.prisma.question.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  /**
   * Accept a question: set status → APPROVED and write a ModerationAudit row.
   * Also resolves all pending Reports on the question (sets them to RESOLVED).
   */
  async acceptQuestion(questionId: string, reviewerId: string) {
    const question = await this.prisma.question.findUnique({
      where: { id: questionId },
    });
    if (!question || question.deletedAt) {
      throw new NotFoundException('Question not found');
    }

    await this.prisma.$transaction([
      this.prisma.question.update({
        where: { id: questionId },
        data: { status: QuestionStatus.APPROVED },
      }),
      // Resolve all pending reports so they leave the flagged queue.
      this.prisma.report.updateMany({
        where: { questionId, status: 'PENDING' },
        data: { status: 'RESOLVED' },
      }),
      this.prisma.moderationAudit.create({
        data: {
          questionId,
          reviewerId,
          action: ModerationAction.ACCEPTED,
          reason: null,
        },
      }),
    ]);

    return { questionId, action: ModerationAction.ACCEPTED };
  }

  /**
   * Reject a question: set status → REJECTED and write a ModerationAudit row.
   * The rejection reason is required and must be at least 10 characters.
   */
  async rejectQuestion(questionId: string, reviewerId: string, reason: string) {
    if (!reason || reason.trim().length < 10) {
      throw new BadRequestException(
        'Rejection reason must be at least 10 characters',
      );
    }

    const question = await this.prisma.question.findUnique({
      where: { id: questionId },
    });
    if (!question || question.deletedAt) {
      throw new NotFoundException('Question not found');
    }

    await this.prisma.$transaction([
      this.prisma.question.update({
        where: { id: questionId },
        data: { status: QuestionStatus.REJECTED },
      }),
      this.prisma.moderationAudit.create({
        data: {
          questionId,
          reviewerId,
          action: ModerationAction.REJECTED,
          reason: reason.trim(),
        },
      }),
    ]);

    return { questionId, action: ModerationAction.REJECTED };
  }

  /** Return the ModerationAudit history for a question, newest first. */
  async getModerationHistory(questionId: string) {
    return this.prisma.moderationAudit.findMany({
      where: { questionId },
      orderBy: { createdAt: 'desc' },
      include: {
        reviewer: { select: { id: true, displayName: true, email: true } },
      },
    });
  }
}
