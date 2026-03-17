import { IsString, IsOptional, IsInt, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class StartWeaknessTrainingDto {
  @IsString()
  @ApiProperty()
  certificationId: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  @ApiProperty({ required: false, default: 10 })
  questionCount?: number = 10;
}
