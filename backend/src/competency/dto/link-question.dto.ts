import { IsString, IsNumber, IsOptional, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LinkQuestionDto {
  @ApiProperty()
  @IsString()
  orgQuestionId: string;

  @ApiPropertyOptional({ default: 1 })
  @IsNumber()
  @Min(0.01)
  @IsOptional()
  weight?: number;
}
