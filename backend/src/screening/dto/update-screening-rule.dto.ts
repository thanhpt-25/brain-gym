import {
  IsEnum,
  IsOptional,
  IsNumber,
  IsInt,
  IsObject,
  IsBoolean,
  Min,
  Max,
} from 'class-validator';
import { ScreeningAction } from './create-screening-rule.dto';

export class UpdateScreeningRuleDto {
  @IsOptional()
  @IsEnum(ScreeningAction)
  action?: ScreeningAction;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  minScore?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  maxScore?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  minIntegrity?: number;

  @IsOptional()
  @IsObject()
  minDomainScores?: Record<string, number>;

  @IsOptional()
  @IsInt()
  @Min(0)
  priority?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
