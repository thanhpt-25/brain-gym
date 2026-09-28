import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { TimerMode } from '@prisma/client';

export class CreatePracticeExamDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  certificationId: string;

  @ApiProperty({ example: 65 })
  @IsInt()
  @Min(1)
  @Max(200)
  questionCount: number;

  @ApiProperty({ example: 90, description: 'Time limit in minutes' })
  @IsInt()
  @Min(1)
  @Max(600)
  timeLimit: number;

  @ApiPropertyOptional({ enum: TimerMode })
  @IsEnum(TimerMode)
  @IsOptional()
  timerMode?: TimerMode;
}
