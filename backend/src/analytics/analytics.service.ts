import { Injectable, ForbiddenException, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AttemptStatus, MistakeType } from '@prisma/client';
import { UpdateMistakeTypeDto } from './dto/update-mistake-type.dto';

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

  async getReadiness(userId: string, certificationId: string) {
    const certification = await this.prisma.certification.findUnique({
      where: { id: certificationId },
    });
    if (!certification) {
      throw new Error('Certification not found');
    }

    const attempts = await this.prisma.examAttempt.findMany({
      where: {
        userId,
        status: AttemptStatus.SUBMITTED,
        exam: { certificationId },
      },
      select: {
        score: true,
        submittedAt: true,
        domainScores: true,
      },
      orderBy: { submittedAt: 'desc' },
    });

    if (attempts.length === 0) {
      return {
        readinessScore: 0,
        domainConfidences: [],
        totalExams: 0,
        weightedAvgScore: 0,
      };
    }

    const now = new Date();
    let totalWeight = 0;
    let weightedScoreSum = 0;

    const domainAgg: Record<string, { correct: number; total: number }> = {};

    attempts.forEach(attempt => {
      const daysSince = Math.max(
        0,
        (now.getTime() - new Date(attempt.submittedAt!).getTime()) / (1000 * 60 * 60 * 24),
      );
      const weight = Math.exp(-0.05 * daysSince);
      totalWeight += weight;
      weightedScoreSum += Number(attempt.score ?? 0) * weight;

      const ds = attempt.domainScores as Record<string, { correct: number; total: number }> | null;
      if (ds) {
        for (const [domain, { correct, total }] of Object.entries(ds)) {
          if (!domainAgg[domain]) domainAgg[domain] = { correct: 0, total: 0 };
          domainAgg[domain].correct += correct;
          domainAgg[domain].total += total;
        }
      }
    });

    const weightedAvgScore = weightedScoreSum / totalWeight;
    const domainConfidences = Object.entries(domainAgg).map(([domain, { correct, total }]) => ({
      domain,
      confidence: total > 0 ? Math.round((correct / total) * 100) : 0,
    }));

    const minDomainConfidence = domainConfidences.length > 0 
      ? Math.min(...domainConfidences.map(d => d.confidence))
      : 0;
    
    const examCountFactor = Math.min(attempts.length / 5, 1) * 100;

    const readinessScore = Math.round(
      0.6 * weightedAvgScore + 
      0.2 * minDomainConfidence + 
      0.2 * examCountFactor
    );

    return {
      readinessScore: Math.min(100, Math.max(0, readinessScore)),
      domainConfidences,
      totalExams: attempts.length,
      weightedAvgScore: Math.round(weightedAvgScore),
    };
  }

  async updateMistakeType(userId: string, answerId: string, dto: UpdateMistakeTypeDto) {
    const answer = await this.prisma.answer.findUnique({
      where: { id: answerId },
      include: { attempt: true },
    });

    if (!answer) {
      throw new NotFoundException('Answer not found');
    }

    if (answer.attempt.userId !== userId) {
      throw new ForbiddenException('You do not have permission to update this answer');
    }

    if (answer.isCorrect) {
      throw new BadRequestException('Cannot tag a correct answer with a mistake type');
    }

    return this.prisma.answer.update({
      where: { id: answerId },
      data: { mistakeType: dto.mistakeType },
    });
  }

  async getMistakePatterns(userId: string, certificationId?: string) {
    const where: any = {
      attempt: { userId },
      mistakeType: { not: null },
    };

    if (certificationId) {
      where.attempt.exam = { certificationId };
    }

    const mistakes = await this.prisma.answer.findMany({
      where,
      select: { mistakeType: true },
    });

    const breakdown: Record<MistakeType, number> = {
      CONCEPT: 0,
      CARELESS: 0,
      TRAP: 0,
      TIME_PRESSURE: 0,
    };

    mistakes.forEach(m => {
      if (m.mistakeType) {
        breakdown[m.mistakeType]++;
      }
    });

    return {
      total: mistakes.length,
      breakdown,
    };
  }
}
