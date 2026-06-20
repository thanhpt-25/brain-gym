import { IsUUID, IsOptional, IsInt, IsDateString, Min } from 'class-validator';

export class CreateApplyLinkDto {
  @IsUUID()
  assessmentId: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxUses?: number;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
