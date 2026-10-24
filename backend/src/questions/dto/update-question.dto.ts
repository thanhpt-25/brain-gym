import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsBoolean,
  ValidateNested,
  IsArray,
  MaxLength,
  ArrayMinSize,
  ArrayMaxSize,
} from 'class-validator';
import { QuestionType, Difficulty } from '@prisma/client';

export class UpdateChoiceDto {
  @ApiPropertyOptional({
    description:
      'Existing choice id. Omit to add a new choice. Existing choices whose id is not sent are removed.',
  })
  @IsString()
  @IsOptional()
  id?: string;

  /** Ignored — labels are re-assigned positionally (a, b, c, ...). */
  @ApiPropertyOptional({ example: 'a' })
  @IsString()
  @IsOptional()
  @MaxLength(1)
  label?: string;

  @ApiPropertyOptional({ example: 'Amazon S3' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  content: string;

  @ApiPropertyOptional({ example: false })
  @IsBoolean()
  @IsOptional()
  isCorrect?: boolean;
}

/**
 * Edit payload for PUT /questions/:id (owner, or ADMIN/REVIEWER/CONTRIBUTOR).
 * `status` and `certificationId` are intentionally not editable here — status
 * goes through PUT /questions/:id/status, moving certification stays admin-only.
 */
export class UpdateQuestionDto {
  @ApiPropertyOptional()
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  @MaxLength(1000)
  title?: string;

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
  domainId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  referenceUrl?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MaxLength(10000)
  codeSnippet?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  imageUrl?: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isScenario?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isTrapQuestion?: boolean;

  @ApiPropertyOptional({ type: [UpdateChoiceDto] })
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(6)
  @ValidateNested({ each: true })
  @Type(() => UpdateChoiceDto)
  @IsOptional()
  choices?: UpdateChoiceDto[];

  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];
}
