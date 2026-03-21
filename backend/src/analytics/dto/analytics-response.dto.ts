import { ApiProperty } from '@nestjs/swagger';
import { MistakeType } from '@prisma/client';

export class AnalyticsSummaryResponse {
  @ApiProperty()
  totalExams: number;

  @ApiProperty()
  totalPassed: number;

  @ApiProperty()
  passRate: number;

  @ApiProperty()
  avgScore: number;

  @ApiProperty()
  bestScore: number;

  @ApiProperty()
  totalStudyTime: number;

  @ApiProperty()
  totalQuestions: number;
}

export class HistoryItemResponse {
  @ApiProperty()
  id: string;

  @ApiProperty()
  examTitle: string;

  @ApiProperty()
  certification: any;

  @ApiProperty()
  score: number;

  @ApiProperty()
  totalCorrect: number;

  @ApiProperty()
  totalQuestions: number;

  @ApiProperty()
  passed: boolean;

  @ApiProperty()
  timeSpent: number;

  @ApiProperty({ required: false })
  domainScores?: Record<string, { correct: number; total: number }>;

  @ApiProperty()
  startedAt: Date;

  @ApiProperty({ required: false })
  submittedAt?: Date;
}

export class AnalyticsHistoryResponse {
  @ApiProperty({ type: [HistoryItemResponse] })
  data: HistoryItemResponse[];

  @ApiProperty()
  meta: {
    total: number;
    page: number;
    lastPage: number;
  };
}

export class DomainStatsResponse {
  @ApiProperty()
  domain: string;

  @ApiProperty()
  correct: number;

  @ApiProperty()
  total: number;

  @ApiProperty()
  percentage: number;
}

export class ReadinessResponse {
  @ApiProperty()
  readinessScore: number;

  @ApiProperty()
  domainConfidences: { domain: string; confidence: number }[];

  @ApiProperty()
  totalExams: number;

  @ApiProperty()
  weightedAvgScore: number;
}

export class MistakePatternsResponse {
  @ApiProperty()
  total: number;

  @ApiProperty()
  breakdown: Record<MistakeType, number>;
}
