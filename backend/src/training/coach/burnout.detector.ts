import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

interface BurnoutSignalInput {
  userId: string;
  certificationId?: string;
  signals: Array<{
    signal: string;
    score: number;
    metadata: Record<string, any>;
  }>;
}

interface BurnoutResult {
  severity: 'low' | 'medium' | 'high' | 'critical';
  signals: any[];
  recommendedAction: string;
}

@Injectable()
export class BurnoutDetector {
  private readonly logger = new Logger(BurnoutDetector.name);
  private readonly SCORE_THRESHOLDS = {
    low: 0.3,
    medium: 0.5,
    high: 0.7,
    critical: 0.85,
  };

  constructor(private prisma: PrismaService) {}

  async detectBurnout(input: BurnoutSignalInput): Promise<BurnoutResult> {
    const weights = {
      scoreDecline: 0.35, // Score trending downward
      timeAllocation: 0.25, // Study time is excessive
      attemptFrequency: 0.2, // Too many attempts in short time
      errorRate: 0.2, // Mistakes increasing
    };

    let weightedScore = 0;
    const processedSignals = [];

    for (const signal of input.signals) {
      const weight = weights[signal.signal as keyof typeof weights] || 0;
      const contribution = signal.score * weight;
      weightedScore += contribution;

      processedSignals.push({
        signal: signal.signal,
        score: signal.score,
        weight,
        contribution,
        metadata: signal.metadata,
      });
    }

    const severity = this.calculateSeverity(weightedScore);
    const recommendedAction = this.getRecommendedAction(
      severity,
      processedSignals,
    );

    // Persist burnout signal
    if (severity !== 'low') {
      await this.prisma.burnoutSignal.create({
        data: {
          userId: input.userId,
          certificationId: input.certificationId,
          severity,
          signals: processedSignals,
          recommendedAction,
        },
      });

      this.logger.warn(
        `Burnout detected for user ${input.userId}: ${severity} (score: ${weightedScore.toFixed(2)})`,
      );
    }

    return {
      severity,
      signals: processedSignals,
      recommendedAction,
    };
  }

  private calculateSeverity(
    score: number,
  ): 'low' | 'medium' | 'high' | 'critical' {
    if (score >= this.SCORE_THRESHOLDS.critical) return 'critical';
    if (score >= this.SCORE_THRESHOLDS.high) return 'high';
    if (score >= this.SCORE_THRESHOLDS.medium) return 'medium';
    return 'low';
  }

  private getRecommendedAction(severity: string, signals: any[]): string {
    const signalMap = new Map(signals.map((s) => [s.signal, s.score]));
    const scoreDecline = signalMap.get('scoreDecline') ?? 0;
    const timeAllocation = signalMap.get('timeAllocation') ?? 0;
    const attemptFrequency = signalMap.get('attemptFrequency') ?? 0;
    const errorRate = signalMap.get('errorRate') ?? 0;

    // Critical pattern: both score decline and high attempt frequency
    if (scoreDecline > 0.8 && attemptFrequency > 0.8) {
      return 'ESCALATE_TO_COACH_INTERVENTION';
    }

    // Overwork pattern: low time allocation (not studying enough) but high errors
    if (timeAllocation < 0.3 && errorRate > 0.7) {
      return 'SUGGEST_BREAK';
    }

    // Focused support: score decline but normal attempt frequency
    if (scoreDecline > 0.6 && attemptFrequency <= 0.5) {
      return 'SUGGEST_COACH_CONVERSATION';
    }

    // Default severity-based fallback
    if (severity === 'critical') {
      return 'ESCALATE_TO_COACH_INTERVENTION';
    }
    if (severity === 'high') {
      return 'SUGGEST_COACH_CONVERSATION';
    }
    if (severity === 'medium') {
      return 'MONITOR_CLOSELY';
    }
    return 'NO_ACTION';
  }

  async checkUserBurnout(userId: string): Promise<BurnoutResult | null> {
    // Get recent attempt events
    const recentAttempts = await this.prisma.attemptEvent.findMany({
      where: {
        userId,
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    if (recentAttempts.length === 0) {
      return null;
    }

    // Analyze patterns
    const scoreDeclineScore = this.analyzeScoreDecline(recentAttempts);
    const timeAllocationScore = this.analyzeTimeAllocation(recentAttempts);
    const attemptFrequencyScore = this.analyzeAttemptFrequency(recentAttempts);
    const errorRateScore = this.analyzeErrorRate(recentAttempts);

    return this.detectBurnout({
      userId,
      signals: [
        {
          signal: 'scoreDecline',
          score: scoreDeclineScore,
          metadata: { trend: 'downward' },
        },
        {
          signal: 'timeAllocation',
          score: timeAllocationScore,
          metadata: { hoursPerDay: 'excessive' },
        },
        {
          signal: 'attemptFrequency',
          score: attemptFrequencyScore,
          metadata: { frequency: 'high' },
        },
        {
          signal: 'errorRate',
          score: errorRateScore,
          metadata: { trend: 'increasing' },
        },
      ],
    });
  }

  private analyzeScoreDecline(attempts: any[]): number {
    if (attempts.length < 3) return 0;

    const scores = attempts
      .filter((a) => a.payload?.score !== undefined)
      .map((a) => a.payload.score);

    if (scores.length < 3) return 0;

    // Calculate trend: is score declining?
    const recent = scores.slice(0, 3);
    const older = scores.slice(-3);

    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;

    const decline = Math.max(0, (olderAvg - recentAvg) / olderAvg);
    return Math.min(1, decline);
  }

  private analyzeTimeAllocation(attempts: any[]): number {
    if (attempts.length < 5) return 0;

    const last24h = attempts.filter(
      (a) => a.createdAt > new Date(Date.now() - 24 * 60 * 60 * 1000),
    );

    // If more than 10 attempts in 24h, flag as excessive
    const score = Math.min(1, last24h.length / 10);
    return score;
  }

  private analyzeAttemptFrequency(attempts: any[]): number {
    if (attempts.length < 5) return 0;

    // Count attempts in last 3 days
    const last3Days = attempts.filter(
      (a) => a.createdAt > new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    );

    // If more than 20 in 3 days, flag as high frequency
    const score = Math.min(1, last3Days.length / 20);
    return score;
  }

  private analyzeErrorRate(attempts: any[]): number {
    const recentAttempts = attempts.slice(0, 10);
    if (recentAttempts.length === 0) return 0;

    const errors = recentAttempts.filter((a) => {
      const isCorrect = a.payload?.isCorrect;
      return isCorrect === false;
    });

    return Math.min(1, errors.length / recentAttempts.length);
  }
}
