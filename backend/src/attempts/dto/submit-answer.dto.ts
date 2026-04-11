import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsArray, IsOptional, IsBoolean } from 'class-validator';

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
}
