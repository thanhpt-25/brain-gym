import { IsInt, IsOptional, Min, IsDateString } from 'class-validator';

export class CreateJoinLinkDto {
  @IsInt()
  @Min(1)
  @IsOptional()
  maxUses?: number;

  @IsDateString()
  @IsOptional()
  expiresAt?: string;
}
