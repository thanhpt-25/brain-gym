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
} from 'class-validator';
import { Type } from 'class-transformer';

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
  @IsInt()
  @Min(1)
  linkExpiryHours?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AssessmentQuestionDto)
  questions: AssessmentQuestionDto[];
}
