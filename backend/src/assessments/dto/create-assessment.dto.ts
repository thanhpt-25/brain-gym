import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  IsBoolean,
  IsArray,
  ValidateNested,
  MaxLength,
  Min,
  Max,
  IsEnum,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AssessmentSelectionMode } from '@prisma/client';

export class AssessmentQuestionDto {
  @IsOptional()
  @IsString()
  orgQuestionId?: string;

  @IsOptional()
  @IsString()
  publicQuestionId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class CreateAssessmentDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsInt()
  @Min(1)
  timeLimit: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  passingScore?: number;

  @IsOptional()
  @IsBoolean()
  randomizeQuestions?: boolean;

  @IsOptional()
  @IsBoolean()
  randomizeChoices?: boolean;

  @IsOptional()
  @IsBoolean()
  detectTabSwitch?: boolean;

  @IsOptional()
  @IsBoolean()
  blockCopyPaste?: boolean;

  @IsOptional()
  @IsBoolean()
  requireFullscreen?: boolean;

  @IsOptional()
  @IsBoolean()
  requireOtp?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  maxAttempts?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  linkExpiryHours?: number;

  @IsOptional()
  @IsString()
  jobRoleId?: string;

  @IsOptional()
  @IsEnum(AssessmentSelectionMode)
  selectionMode?: AssessmentSelectionMode;

  // BLUEPRINT: {totalQuestions, domains:[{domain,percentage}], difficulty?, certificationId?}
  // POOL:      {drawCount, certificationId?, difficulty?, categories?:[string], tags?:[string]}
  @IsOptional()
  @IsObject()
  selectionConfig?: Record<string, any>;

  // Required for MANUAL; optional/ignored for BLUEPRINT and POOL
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AssessmentQuestionDto)
  questions?: AssessmentQuestionDto[];
}
