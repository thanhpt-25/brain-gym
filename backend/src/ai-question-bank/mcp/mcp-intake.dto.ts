import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Difficulty, QuestionType } from '@prisma/client';

export class McpChoiceDto {
  @IsString()
  @IsNotEmpty()
  label: string;

  @IsString()
  @IsNotEmpty()
  content: string;

  @IsBoolean()
  isCorrect: boolean;
}

export class McpQuestionDto {
  @IsString()
  @IsNotEmpty()
  question: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => McpChoiceDto)
  choices: McpChoiceDto[];

  @IsString()
  @IsOptional()
  explanation?: string;

  @IsString()
  @IsOptional()
  source_passage?: string;

  @IsNumber()
  @Min(0)
  @Max(1)
  @IsOptional()
  quality_score?: number;
}

export class McpIntakeDto {
  @ApiProperty({ type: [McpQuestionDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => McpQuestionDto)
  questions: McpQuestionDto[];

  @ApiProperty({ example: 'aws-saa' })
  @IsString()
  @IsNotEmpty()
  certificationId: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  domainId?: string;

  @ApiPropertyOptional({ enum: Difficulty })
  @IsEnum(Difficulty)
  @IsOptional()
  difficulty?: Difficulty;

  @ApiPropertyOptional({ enum: QuestionType })
  @IsEnum(QuestionType)
  @IsOptional()
  questionType?: QuestionType;
}
