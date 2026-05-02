import {
  IsArray,
  IsString,
  IsOptional,
  ValidateNested,
  ArrayMaxSize,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class AttemptEventDto {
  @ApiProperty({ description: 'ID of the exam attempt this event belongs to' })
  @IsString()
  attemptId: string;

  @ApiProperty({
    required: false,
    description: 'ID of the question (optional for SUBMITTED events)',
  })
  @IsOptional()
  @IsString()
  questionId?: string;

  @ApiProperty({
    description:
      'Event type: QUESTION_VIEWED | CHOICE_SELECTED | MARKED | FOCUS_LOST | SUBMITTED',
  })
  @IsString()
  eventType: string;

  @ApiProperty({ description: 'Event-specific payload object' })
  payload: Record<string, unknown>;

  @ApiProperty({ description: 'Client-side ISO timestamp' })
  @IsString()
  clientTs: string;
}

export class IngestEventsDto {
  @ApiProperty({
    type: [AttemptEventDto],
    description: 'Batch of 1–50 attempt events',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => AttemptEventDto)
  events: AttemptEventDto[];
}
