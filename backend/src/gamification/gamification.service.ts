import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AttemptStatus } from '@prisma/client';

export const POINTS = {
  CREATE_QUESTION: 10,
  VOTE_QUESTION: 5,
  COMPLETE_EXAM: 3,
  QUESTION_APPROVED: 15,
} as const;

interface BadgeDef {
  name: string;
  description: string;
  check: (stats: UserStats) => boolean;
}

interface UserStats {
  questionsCreated: number;
  examsPassed90: number;
  points: number;
  examsCompleted: number;
}

const BADGE_DEFS: BadgeDef[] = [
  {
    name: 'Exam Creator',
    description: 'Created 10+ questions',
    check: (s) => s.questionsCreated >= 10,
  },
  {
    name: 'Cloud Master',
    description: 'Passed 5+ exams with 90%+',
    check: (s) => s.examsPassed90 >= 5,
  },
  {
    name: 'Top Contributor',
    description: 'Earned 500+ points',
    check: (s) => s.points >= 500,
  },
  {
    name: 'First Steps',
    description: 'Completed first exam',
    check: (s) => s.examsCompleted >= 1,
  },
  {
    name: 'Dedicated Learner',
    description: 'Completed 20+ exams',
    check: (s) => s.examsCompleted >= 20,
  },
];

@Injectable()
export class GamificationService {
  constructor(private readonly prisma: PrismaService) {}

  async awardPoints(userId: string, amount: number) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { points: { increment: amount } },
      select: { id: true, points: true },
    });
    // Check badges after awarding points
    await this.checkAndAwardBadges(userId);
    return user;
  }

  async checkAndAwardBadges(userId: string) {
    const [user, questionsCreated, examsCompleted, examsPassed90] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId }, select: { points: true } }),
      this.prisma.question.count({ where: { createdBy: userId } }),
      this.prisma.examAttempt.count({ where: { userId, status: AttemptStatus.SUBMITTED } }),
      this.prisma.examAttempt.count({
        where: { userId, status: AttemptStatus.SUBMITTED, score: { gte: 90 } },
      }),
    ]);

    if (!user) return;

    const stats: UserStats = {
      questionsCreated,
      examsPassed90,
      points: user.points,
      examsCompleted,
    };

    for (const def of BADGE_DEFS) {
      if (!def.check(stats)) continue;

      // Ensure badge exists in DB
      let badge = await this.prisma.badge.findFirst({ where: { name: def.name } });
      if (!badge) {
        badge = await this.prisma.badge.create({
          data: { name: def.name, description: def.description },
        });
      }

      // Award if not already awarded
      await this.prisma.badgeAward.upsert({
        where: { userId_badgeId: { userId, badgeId: badge.id } },
        create: { userId, badgeId: badge.id },
        update: {},
      });
    }
  }

  async getLeaderboard(certificationId?: string, limit = 20) {
    // If certificationId is provided, rank by best score in that cert's exams
    if (certificationId) {
      const entries = await this.prisma.$queryRaw<
        { userId: string; displayName: string; avatarUrl: string | null; bestScore: number; avgScore: number; totalExams: number; points: number }[]
      >`
        SELECT
          u.id as "userId",
          u.display_name as "displayName",
          u.avatar_url as "avatarUrl",
          ROUND(MAX(ea.score)::numeric) as "bestScore",
          ROUND(AVG(ea.score)::numeric) as "avgScore",
          COUNT(ea.id)::int as "totalExams",
          u.points
        FROM exam_attempts ea
        JOIN exams e ON ea.exam_id = e.id
        JOIN users u ON ea.user_id = u.id
        WHERE ea.status = 'SUBMITTED'
          AND e.certification_id = ${certificationId}
        GROUP BY u.id, u.display_name, u.avatar_url, u.points
        ORDER BY "bestScore" DESC, "avgScore" DESC
        LIMIT ${limit}
      `;
      return entries.map((e, i) => ({
        rank: i + 1,
        ...e,
        bestScore: Number(e.bestScore),
        avgScore: Number(e.avgScore),
      }));
    }

    // Global leaderboard by points
    const users = await this.prisma.user.findMany({
      where: { points: { gt: 0 } },
      select: {
        id: true,
        displayName: true,
        avatarUrl: true,
        points: true,
        _count: {
          select: {
            questions: true,
            examAttempts: { where: { status: AttemptStatus.SUBMITTED } },
          },
        },
      },
      orderBy: { points: 'desc' },
      take: limit,
    });

    return users.map((u, i) => ({
      rank: i + 1,
      userId: u.id,
      displayName: u.displayName,
      avatarUrl: u.avatarUrl,
      points: u.points,
      questionsCreated: u._count.questions,
      examsCompleted: u._count.examAttempts,
    }));
  }

  async getBadges() {
    return this.prisma.badge.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async getUserBadges(userId: string) {
    const awards = await this.prisma.badgeAward.findMany({
      where: { userId },
      include: { badge: true },
      orderBy: { awardedAt: 'desc' },
    });
    return awards.map(a => ({
      id: a.badge.id,
      name: a.badge.name,
      description: a.badge.description,
      iconUrl: a.badge.iconUrl,
      awardedAt: a.awardedAt,
    }));
  }

  async getUserPoints(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { points: true },
    });
    return { points: user?.points ?? 0 };
  }
}
