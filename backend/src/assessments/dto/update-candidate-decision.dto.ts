import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { CandidateStage } from '@prisma/client';

export class UpdateCandidateDecisionDto {
  @IsOptional()
  @IsEnum(CandidateStage)
  stage?: CandidateStage;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

  @IsOptional()
  @IsString()
  recruiterNote?: string;

  @IsOptional()
  @IsDateString()
  interviewScheduledAt?: string;
}
