import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsArray, IsEnum, IsBoolean, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { Difficulty, QuestionType, QuestionStatus } from '@prisma/client';

class ChoiceDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  id?: string;

  @ApiPropertyOptional({ example: 'a' })
  @IsString()
  label: string;

  @ApiPropertyOptional({ example: 'Amazon RDS' })
  @IsString()
  content: string;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  isCorrect?: boolean;
}

export class AdminUpdateQuestionDto {
  @ApiPropertyOptional({ example: 'Updated question title' })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  explanation?: string;

  @ApiPropertyOptional({ enum: Difficulty })
  @IsEnum(Difficulty)
  @IsOptional()
  difficulty?: Difficulty;

  @ApiPropertyOptional({ enum: QuestionType })
  @IsEnum(QuestionType)
  @IsOptional()
  questionType?: QuestionType;

  @ApiPropertyOptional({ enum: QuestionStatus })
  @IsEnum(QuestionStatus)
  @IsOptional()
  status?: QuestionStatus;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  domainId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  certificationId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  referenceUrl?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  codeSnippet?: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isScenario?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isTrapQuestion?: boolean;

  @ApiPropertyOptional({ type: [ChoiceDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChoiceDto)
  @IsOptional()
  choices?: ChoiceDto[];

  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];
}
