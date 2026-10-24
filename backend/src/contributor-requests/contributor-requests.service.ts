import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AttemptStatus,
  ContributorRequestStatus,
  Prisma,
  UserRole,
  UserStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { MailService } from '../mail/mail.service';
import { CreateContributorRequestDto } from './dto/create-contributor-request.dto';

const DAY_MS = 24 * 60 * 60 * 1000;

export type EligibilityCheckKey =
  | 'ROLE'
  | 'ACCOUNT_STATUS'
  | 'NO_PENDING_REQUEST'
  | 'COOLDOWN'
  | 'ACCOUNT_AGE'
  | 'COMPLETED_ATTEMPTS';

export interface EligibilityCheck {
  key: EligibilityCheckKey;
  passed: boolean;
  current?: number;
  required?: number;
}

export interface EligibilityResult {
  eligible: boolean;
  checks: EligibilityCheck[];
  retryAfter?: string;
}

const userSummarySelect = {
  id: true,
  email: true,
  displayName: true,
  avatarUrl: true,
  createdAt: true,
  status: true,
  role: true,
  points: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class ContributorRequestsService {
  private readonly logger = new Logger(ContributorRequestsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  private numberSetting(key: string, fallback: number): number {
    const raw = this.config.get<string | number>(key);
    const parsed = raw === undefined || raw === '' ? NaN : Number(raw);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
  }

  get cooldownDays() {
    return this.numberSetting('CONTRIBUTOR_REQUEST_COOLDOWN_DAYS', 30);
  }

  get minAccountAgeDays() {
    return this.numberSetting('CONTRIBUTOR_REQUEST_MIN_ACCOUNT_AGE_DAYS', 7);
  }

  get minAttempts() {
    return this.numberSetting('CONTRIBUTOR_REQUEST_MIN_ATTEMPTS', 3);
  }

  // ─── Learner side ──────────────────────────────────────────────────────────

  async getEligibility(userId: string): Promise<EligibilityResult> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, status: true, createdAt: true },
    });
    if (!user) throw new NotFoundException('User not found');

    const [pending, lastRejected, completedAttempts] = await Promise.all([
      this.prisma.contributorRequest.findFirst({
        where: { userId, status: ContributorRequestStatus.PENDING },
        select: { id: true },
      }),
      this.prisma.contributorRequest.findFirst({
        where: { userId, status: ContributorRequestStatus.REJECTED },
        orderBy: { reviewedAt: 'desc' },
        select: { reviewedAt: true },
      }),
      this.prisma.examAttempt.count({
        where: { userId, status: AttemptStatus.SUBMITTED },
      }),
    ]);

    const now = Date.now();
    let retryAfter: Date | undefined;
    if (lastRejected?.reviewedAt && this.cooldownDays > 0) {
      const until = new Date(
        lastRejected.reviewedAt.getTime() + this.cooldownDays * DAY_MS,
      );
      if (until.getTime() > now) retryAfter = until;
    }
    const accountAgeDays = Math.floor(
      (now - new Date(user.createdAt).getTime()) / DAY_MS,
    );

    const checks: EligibilityCheck[] = [
      { key: 'ROLE', passed: user.role === UserRole.LEARNER },
      { key: 'ACCOUNT_STATUS', passed: user.status === UserStatus.ACTIVE },
      { key: 'NO_PENDING_REQUEST', passed: !pending },
      { key: 'COOLDOWN', passed: !retryAfter },
      {
        key: 'ACCOUNT_AGE',
        passed: accountAgeDays >= this.minAccountAgeDays,
        current: accountAgeDays,
        required: this.minAccountAgeDays,
      },
      {
        key: 'COMPLETED_ATTEMPTS',
        passed: completedAttempts >= this.minAttempts,
        current: completedAttempts,
        required: this.minAttempts,
      },
    ];

    return {
      eligible: checks.every((c) => c.passed),
      checks,
      ...(retryAfter && { retryAfter: retryAfter.toISOString() }),
    };
  }

  async create(userId: string, dto: CreateContributorRequestDto) {
    const eligibility = await this.getEligibility(userId);
    const failed = (key: EligibilityCheckKey) =>
      eligibility.checks.find((c) => c.key === key && !c.passed);

    if (failed('ROLE')) {
      throw new ConflictException({
        code: 'ALREADY_CONTRIBUTOR',
        message: 'Only learners can request contributor access',
      });
    }
    if (failed('ACCOUNT_STATUS')) {
      throw new ForbiddenException({
        code: 'ACCOUNT_NOT_ACTIVE',
        message: 'Your account is not active',
      });
    }
    if (failed('NO_PENDING_REQUEST')) {
      throw this.pendingConflict();
    }
    if (failed('COOLDOWN')) {
      throw new HttpException(
        {
          code: 'COOLDOWN_ACTIVE',
          message: 'You can submit a new request after the cooldown period',
          retryAfter: eligibility.retryAfter,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    const unmet = eligibility.checks.filter(
      (c) =>
        !c.passed &&
        (c.key === 'ACCOUNT_AGE' || c.key === 'COMPLETED_ATTEMPTS'),
    );
    if (unmet.length) {
      throw new ForbiddenException({
        code: 'NOT_ELIGIBLE',
        message: 'You do not meet the requirements yet',
        reasons: unmet,
      });
    }

    const expertise = [...new Set(dto.expertise ?? [])];
    if (expertise.length) {
      const found = await this.prisma.certification.count({
        where: { id: { in: expertise } },
      });
      if (found !== expertise.length) {
        throw new BadRequestException('Unknown certification in expertise');
      }
    }

    let request;
    try {
      request = await this.prisma.contributorRequest.create({
        data: {
          userId,
          motivation: dto.motivation.trim(),
          expertise,
          sampleUrl: dto.sampleUrl || null,
        },
      });
    } catch (e) {
      // Partial unique index: a concurrent request already created a PENDING row.
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw this.pendingConflict();
      }
      throw e;
    }

    await this.safeAudit({
      userId,
      action: 'CONTRIBUTOR_REQUEST_CREATED',
      targetType: 'ContributorRequest',
      targetId: request.id,
    });
    return this.toLearnerView(request);
  }

  async getMine(userId: string) {
    const requests = await this.prisma.contributorRequest.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    const [latest, ...history] = requests.map((r) => this.toLearnerView(r));
    return { request: latest ?? null, history };
  }

  async cancelMine(userId: string) {
    const pending = await this.prisma.contributorRequest.findFirst({
      where: { userId, status: ContributorRequestStatus.PENDING },
    });
    if (!pending) throw new NotFoundException('No pending request');

    const result = await this.prisma.contributorRequest.updateMany({
      where: { id: pending.id, status: ContributorRequestStatus.PENDING },
      data: { status: ContributorRequestStatus.CANCELLED },
    });
    if (result.count === 0) throw new NotFoundException('No pending request');

    await this.safeAudit({
      userId,
      action: 'CONTRIBUTOR_REQUEST_CANCELLED',
      targetType: 'ContributorRequest',
      targetId: pending.id,
    });
    return { id: pending.id, status: ContributorRequestStatus.CANCELLED };
  }

  // ─── Admin side ────────────────────────────────────────────────────────────

  async adminList(params: {
    status?: string;
    page?: number;
    limit?: number;
    search?: string;
  }) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 20));
    const status = (params.status || 'PENDING').toUpperCase();

    const where: Prisma.ContributorRequestWhereInput = {};
    if (status !== 'ALL') {
      if (!(status in ContributorRequestStatus)) {
        throw new BadRequestException('Invalid status');
      }
      where.status = status as ContributorRequestStatus;
    }
    if (params.search?.trim()) {
      const q = params.search.trim();
      where.user = {
        OR: [
          { email: { contains: q, mode: 'insensitive' } },
          { displayName: { contains: q, mode: 'insensitive' } },
        ],
      };
    }

    const [rows, total] = await Promise.all([
      this.prisma.contributorRequest.findMany({
        where,
        orderBy: { createdAt: status === 'PENDING' ? 'asc' : 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: { select: userSummarySelect },
          reviewedBy: { select: { id: true, displayName: true } },
        },
      }),
      this.prisma.contributorRequest.count({ where }),
    ]);

    return {
      data: await this.withSnapshots(rows),
      meta: { total, page, limit, lastPage: Math.ceil(total / limit) },
    };
  }

  async adminStats() {
    const pending = await this.prisma.contributorRequest.count({
      where: { status: ContributorRequestStatus.PENDING },
    });
    return { pending };
  }

  async adminGet(id: string) {
    const row = await this.prisma.contributorRequest.findUnique({
      where: { id },
      include: {
        user: { select: userSummarySelect },
        reviewedBy: { select: { id: true, displayName: true } },
      },
    });
    if (!row) throw new NotFoundException('Contributor request not found');

    const [withSnapshot] = await this.withSnapshots([row]);
    const history = await this.prisma.contributorRequest.findMany({
      where: { userId: row.userId, id: { not: row.id } },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        status: true,
        createdAt: true,
        reviewedAt: true,
        decisionReason: true,
      },
    });
    return { ...withSnapshot, history };
  }

  async approve(id: string, adminId: string, note?: string) {
    const request = await this.findForReview(id, adminId);
    const trimmedNote = note?.trim() || null;

    const { user, roleChanged, oldRole } = await this.prisma.$transaction(
      async (tx) => {
        const updated = await tx.contributorRequest.updateMany({
          where: { id, status: ContributorRequestStatus.PENDING },
          data: {
            status: ContributorRequestStatus.APPROVED,
            reviewedById: adminId,
            reviewedAt: new Date(),
            decisionReason: trimmedNote,
          },
        });
        if (updated.count === 0) throw this.notPendingConflict();

        const target = await tx.user.findUnique({
          where: { id: request.userId },
          select: {
            id: true,
            email: true,
            displayName: true,
            role: true,
            status: true,
          },
        });
        if (!target) throw new NotFoundException('User not found');
        if (target.status !== UserStatus.ACTIVE) {
          // Throwing rolls back the status change above.
          throw new ConflictException({
            code: 'USER_NOT_ACTIVE',
            message: 'The user is not active; reject the request instead',
          });
        }

        // Never downgrade someone who was promoted further in the meantime.
        if (target.role !== UserRole.LEARNER) {
          return { user: target, roleChanged: false, oldRole: target.role };
        }
        await tx.user.update({
          where: { id: target.id },
          data: { role: UserRole.CONTRIBUTOR },
        });
        return { user: target, roleChanged: true, oldRole: target.role };
      },
    );

    await this.safeAudit({
      userId: adminId,
      action: 'CONTRIBUTOR_REQUEST_APPROVED',
      targetType: 'ContributorRequest',
      targetId: id,
      metadata: {
        userId: user.id,
        note: trimmedNote,
        ...(!roleChanged && { roleUnchanged: true }),
      },
    });
    if (roleChanged) {
      await this.safeAudit({
        userId: adminId,
        action: 'ROLE_CHANGED',
        targetType: 'User',
        targetId: user.id,
        metadata: {
          oldRole,
          newRole: UserRole.CONTRIBUTOR,
          source: 'CONTRIBUTOR_REQUEST',
          requestId: id,
        },
      });
    }
    await this.mail.sendContributorRequestApproved(
      user.email,
      user.displayName,
      trimmedNote,
    );

    return {
      id,
      status: ContributorRequestStatus.APPROVED,
      userId: user.id,
      role: roleChanged ? UserRole.CONTRIBUTOR : user.role,
    };
  }

  async reject(id: string, adminId: string, reason: string) {
    const request = await this.findForReview(id, adminId);
    const trimmedReason = reason?.trim();
    if (!trimmedReason || trimmedReason.length < 10) {
      throw new BadRequestException('A rejection reason is required');
    }

    const reviewedAt = new Date();
    const updated = await this.prisma.contributorRequest.updateMany({
      where: { id, status: ContributorRequestStatus.PENDING },
      data: {
        status: ContributorRequestStatus.REJECTED,
        reviewedById: adminId,
        reviewedAt,
        decisionReason: trimmedReason,
      },
    });
    if (updated.count === 0) throw this.notPendingConflict();

    await this.safeAudit({
      userId: adminId,
      action: 'CONTRIBUTOR_REQUEST_REJECTED',
      targetType: 'ContributorRequest',
      targetId: id,
      metadata: { userId: request.userId, reason: trimmedReason },
    });

    const user = await this.prisma.user.findUnique({
      where: { id: request.userId },
      select: { email: true, displayName: true },
    });
    if (user) {
      const retryAfter = new Date(
        reviewedAt.getTime() + this.cooldownDays * DAY_MS,
      );
      await this.mail.sendContributorRequestRejected(
        user.email,
        user.displayName,
        trimmedReason,
        retryAfter,
      );
    }

    return { id, status: ContributorRequestStatus.REJECTED };
  }

  /**
   * FR-6: when an admin changes roles manually, close any PENDING request of
   * users who are no longer learners so the admin queue has no orphans.
   */
  async cancelPendingOnRoleChange(
    userIds: string[],
    newRole: string,
    actorId?: string,
  ) {
    if (!userIds?.length || newRole === UserRole.LEARNER) return 0;

    const pending = await this.prisma.contributorRequest.findMany({
      where: {
        userId: { in: userIds },
        status: ContributorRequestStatus.PENDING,
        user: { role: { not: UserRole.LEARNER } },
      },
      select: { id: true, userId: true },
    });
    if (!pending.length) return 0;

    const result = await this.prisma.contributorRequest.updateMany({
      where: {
        id: { in: pending.map((p) => p.id) },
        status: ContributorRequestStatus.PENDING,
      },
      data: {
        status: ContributorRequestStatus.CANCELLED,
        decisionReason: 'Role changed manually by admin',
        reviewedById: actorId ?? null,
        reviewedAt: new Date(),
      },
    });

    if (actorId) {
      for (const p of pending) {
        await this.safeAudit({
          userId: actorId,
          action: 'CONTRIBUTOR_REQUEST_AUTO_CANCELLED',
          targetType: 'ContributorRequest',
          targetId: p.id,
          metadata: { userId: p.userId, newRole },
        });
      }
    }
    return result.count;
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private async findForReview(id: string, adminId: string) {
    const request = await this.prisma.contributorRequest.findUnique({
      where: { id },
      select: { id: true, userId: true, status: true },
    });
    if (!request) throw new NotFoundException('Contributor request not found');
    if (request.userId === adminId) {
      throw new ForbiddenException('You cannot review your own request');
    }
    if (request.status !== ContributorRequestStatus.PENDING) {
      throw this.notPendingConflict();
    }
    return request;
  }

  /** Attach per-user activity stats in batched queries (no N+1). */
  private async withSnapshots<
    T extends { userId: string; expertise: string[] },
  >(rows: T[]) {
    if (!rows.length) return [];
    const userIds = [...new Set(rows.map((r) => r.userId))];
    const certIds = [...new Set(rows.flatMap((r) => r.expertise))];

    const [attempts, comments, reports, previous, certs] = await Promise.all([
      this.prisma.examAttempt.groupBy({
        by: ['userId'],
        where: { userId: { in: userIds }, status: AttemptStatus.SUBMITTED },
        _count: { _all: true },
        _avg: { score: true },
      }),
      this.prisma.comment.groupBy({
        by: ['userId'],
        where: { userId: { in: userIds } },
        _count: { _all: true },
      }),
      this.prisma.report.groupBy({
        by: ['userId'],
        where: { userId: { in: userIds } },
        _count: { _all: true },
      }),
      this.prisma.contributorRequest.groupBy({
        by: ['userId', 'status'],
        where: {
          userId: { in: userIds },
          status: {
            in: [
              ContributorRequestStatus.REJECTED,
              ContributorRequestStatus.CANCELLED,
            ],
          },
        },
        _count: { _all: true },
      }),
      certIds.length
        ? this.prisma.certification.findMany({
            where: { id: { in: certIds } },
            select: { id: true, name: true, code: true },
          })
        : Promise.resolve([]),
    ]);

    const certById = new Map(certs.map((c) => [c.id, c]));
    return rows.map((row) => {
      const a = attempts.find((x) => x.userId === row.userId);
      const avg = a?._avg?.score;
      const prevCount = (status: ContributorRequestStatus) =>
        previous.find((p) => p.userId === row.userId && p.status === status)
          ?._count._all ?? 0;
      return {
        ...row,
        expertiseCertifications: row.expertise
          .map((id) => certById.get(id))
          .filter(Boolean),
        stats: {
          completedAttempts: a?._count._all ?? 0,
          avgScore: avg == null ? null : Math.round(Number(avg) * 10) / 10,
          commentsCount:
            comments.find((c) => c.userId === row.userId)?._count._all ?? 0,
          reportsFiled:
            reports.find((r) => r.userId === row.userId)?._count._all ?? 0,
          previousRequests: {
            rejected: prevCount(ContributorRequestStatus.REJECTED),
            cancelled: prevCount(ContributorRequestStatus.CANCELLED),
          },
        },
      };
    });
  }

  private toLearnerView(r: {
    id: string;
    status: ContributorRequestStatus;
    motivation: string;
    expertise: string[];
    sampleUrl: string | null;
    decisionReason: string | null;
    reviewedAt: Date | null;
    createdAt: Date;
  }) {
    let retryAfter: string | null = null;
    if (r.status === ContributorRequestStatus.REJECTED && r.reviewedAt) {
      const until = new Date(
        r.reviewedAt.getTime() + this.cooldownDays * DAY_MS,
      );
      if (until.getTime() > Date.now()) retryAfter = until.toISOString();
    }
    return {
      id: r.id,
      status: r.status,
      motivation: r.motivation,
      expertise: r.expertise,
      sampleUrl: r.sampleUrl,
      decisionReason: r.decisionReason,
      reviewedAt: r.reviewedAt,
      createdAt: r.createdAt,
      retryAfter,
    };
  }

  private pendingConflict() {
    return new ConflictException({
      code: 'REQUEST_ALREADY_PENDING',
      message: 'You already have a pending request',
    });
  }

  private notPendingConflict() {
    return new ConflictException({
      code: 'REQUEST_NOT_PENDING',
      message: 'This request has already been handled',
    });
  }

  private async safeAudit(entry: Parameters<AuditService['log']>[0]) {
    try {
      await this.audit.log(entry);
    } catch (e) {
      this.logger.error(`Failed to write audit log ${entry.action}`, e);
    }
  }
}
