import { ApiProperty } from '@nestjs/swagger';
import { Difficulty, QuestionType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class SaveChoiceDto {
  @IsString()
  label: string;

  @IsString()
  content: string;

  @IsBoolean()
  isCorrect: boolean;
}

export class SaveQuestionDto {
  @IsString()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(QuestionType)
  questionType: QuestionType;

  @IsEnum(Difficulty)
  difficulty: Difficulty;

  @IsString()
  @IsOptional()
  explanation?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaveChoiceDto)
  choices: SaveChoiceDto[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @IsBoolean()
  @IsOptional()
  isScenario?: boolean;

  @IsBoolean()
  @IsOptional()
  isTrapQuestion?: boolean;

  @IsNumber()
  @Min(0)
  @Max(1)
  qualityScore: number;

  @IsString()
  @IsOptional()
  sourcePassage?: string;

  @IsUUID()
  @IsOptional()
  sourceChunkId?: string;
}

export class SaveGeneratedQuestionsDto {
  @ApiProperty()
  @IsUUID()
  jobId: string;

  @ApiProperty({ type: [SaveQuestionDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaveQuestionDto)
  questions: SaveQuestionDto[];

  @ApiProperty({ example: 'aws-saa' })
  @IsString()
  certificationId: string;

  @IsUUID()
  @IsOptional()
  domainId?: string;
}
