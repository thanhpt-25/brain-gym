import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SubmitReviewDto {
  @ApiProperty({ description: 'SM-2 quality rating', minimum: 0, maximum: 5 })
  @IsInt()
  @Min(0)
  @Max(5)
  quality: number;

  @ApiPropertyOptional({
    description: 'Client-supplied idempotency key (UUID recommended)',
  })
  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}
