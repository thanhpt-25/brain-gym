import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AttemptStatus } from '@prisma/client';

export interface DomainBreakdownEntry {
  domainId: string;
  domainName: string;
  userAccuracy: number | null;
  cohortAccuracy: number | null;
}

export interface BenchmarkDto {
  userId: string;
  certificationId: string;
  userScore: number;
  percentile: number | null;
  cohortSize: number | null;
  top10PctScore: number | null;
  averageScore: number | null;
  domainBreakdown: DomainBreakdownEntry[];
  hiddenReason?: string;
}

/** Minimum cohort size before we reveal benchmark data (k-anonymity Gate 3) */
const K_ANONYMITY_THRESHOLD = 10;

interface DomainScoreMap {
  [domainId: string]: { correct: number; total: number; name?: string };
}

@Injectable()
export class BenchmarkService {
  private readonly logger = new Logger(BenchmarkService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Compute the caller's percentile against the passers-only cohort for one cert.
   * Cohort = SUBMITTED attempts with score >= cert.passingScore (de-duped to best-per-user).
   * Cohort stats are hidden when n < K_ANONYMITY_THRESHOLD (Gate 3).
   */
  async getBenchmark(
    userId: string,
    certificationId: string,
  ): Promise<BenchmarkDto> {
    const passingScore = 70;

    // Passers-only cohort: submitted + score >= passingScore, joined through Exam
    const attempts = await this.prisma.examAttempt.findMany({
      where: {
        status: AttemptStatus.SUBMITTED,
        score: { gte: passingScore },
        exam: { certificationId },
      },
      select: { userId: true, score: true, domainScores: true },
    });

    const bestByUser = this.deduplicateBestPerUser(attempts);
    return this.computeDto(userId, certificationId, bestByUser);
  }

  /**
   * Bulk benchmark for all certifications the user has a submitted attempt in.
   * Batches all DB queries to avoid N+1.
   */
  async getAllBenchmarks(userId: string): Promise<BenchmarkDto[]> {
    const userAttempts = await this.prisma.examAttempt.findMany({
      where: { userId, status: AttemptStatus.SUBMITTED },
      select: { exam: { select: { certificationId: true } } },
    });

    const certIds = [
      ...new Set(userAttempts.map((a) => a.exam.certificationId)),
    ];
    if (!certIds.length) return [];

    const passingScoreMap = new Map(
      certIds.map((id) => [id, 70]),
    );

    // Single batch query for all attempts across relevant certs
    const allAttempts = await this.prisma.examAttempt.findMany({
      where: {
        status: AttemptStatus.SUBMITTED,
        exam: { certificationId: { in: certIds } },
      },
      select: {
        userId: true,
        score: true,
        domainScores: true,
        exam: { select: { certificationId: true } },
      },
    });

    // Group by certificationId
    const byCert = new Map<
      string,
      { userId: string; score: unknown; domainScores: unknown }[]
    >();
    for (const a of allAttempts) {
      const certId = a.exam.certificationId;
      if (!byCert.has(certId)) byCert.set(certId, []);
      byCert.get(certId)!.push(a);
    }

    return certIds.map((certificationId) => {
      const attempts = byCert.get(certificationId) ?? [];
      const passingScore = passingScoreMap.get(certificationId) ?? 70;

      const passers = attempts.filter(
        (a) => Number(a.score ?? 0) >= passingScore,
      );
      const bestByUser = this.deduplicateBestPerUser(passers);
      return this.computeDto(userId, certificationId, bestByUser);
    });
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private deduplicateBestPerUser(
    attempts: { userId: string; score: unknown; domainScores: unknown }[],
  ): Map<string, { score: number; domainScores: unknown }> {
    const bestByUser = new Map<
      string,
      { score: number; domainScores: unknown }
    >();
    for (const a of attempts) {
      const sc = Number(a.score ?? 0);
      const existing = bestByUser.get(a.userId);
      if (!existing || sc > existing.score) {
        bestByUser.set(a.userId, { score: sc, domainScores: a.domainScores });
      }
    }
    return bestByUser;
  }

  private computeDto(
    userId: string,
    certificationId: string,
    bestByUser: Map<string, { score: number; domainScores: unknown }>,
  ): BenchmarkDto {
    const cohortScores = [...bestByUser.values()].map((v) => v.score);
    const cohortSize = cohortScores.length;
    const userEntry = bestByUser.get(userId);
    const userScore = userEntry?.score ?? 0;

    if (cohortSize < K_ANONYMITY_THRESHOLD) {
      return {
        userId,
        certificationId,
        userScore,
        percentile: null,
        cohortSize: null,
        top10PctScore: null,
        averageScore: null,
        domainBreakdown: [],
        hiddenReason: `Cohort too small (n=${cohortSize}); minimum ${K_ANONYMITY_THRESHOLD} required`,
      };
    }

    const sorted = [...cohortScores].sort((a, b) => a - b);
    const below = sorted.filter((s) => s < userScore).length;
    const percentile = Math.round((below / cohortSize) * 100);
    const top10Idx = Math.floor(cohortSize * 0.9);
    const top10PctScore = sorted[top10Idx] ?? sorted[sorted.length - 1];
    const averageScore =
      Math.round((sorted.reduce((acc, s) => acc + s, 0) / cohortSize) * 10) /
      10;

    const domainBreakdown = this.computeDomainBreakdown(
      userEntry?.domainScores,
      [...bestByUser.values()].map((v) => v.domainScores),
    );

    return {
      userId,
      certificationId,
      userScore,
      percentile,
      cohortSize,
      top10PctScore,
      averageScore,
      domainBreakdown,
    };
  }

  private computeDomainBreakdown(
    userDomainScores: unknown,
    cohortDomainScores: unknown[],
  ): DomainBreakdownEntry[] {
    if (!userDomainScores || typeof userDomainScores !== 'object') return [];

    const userMap = userDomainScores as DomainScoreMap;
    const domainIds = Object.keys(userMap);
    if (!domainIds.length) return [];

    const cohortByDomain = new Map<string, number[]>();
    for (const raw of cohortDomainScores) {
      if (!raw || typeof raw !== 'object') continue;
      const m = raw as DomainScoreMap;
      for (const [domainId, v] of Object.entries(m)) {
        if (!v.total) continue;
        if (!cohortByDomain.has(domainId)) cohortByDomain.set(domainId, []);
        cohortByDomain.get(domainId)!.push(v.correct / v.total);
      }
    }

    return domainIds.map((domainId) => {
      const d = userMap[domainId];
      const userAccuracy = d.total
        ? Math.round((d.correct / d.total) * 100)
        : null;

      const cohortArr = cohortByDomain.get(domainId) ?? [];
      const cohortAccuracy =
        cohortArr.length >= K_ANONYMITY_THRESHOLD
          ? Math.round(
              (cohortArr.reduce((a, b) => a + b, 0) / cohortArr.length) * 100,
            )
          : null;

      return {
        domainId,
        domainName: d.name ?? domainId,
        userAccuracy,
        cohortAccuracy,
      };
    });
  }
}
