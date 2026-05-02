import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MasteryResponseDto, DomainMasteryDto } from './mastery.dto';
import Redis from 'ioredis';

const CACHE_TTL_SECONDS = 60;

function buildCacheKey(userId: string, certificationId: string): string {
  return `mastery:${userId}:${certificationId}`;
}

@Injectable()
export class MasteryService {
  private readonly logger = new Logger(MasteryService.name);
  private readonly redis: Redis;

  constructor(private readonly prisma: PrismaService) {
    this.redis = new Redis({
      host: process.env.REDIS_HOST ?? 'localhost',
      port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
      lazyConnect: true,
    });
    this.redis.on('error', (err) => {
      this.logger.warn(`Redis error (mastery cache): ${err.message}`);
    });
  }

  async getMastery(
    userId: string,
    certificationId: string,
  ): Promise<MasteryResponseDto> {
    const cacheKey = buildCacheKey(userId, certificationId);

    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached) as MasteryResponseDto;
      }
    } catch {
      this.logger.warn('Redis read failed, falling through to DB');
    }

    const result = await this.computeMastery(userId, certificationId);

    try {
      await this.redis.set(
        cacheKey,
        JSON.stringify(result),
        'EX',
        CACHE_TTL_SECONDS,
      );
    } catch {
      this.logger.warn('Redis write failed, returning uncached result');
    }

    return result;
  }

  private async computeMastery(
    userId: string,
    certificationId: string,
  ): Promise<MasteryResponseDto> {
    // 1. Load all submitted attempts for this user + cert
    const attempts = await this.prisma.examAttempt.findMany({
      where: {
        userId,
        status: 'SUBMITTED',
        exam: { certificationId },
      },
      select: { id: true },
    });

    if (attempts.length < 10) {
      return {
        certificationId,
        totalAttempts: attempts.length,
        isEmpty: true,
        domains: [],
      };
    }

    const attemptIds = attempts.map((a) => a.id);

    // 2. Aggregate per-domain accuracy from Answer rows
    const answers = await this.prisma.answer.findMany({
      where: { attemptId: { in: attemptIds } },
      select: {
        isCorrect: true,
        question: {
          select: {
            domainId: true,
            domain: { select: { id: true, name: true } },
          },
        },
      },
    });

    // 3. Load domains for the certification to have full domain list
    const certDomains = await this.prisma.domain.findMany({
      where: { certificationId },
      select: { id: true, name: true },
    });

    // 4. Build accuracy map keyed by domainId
    const accuracyMap = new Map<
      string,
      { name: string; correct: number; total: number }
    >();
    for (const domain of certDomains) {
      accuracyMap.set(domain.id, { name: domain.name, correct: 0, total: 0 });
    }

    for (const answer of answers) {
      const domId = answer.question?.domainId;
      if (!domId) continue;
      const entry = accuracyMap.get(domId);
      if (!entry) continue;
      entry.total += 1;
      if (answer.isCorrect) entry.correct += 1;
    }

    // 5. Load SRS schedules for this user, scoped to questions in the cert
    const schedules = await this.prisma.reviewSchedule.findMany({
      where: {
        userId,
        question: { certificationId },
      },
      select: {
        nextReviewDate: true,
        question: { select: { domainId: true } },
      },
    });

    // Count total approved questions per domain for coverage denominator
    const questionCountsRaw = await this.prisma.question.groupBy({
      by: ['domainId'],
      where: {
        certificationId,
        status: 'APPROVED',
        domainId: { not: null },
        deletedAt: null,
      },
      _count: { id: true },
    });
    const questionCountByDomain = new Map<string, number>();
    for (const row of questionCountsRaw) {
      if (row.domainId) {
        questionCountByDomain.set(row.domainId, row._count.id);
      }
    }

    // Build SRS coverage + due-count map
    const srsMap = new Map<string, { covered: number; due: number }>();
    const now = new Date();
    for (const sched of schedules) {
      const domId = sched.question?.domainId;
      if (!domId) continue;
      const entry = srsMap.get(domId) ?? { covered: 0, due: 0 };
      entry.covered += 1;
      if (sched.nextReviewDate <= now) entry.due += 1;
      srsMap.set(domId, entry);
    }

    // 6. Compose domain DTOs
    const domains: DomainMasteryDto[] = certDomains.map((domain) => {
      const acc = accuracyMap.get(domain.id) ?? {
        name: domain.name,
        correct: 0,
        total: 0,
      };
      const srs = srsMap.get(domain.id) ?? { covered: 0, due: 0 };
      const totalQuestions = questionCountByDomain.get(domain.id) ?? 0;
      const srsCoverage =
        totalQuestions > 0
          ? parseFloat((srs.covered / totalQuestions).toFixed(3))
          : 0;
      const accuracy =
        acc.total > 0 ? Math.round((acc.correct / acc.total) * 100) : 0;

      return {
        domainId: domain.id,
        domainName: domain.name,
        accuracy,
        totalAnswered: acc.total,
        totalCorrect: acc.correct,
        srsCoverage,
        dueCount: srs.due,
      };
    });

    return {
      certificationId,
      totalAttempts: attempts.length,
      isEmpty: false,
      domains,
    };
  }
}
