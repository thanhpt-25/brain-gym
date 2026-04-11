import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Difficulty, LlmProvider, QuestionType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class GenerateQuestionsDto {
  @ApiProperty({ enum: LlmProvider })
  @IsEnum(LlmProvider)
  provider: LlmProvider;

  @ApiProperty({ example: 'aws-saa' })
  @IsString()
  certificationId: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  domainId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  materialId?: string;

  @ApiPropertyOptional({ enum: Difficulty })
  @IsEnum(Difficulty)
  @IsOptional()
  difficulty?: Difficulty;

  @ApiPropertyOptional({ enum: QuestionType })
  @IsEnum(QuestionType)
  @IsOptional()
  questionType?: QuestionType;

  @ApiProperty({ example: 5 })
  @IsInt()
  @Min(1)
  @Max(20)
  @Type(() => Number)
  questionCount: number;
}
