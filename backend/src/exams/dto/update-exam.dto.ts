import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum, IsInt, Min } from 'class-validator';
import { ExamVisibility } from '@prisma/client';

export class UpdateExamDto {
  @ApiPropertyOptional({ example: 'AWS SAA Mock Test #1 (Updated)' })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ example: 130 })
  @IsInt()
  @Min(1)
  @IsOptional()
  timeLimit?: number;

  @ApiPropertyOptional({ enum: ExamVisibility })
  @IsEnum(ExamVisibility)
  @IsOptional()
  visibility?: ExamVisibility;
}
