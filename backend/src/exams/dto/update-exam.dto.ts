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
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ExamVisibility, TimerMode } from '@prisma/client';
import { BlueprintDto } from './blueprint.dto';

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

  @ApiPropertyOptional({
    enum: ['MANUAL', 'RANDOM', 'BLUEPRINT'],
    description: 'How questions are selected when updating the question set.',
  })
  @IsEnum(['MANUAL', 'RANDOM', 'BLUEPRINT'])
  @IsOptional()
  selectionStrategy?: 'MANUAL' | 'RANDOM' | 'BLUEPRINT';

  @ApiPropertyOptional({
    type: () => BlueprintDto,
    description: 'Blueprint quotas used when selectionStrategy=BLUEPRINT.',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => BlueprintDto)
  blueprint?: BlueprintDto;
}
