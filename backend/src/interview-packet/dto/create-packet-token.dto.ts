import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class CreatePacketTokenDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30)
  expiresInDays?: number;
}
