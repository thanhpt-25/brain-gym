import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsInt,
  IsBoolean,
  IsUUID,
  IsDateString,
  MaxLength,
  Min,
  Max,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ExamCatalogItemType, TimerMode } from '@prisma/client';

export class CatalogQuestionDto {
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

export class CreateCatalogItemDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsEnum(ExamCatalogItemType)
  type?: ExamCatalogItemType;

  @IsOptional()
  @IsString()
  certificationId?: string;

  @IsInt()
  @Min(1)
  questionCount: number;

  @IsInt()
  @Min(1)
  timeLimit: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  passingScore?: number;

  @IsOptional()
  @IsEnum(TimerMode)
  timerMode?: TimerMode;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxAttempts?: number;

  @IsOptional()
  @IsDateString()
  availableFrom?: string;

  @IsOptional()
  @IsDateString()
  availableUntil?: string;

  @IsOptional()
  @IsBoolean()
  isMandatory?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsString()
  trackId?: string;

  @IsOptional()
  @IsString()
  prerequisiteId?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CatalogQuestionDto)
  questions?: CatalogQuestionDto[];
}
