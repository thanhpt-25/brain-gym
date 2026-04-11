import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsString, IsNotEmpty, IsOptional, IsEnum, IsBoolean, ValidateNested, IsArray, MaxLength } from 'class-validator';
import { QuestionType, Difficulty } from '@prisma/client';

export class CreateOrgChoiceDto {
  @ApiProperty({ example: 'a' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1)
  label: string;

  @ApiProperty({ example: 'Option content here' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  content: string;

  @ApiPropertyOptional({ example: false })
  @IsBoolean()
  @IsOptional()
  isCorrect?: boolean;
}

export class CreateOrgQuestionDto {
  @ApiProperty({ example: 'What is the correct approach for...' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  title: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ enum: QuestionType })
  @IsEnum(QuestionType)
  @IsOptional()
  questionType?: QuestionType;

  @ApiPropertyOptional({ enum: Difficulty })
  @IsEnum(Difficulty)
  @IsOptional()
  difficulty?: Difficulty;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MaxLength(5000)
  explanation?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  referenceUrl?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MaxLength(10000)
  codeSnippet?: string;

  @ApiPropertyOptional({ example: false })
  @IsBoolean()
  @IsOptional()
  isScenario?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsBoolean()
  @IsOptional()
  isTrapQuestion?: boolean;

  @ApiPropertyOptional({ example: 'Networking' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  category?: string;

  @ApiPropertyOptional({ type: [String], example: ['aws', 'vpc'] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  certificationId?: string;

  @ApiProperty({ type: [CreateOrgChoiceDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrgChoiceDto)
  choices: CreateOrgChoiceDto[];
}
