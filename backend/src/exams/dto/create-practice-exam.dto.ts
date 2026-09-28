import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { Difficulty, PracticeMode, TimerMode } from '@prisma/client';

export class CreatePracticeExamDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  certificationId: string;

  @ApiProperty({ example: 65 })
  @IsInt()
  @Min(1)
  @Max(200)
  questionCount: number;

  @ApiProperty({ example: 90, description: 'Time limit in minutes' })
  @IsInt()
  @Min(1)
  @Max(600)
  timeLimit: number;

  @ApiPropertyOptional({ enum: TimerMode })
  @IsEnum(TimerMode)
  @IsOptional()
  timerMode?: TimerMode;

  @ApiPropertyOptional({
    enum: PracticeMode,
    default: PracticeMode.STANDARD,
    description:
      'QUICK_DRILL filters by domain/difficulty, FULL_MOCK hides labels and feedback, REVIEW redoes missed/flagged questions, ADAPTIVE targets the learner level',
  })
  @IsEnum(PracticeMode)
  @IsOptional()
  mode?: PracticeMode;

  @ApiPropertyOptional({
    type: [String],
    description: 'Only these domains (QUICK_DRILL / REVIEW)',
  })
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @IsOptional()
  domainIds?: string[];

  @ApiPropertyOptional({
    enum: Difficulty,
    isArray: true,
    description: 'Only these difficulties (QUICK_DRILL)',
  })
  @IsArray()
  @IsEnum(Difficulty, { each: true })
  @IsOptional()
  difficulties?: Difficulty[];

  @ApiPropertyOptional({
    description:
      'REVIEW: redo the wrong, skipped and flagged questions of this (own, submitted) attempt',
  })
  @IsString()
  @IsOptional()
  sourceAttemptId?: string;
}
