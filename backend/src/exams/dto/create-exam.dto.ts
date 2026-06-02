import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsInt,
  IsArray,
  Min,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ExamVisibility, TimerMode, ExamType } from '@prisma/client';
import { BlueprintDto } from './blueprint.dto';

export class CreateExamDto {
  @ApiProperty({ example: 'AWS SAA Mock Test #1' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @ApiPropertyOptional({
    example: 'Practice exam for AWS Solutions Architect Associate',
  })
  @IsString()
  @IsOptional()
  @MaxLength(2000)
  description?: string;

  @ApiProperty({ example: 'aws-saa' })
  @IsString()
  @IsNotEmpty()
  certificationId: string;

  @ApiProperty({ example: 65 })
  @IsInt()
  @Min(1)
  questionCount: number;

  @ApiProperty({ example: 130, description: 'Time limit in minutes' })
  @IsInt()
  @Min(1)
  timeLimit: number;

  @ApiPropertyOptional({ enum: ExamVisibility, example: ExamVisibility.PUBLIC })
  @IsEnum(ExamVisibility)
  @IsOptional()
  visibility?: ExamVisibility;

  @ApiPropertyOptional({
    enum: TimerMode,
    example: TimerMode.STRICT,
    description: 'Timer pressure mode for the exam',
  })
  @IsEnum(TimerMode)
  @IsOptional()
  timerMode?: TimerMode;

  @ApiPropertyOptional({
    enum: ExamType,
    example: ExamType.STANDARD,
    description: 'Exam type variant (STANDARD or TIME_PRESSURE)',
  })
  @IsEnum(ExamType)
  @IsOptional()
  examType?: ExamType;

  @ApiPropertyOptional({
    description:
      'Specific question IDs to include. If empty, questions are randomly selected.',
  })
  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  questionIds?: string[];

  @ApiPropertyOptional({
    enum: ['MANUAL', 'RANDOM', 'BLUEPRINT'],
    description:
      'How questions are selected. MANUAL=questionIds list, RANDOM=random pick, BLUEPRINT=quota-based.',
  })
  @IsEnum(['MANUAL', 'RANDOM', 'BLUEPRINT'])
  @IsOptional()
  selectionStrategy?: 'MANUAL' | 'RANDOM' | 'BLUEPRINT';

  @ApiPropertyOptional({
    type: () => BlueprintDto,
    description:
      'Blueprint quotas used when selectionStrategy=BLUEPRINT. Only byDifficulty is supported in P1.',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => BlueprintDto)
  blueprint?: BlueprintDto;
}
