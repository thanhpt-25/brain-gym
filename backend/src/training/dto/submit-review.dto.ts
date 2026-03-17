import { IsUUID, IsInt, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SubmitReviewDto {
  @IsUUID()
  @ApiProperty()
  questionId: string;

  @IsInt()
  @Min(0)
  @Max(5)
  @ApiProperty({ description: 'Quality of the response (0-5)' })
  quality: number;
}
