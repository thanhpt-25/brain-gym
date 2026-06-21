import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class PatchFlagDto {
  @IsBoolean()
  isFlagged: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
