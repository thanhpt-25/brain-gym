import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AttemptStatus } from '@prisma/client';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(userId: string, certificationId?: string) {
    const where: any = { userId, status: AttemptStatus.SUBMITTED };
    if (certificationId) {
      where.exam = { certificationId };
    }

    const attempts = await this.prisma.examAttempt.findMany({
      where,
      select: {
        score: true,
        totalCorrect: true,
        totalQuestions: true,
        timeSpent: true,
        domainScores: true,
        exam: {
          select: { certificationId: true },
        },
      },
    });

    if (attempts.length === 0) {
      return {
        totalExams: 0,
        totalPassed: 0,
        passRate: 0,
        avgScore: 0,
        bestScore: 0,
        totalStudyTime: 0,
        totalQuestions: 0,
      };
    }

    const scores = attempts.map(a => Number(a.score ?? 0));
    const totalPassed = scores.filter(s => s >= 70).length;

    return {
      totalExams: attempts.length,
      totalPassed,
      passRate: Math.round((totalPassed / attempts.length) * 100),
      avgScore: Math.round(scores.reduce((s, v) => s + v, 0) / scores.length),
      bestScore: Math.round(Math.max(...scores)),
      totalStudyTime: attempts.reduce((s, a) => s + (a.timeSpent ?? 0), 0),
      totalQuestions: attempts.reduce((s, a) => s + (a.totalQuestions ?? 0), 0),
    };
  }

  async getHistory(userId: string, certificationId?: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const where: any = { userId, status: AttemptStatus.SUBMITTED };
    if (certificationId) {
      where.exam = { certificationId };
    }

    const [total, attempts] = await Promise.all([
      this.prisma.examAttempt.count({ where }),
      this.prisma.examAttempt.findMany({
        where,
        include: {
          exam: {
            include: {
              certification: { select: { id: true, name: true, code: true, provider: true } },
            },
          },
        },
        orderBy: { submittedAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return {
      data: attempts.map(a => ({
        id: a.id,
        examTitle: a.exam.title,
        certification: a.exam.certification,
        score: Math.round(Number(a.score ?? 0)),
        totalCorrect: a.totalCorrect ?? 0,
        totalQuestions: a.totalQuestions ?? 0,
        passed: Number(a.score ?? 0) >= 70,
        timeSpent: a.timeSpent ?? 0,
        domainScores: a.domainScores as Record<string, { correct: number; total: number }> | null,
        startedAt: a.startedAt,
        submittedAt: a.submittedAt,
      })),
      meta: { total, page, lastPage: Math.ceil(total / limit) },
    };
  }

  async getDomains(userId: string, certificationId?: string) {
    const where: any = { userId, status: AttemptStatus.SUBMITTED };
    if (certificationId) {
      where.exam = { certificationId };
    }

    const attempts = await this.prisma.examAttempt.findMany({
      where,
      select: { domainScores: true },
    });

    // Aggregate domain scores across all attempts
    const agg: Record<string, { correct: number; total: number }> = {};
    for (const a of attempts) {
      const ds = a.domainScores as Record<string, { correct: number; total: number }> | null;
      if (!ds) continue;
      for (const [domain, { correct, total }] of Object.entries(ds)) {
        if (!agg[domain]) agg[domain] = { correct: 0, total: 0 };
        agg[domain].correct += correct;
        agg[domain].total += total;
      }
    }

    return Object.entries(agg)
      .map(([domain, { correct, total }]) => ({
        domain,
        correct,
        total,
        percentage: total > 0 ? Math.round((correct / total) * 100) : 0,
      }))
      .sort((a, b) => a.percentage - b.percentage);
  }

  async getWeakTopics(userId: string, certificationId?: string, topN = 5) {
    const domains = await this.getDomains(userId, certificationId);
    return domains.slice(0, topN);
  }

  async getQuestionStats(questionId: string) {
    const question = await this.prisma.question.findUnique({
      where: { id: questionId },
      select: { attemptCount: true, correctCount: true },
    });

    const answers = await this.prisma.answer.findMany({
      where: { questionId },
      select: { isCorrect: true },
    });

    const totalAttempts = answers.length;
    const totalCorrect = answers.filter(a => a.isCorrect).length;

    return {
      questionId,
      totalAttempts,
      totalCorrect,
      correctRate: totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : 0,
    };
  }
}
