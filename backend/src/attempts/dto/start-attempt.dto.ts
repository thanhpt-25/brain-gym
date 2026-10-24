import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { FeedbackMode } from '@prisma/client';

export class StartAttemptDto {
  @ApiPropertyOptional({
    enum: FeedbackMode,
    default: FeedbackMode.END_OF_EXAM,
    description:
      'INTERACTIVE reveals correctness + explanation per question via POST /attempts/:id/check',
  })
  @IsOptional()
  @IsEnum(FeedbackMode)
  feedbackMode?: FeedbackMode;
}
