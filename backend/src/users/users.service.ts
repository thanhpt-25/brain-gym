import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import {
  User,
  UserRole,
  UserPlan,
  UserStatus,
  AttemptStatus,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { toLocalDateString, isConsecutiveDay } from '../streaks/streak';

const publicSelect = {
  id: true,
  email: true,
  displayName: true,
  avatarUrl: true,
  role: true,
  plan: true,
  status: true,
  points: true,
  suspendedUntil: true,
  banReason: true,
  featureFlags: true,
  createdAt: true,
};

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    const salt = await bcrypt.genSalt();
    const hashedPassword = await bcrypt.hash(createUserDto.password, salt);
    return this.prisma.user.create({
      data: {
        email: createUserDto.email,
        passwordHash: hashedPassword,
        displayName: createUserDto.displayName,
      },
    });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async findAll(search?: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const where: any = {};
    if (search) {
      where.OR = [
        { displayName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, users] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        select: {
          ...publicSelect,
          _count: {
            select: {
              questions: true,
              examAttempts: { where: { status: AttemptStatus.SUBMITTED } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return {
      data: users,
      meta: { total, page, limit, lastPage: Math.ceil(total / limit) },
    };
  }

  async updateRole(userId: string, role: UserRole) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    return this.prisma.user.update({
      where: { id: userId },
      data: { role },
      select: publicSelect,
    });
  }

  async updatePlan(userId: string, plan: UserPlan) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    return this.prisma.user.update({
      where: { id: userId },
      data: { plan },
      select: publicSelect,
    });
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const data: any = {};
    if (dto.displayName !== undefined) data.displayName = dto.displayName;
    if (dto.avatarUrl !== undefined) data.avatarUrl = dto.avatarUrl;

    return this.prisma.user.update({
      where: { id: userId },
      data,
      select: publicSelect,
    });
  }

  async getPublicProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        ...publicSelect,
        _count: {
          select: {
            questions: true,
            examAttempts: { where: { status: AttemptStatus.SUBMITTED } },
          },
        },
        badgeAwards: {
          include: { badge: true },
          orderBy: { awardedAt: 'desc' },
        },
      },
    });

    if (!user) throw new NotFoundException('User not found');

    return {
      ...user,
      badges: user.badgeAwards.map((a) => ({
        id: a.badge.id,
        name: a.badge.name,
        description: a.badge.description,
        awardedAt: a.awardedAt,
      })),
      badgeAwards: undefined,
    };
  }

  async suspendUser(userId: string, reason: string, suspendedUntil?: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.role === UserRole.ADMIN) {
      throw new ForbiddenException('Cannot suspend an admin user');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        status: UserStatus.SUSPENDED,
        banReason: reason,
        suspendedUntil: suspendedUntil ? new Date(suspendedUntil) : null,
      },
      select: publicSelect,
    });
  }

  async banUser(userId: string, reason: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.role === UserRole.ADMIN) {
      throw new ForbiddenException('Cannot ban an admin user');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        status: UserStatus.BANNED,
        banReason: reason,
        suspendedUntil: null,
      },
      select: publicSelect,
    });
  }

  async reactivateUser(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        status: UserStatus.ACTIVE,
        banReason: null,
        suspendedUntil: null,
      },
      select: publicSelect,
    });
  }

  async adjustPoints(userId: string, amount: number) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    return this.prisma.user.update({
      where: { id: userId },
      data: { points: { increment: amount } },
      select: publicSelect,
    });
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (!user.passwordHash)
      throw new BadRequestException(
        'Password change not available for OAuth accounts',
      );

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) throw new BadRequestException('Current password is incorrect');

    const salt = await bcrypt.genSalt();
    const hash = await bcrypt.hash(newPassword, salt);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: hash },
    });
    return { message: 'Password updated successfully' };
  }

  async getOverview(userId: string) {
    const [stats, badges, activity, certs] = await Promise.all([
      this.getStats(userId),
      this.getBadgesWithEarned(userId),
      this.getRecentActivity(userId),
      this.getCertProgress(userId),
    ]);
    return { stats, badges, activity, certs };
  }

  private async getStats(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { points: true },
    });
    if (!user) throw new NotFoundException('User not found');

    const [examsPassed, avgScoreData, examAttempts] = await Promise.all([
      this.prisma.examAttempt.count({
        where: {
          userId,
          status: 'SUBMITTED',
          score: { gte: 70 },
        },
      }),
      this.prisma.examAttempt.aggregate({
        where: { userId, status: 'SUBMITTED' },
        _avg: { score: true },
      }),
      this.prisma.examAttempt.findMany({
        where: { userId },
        select: { submittedAt: true, exam: { select: { id: true } } },
        orderBy: { submittedAt: 'desc' },
      }),
    ]);

    const avgScore = examAttempts.length
      ? Math.round(Number(avgScoreData._avg.score || 0))
      : 0;

    const dayStreak = this.computeStreak(examAttempts);

    return {
      totalPoints: user.points,
      examsPassed,
      avgScore,
      dayStreak,
    };
  }

  private computeStreak(attempts: Array<{ submittedAt: Date | null }>) {
    if (attempts.length === 0) return 0;

    const tz = 'UTC';
    const dates = new Set<string>();

    for (const a of attempts) {
      if (a.submittedAt) {
        const dateStr = toLocalDateString(a.submittedAt, tz);
        dates.add(dateStr);
      }
    }

    if (dates.size === 0) return 0;

    const sorted = Array.from(dates).sort().reverse();
    const today = new Date().toISOString().slice(0, 10);

    let streak = 0;
    let current = sorted[0];

    if (current === today || isConsecutiveDay(current, today)) {
      current = current === today ? (sorted[1] ?? null) : today;
      streak = 1;
    } else {
      return 0;
    }

    if (!current) return streak;

    for (let i = 1; i < sorted.length; i++) {
      if (isConsecutiveDay(sorted[i], current)) {
        streak++;
        current = sorted[i];
      } else {
        break;
      }
    }

    return streak;
  }

  private async getBadgesWithEarned(userId: string) {
    const [all, earned] = await Promise.all([
      this.prisma.badge.findMany({ orderBy: { name: 'asc' } }),
      this.prisma.badgeAward.findMany({
        where: { userId },
        select: { badgeId: true, awardedAt: true },
      }),
    ]);

    const earnedMap = new Map(earned.map((e) => [e.badgeId, e.awardedAt]));

    return all.map((b) => ({
      id: b.id,
      name: b.name,
      description: b.description,
      iconUrl: b.iconUrl,
      earned: earnedMap.has(b.id),
      awardedAt: earnedMap.get(b.id) || null,
    }));
  }

  private async getRecentActivity(userId: string) {
    const [attempts, awards, questions, reviews] = await Promise.all([
      this.prisma.examAttempt.findMany({
        where: { userId, status: 'SUBMITTED' },
        select: {
          id: true,
          submittedAt: true,
          score: true,
          exam: { select: { title: true } },
        },
        orderBy: { submittedAt: 'desc' },
        take: 20,
      }),
      this.prisma.badgeAward.findMany({
        where: { userId },
        select: {
          awardedAt: true,
          badge: { select: { name: true } },
        },
        orderBy: { awardedAt: 'desc' },
        take: 20,
      }),
      this.prisma.question.findMany({
        where: { createdBy: userId },
        select: {
          id: true,
          createdAt: true,
          title: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      this.prisma.reviewSchedule.findMany({
        where: { userId, lastReviewedAt: { not: null } },
        select: {
          lastReviewedAt: true,
          question: { select: { title: true } },
        },
        orderBy: { lastReviewedAt: 'desc' },
        take: 20,
      }),
    ]);

    const items = [
      ...attempts.map((a) => ({
        type: 'exam_passed' as const,
        title: `Passed ${a.exam.title}`,
        meta: `Score ${Math.round(Number(a.score || 0))}%`,
        occurredAt: a.submittedAt || new Date(),
      })),
      ...awards.map((a) => ({
        type: 'badge_earned' as const,
        title: `Earned '${a.badge.name}' badge`,
        meta: 'Achievement',
        occurredAt: a.awardedAt,
      })),
      ...questions.map((q) => ({
        type: 'question_created' as const,
        title: `Created a question`,
        meta: q.title.slice(0, 50),
        occurredAt: q.createdAt,
      })),
      ...reviews.map((r) => ({
        type: 'flashcard_reviewed' as const,
        title: `Reviewed flashcard`,
        meta: r.question.title.slice(0, 50),
        occurredAt: r.lastReviewedAt || new Date(),
      })),
    ];

    return items.sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime()).slice(0, 10);
  }

  private async getCertProgress(userId: string) {
    const reviews = await this.prisma.reviewSchedule.findMany({
      where: { userId },
      select: {
        mastery: true,
        question: {
          select: {
            certificationId: true,
            certification: { select: { code: true, name: true } },
          },
        },
      },
    });

    if (reviews.length === 0) return [];

    const certIds = Array.from(new Set(reviews.map((r) => r.question.certificationId)));

    const certTotals = await this.prisma.question.groupBy({
      by: ['certificationId'],
      where: { certificationId: { in: certIds } },
      _count: { id: true },
    });

    const certMap = new Map<
      string,
      { code: string; name: string; reviewed: number; total: number; masteryLevels: string[] }
    >();

    for (const r of reviews) {
      const certId = r.question.certificationId;
      if (!certMap.has(certId)) {
        certMap.set(certId, {
          code: r.question.certification.code,
          name: r.question.certification.name,
          reviewed: 0,
          total: 0,
          masteryLevels: [],
        });
      }
      const entry = certMap.get(certId)!;
      entry.reviewed++;
      entry.masteryLevels.push(r.mastery);
    }

    certTotals.forEach((ct) => {
      const entry = certMap.get(ct.certificationId);
      if (entry) {
        entry.total = ct._count.id;
      }
    });

    const result = Array.from(certMap.entries()).map(([certId, data]) => {
      const masteryFreq = data.masteryLevels.reduce(
        (acc, m) => {
          acc[m] = (acc[m] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      );
      const domMastery = Object.entries(masteryFreq).sort(([, a], [, b]) => b - a)[0]?.[0] || 'NEW';

      return {
        certificationId: certId,
        code: data.code,
        name: data.name,
        progress: data.total > 0 ? Math.round((data.reviewed / data.total) * 100) : 0,
        mastery: domMastery === 'MASTERED' ? 'Mastered' : domMastery === 'REVIEW' ? 'Review' : 'Learning',
      };
    });

    return result.sort((a, b) => b.progress - a.progress);
  }
}
