import { ApiProperty } from '@nestjs/swagger';

export class DomainResult {
  @ApiProperty()
  domainId: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  correct: number;

  @ApiProperty()
  total: number;

  @ApiProperty()
  percentage: number;
}

export class TrendPoint {
  @ApiProperty()
  attemptId: string;

  @ApiProperty({ nullable: true, type: Date })
  submittedAt: Date | null;

  @ApiProperty()
  score: number;

  @ApiProperty({ description: 'Domain name → { correct, total }' })
  domainScores: Record<string, { correct: number; total: number }>;
}

export class Readiness {
  @ApiProperty({ description: 'Rasch ability estimate (logit scale)' })
  ability: number;

  @ApiProperty()
  standardError: number;

  @ApiProperty({ description: 'Distinct questions the estimate is based on' })
  basedOnQuestions: number;

  @ApiProperty({
    nullable: true,
    type: Number,
    description: 'Estimated % chance to pass an exam of examLength questions',
  })
  passLikelihood: number | null;

  @ApiProperty()
  passingScore: number;

  @ApiProperty()
  examLength: number;
}

/** GET /attempts/:id/insights */
export class AttemptInsightsResponse {
  @ApiProperty()
  attemptId: string;

  @ApiProperty()
  certificationId: string;

  @ApiProperty({ description: 'Wrong or skipped questions' })
  missedCount: number;

  @ApiProperty()
  skippedCount: number;

  @ApiProperty()
  flaggedCount: number;

  @ApiProperty({ type: [DomainResult] })
  domains: DomainResult[];

  @ApiProperty({ type: DomainResult, nullable: true })
  weakestDomain: DomainResult | null;

  @ApiProperty({ type: [TrendPoint], description: 'Oldest first' })
  trend: TrendPoint[];

  @ApiProperty({ type: Readiness })
  readiness: Readiness;
}
