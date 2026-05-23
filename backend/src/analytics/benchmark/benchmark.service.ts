import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface BenchmarkDto {
  userId: string;
  certificationId: string;
  userScore: number;
  percentile: number | null; // null when cohort is below k-anonymity threshold
  cohortSize: number | null; // null when below threshold
  top10PctScore: number | null;
  averageScore: number | null;
  hiddenReason?: string;
}

/** Minimum cohort size before we reveal benchmark data (k-anonymity Gate 3) */
const K_ANONYMITY_THRESHOLD = 10;

@Injectable()
export class BenchmarkService {
  private readonly logger = new Logger(BenchmarkService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Compute the caller's percentile rank against all users who have a
   * ReadinessScore for the given certification.
   *
   * Returns null percentile/cohort stats when the cohort is smaller than
   * K_ANONYMITY_THRESHOLD to protect user privacy (Gate 3).
   */
  async getBenchmark(
    userId: string,
    certificationId: string,
  ): Promise<BenchmarkDto> {
    // Fetch all scores for this cert (including caller's)
    const allScores = await this.prisma.readinessScore.findMany({
      where: { certificationId },
      select: { userId: true, score: true },
    });

    const userRecord = allScores.find((s) => s.userId === userId);
    const userScore = userRecord?.score ?? 0;

    const cohortSize = allScores.length;

    // k-anonymity gate: hide stats when cohort too small
    if (cohortSize < K_ANONYMITY_THRESHOLD) {
      return {
        userId,
        certificationId,
        userScore,
        percentile: null,
        cohortSize: null,
        top10PctScore: null,
        averageScore: null,
        hiddenReason: `Cohort too small (n=${cohortSize}); minimum ${K_ANONYMITY_THRESHOLD} required`,
      };
    }

    const sorted = allScores.map((s) => s.score).sort((a, b) => a - b);

    // Percentile = proportion of cohort the user beats
    const below = sorted.filter((s) => s < userScore).length;
    const percentile = Math.round((below / cohortSize) * 100);

    // Top-10% threshold
    const top10Idx = Math.floor(cohortSize * 0.9);
    const top10PctScore = sorted[top10Idx] ?? sorted[sorted.length - 1];

    const averageScore =
      Math.round((sorted.reduce((acc, s) => acc + s, 0) / cohortSize) * 10) /
      10;

    return {
      userId,
      certificationId,
      userScore,
      percentile,
      cohortSize,
      top10PctScore,
      averageScore,
    };
  }

  /**
   * Bulk benchmark for all certifications the user has a score in.
   */
  async getAllBenchmarks(userId: string): Promise<BenchmarkDto[]> {
    const userScores = await this.prisma.readinessScore.findMany({
      where: { userId },
      select: { certificationId: true },
    });

    const results = await Promise.all(
      userScores.map((s) => this.getBenchmark(userId, s.certificationId)),
    );

    return results;
  }
}
