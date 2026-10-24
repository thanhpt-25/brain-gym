import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AttemptResultResponse } from './attempt-result.dto';

export class CatProgress {
  @ApiProperty({ description: 'Questions answered so far' })
  answered: number;

  @ApiProperty({ description: 'The test cannot stop on precision before this' })
  minItems: number;

  @ApiProperty({ description: 'The test stops after this many questions' })
  maxItems: number;

  @ApiProperty({
    description: 'Current standard error of the ability estimate',
  })
  standardError: number;

  @ApiProperty({ description: 'The test stops once the error is this small' })
  targetStandardError: number;

  @ApiProperty()
  done: boolean;

  @ApiProperty({
    nullable: true,
    enum: ['MAX_ITEMS', 'PRECISION', 'POOL_EXHAUSTED', 'TIME', 'ENDED_EARLY'],
  })
  stoppedBy: string | null;
}

export class CatResult {
  @ApiProperty({ description: 'Measured ability (Rasch logit scale)' })
  ability: number;

  @ApiProperty()
  standardError: number;

  @ApiProperty()
  itemsAdministered: number;

  @ApiProperty()
  maxItems: number;

  @ApiProperty({ nullable: true, type: String })
  stoppedBy: string | null;

  @ApiProperty({ description: 'Estimated % chance to pass the real exam' })
  passLikelihood: number;
}

/** POST /attempts/:id/cat/answer */
export class CatAnswerResponse {
  @ApiProperty()
  done: boolean;

  @ApiPropertyOptional({ type: CatProgress })
  progress?: CatProgress;

  @ApiPropertyOptional({ description: 'The next question (when not done)' })
  question?: any;

  @ApiPropertyOptional({
    type: AttemptResultResponse,
    description: 'The graded result (when done)',
  })
  result?: AttemptResultResponse;
}
