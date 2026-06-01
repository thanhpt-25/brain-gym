import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsEnum,
  IsInt,
  Min,
  IsArray,
  ArrayNotEmpty,
  ArrayUnique,
} from 'class-validator';
import { ExamVisibility, TimerMode } from '@prisma/client';

export class UpdateExamDto {
  @ApiPropertyOptional({ example: 'AWS SAA Mock Test #1 (Updated)' })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ example: 130 })
  @IsInt()
  @Min(1)
  @IsOptional()
  timeLimit?: number;

  @ApiPropertyOptional({ enum: ExamVisibility })
  @IsEnum(ExamVisibility)
  @IsOptional()
  visibility?: ExamVisibility;

  @ApiPropertyOptional({ enum: TimerMode })
  @IsEnum(TimerMode)
  @IsOptional()
  timerMode?: TimerMode;

  @ApiPropertyOptional({
    type: [String],
    description:
      'Replaces the full ordered set of questions in the exam. ' +
      'questionCount is recalculated from this list.',
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsString({ each: true })
  @IsOptional()
  questionIds?: string[];
}
