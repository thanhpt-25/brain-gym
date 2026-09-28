import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsArray,
  IsOptional,
  IsBoolean,
  IsInt,
  Min,
  Max,
} from 'class-validator';

export class SubmitAnswerDto {
  @ApiProperty({ example: 'question-uuid' })
  @IsString()
  questionId: string;

  @ApiProperty({
    example: ['choice-uuid-1'],
    description: 'Selected choice IDs',
  })
  @IsArray()
  @IsString({ each: true })
  selectedChoices: string[];

  @ApiPropertyOptional({ example: false })
  @IsBoolean()
  @IsOptional()
  isMarked?: boolean;

  @ApiPropertyOptional({
    example: 42,
    description:
      'Total seconds the learner has spent on this question so far (capped at the attempt duration)',
  })
  @IsInt()
  @Min(0)
  @Max(86_400)
  @IsOptional()
  timeSpent?: number;
}
