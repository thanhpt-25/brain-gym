import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';

export class UpdateRiskConfigDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  riskThreshold?: number;

  @IsOptional()
  @IsBoolean()
  autoFlagRisk?: boolean;
}
