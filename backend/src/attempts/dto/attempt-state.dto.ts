import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  AttemptStatus,
  FeedbackMode,
  PracticeMode,
  TimerMode,
} from '@prisma/client';
import { CheckAnswerResponse } from './check-answer.dto';

export class ActiveAttemptSummary {
  @ApiProperty()
  attemptId: string;

  @ApiProperty()
  examId: string;

  @ApiProperty()
  certificationId: string;

  @ApiProperty()
  title: string;

  @ApiProperty({ enum: TimerMode })
  timerMode: TimerMode;

  @ApiProperty({ enum: FeedbackMode })
  feedbackMode: FeedbackMode;

  @ApiProperty({ description: 'Questions with a saved answer or flag' })
  answeredCount: number;

  @ApiProperty()
  totalQuestions: number;

  @ApiProperty()
  startedAt: Date;

  @ApiProperty({ nullable: true, type: Date })
  expiresAt: Date | null;
}

export class SavedAnswerState {
  @ApiProperty()
  questionId: string;

  @ApiProperty({ type: [String] })
  selectedChoices: string[];

  @ApiProperty()
  isMarked: boolean;

  @ApiProperty({ description: 'Seconds spent on the question so far' })
  timeSpent: number;
}

/**
 * GET /attempts/:id/state. Only `attemptId` and `status` are present once the
 * attempt is no longer IN_PROGRESS.
 */
export class AttemptStateResponse {
  @ApiProperty()
  attemptId: string;

  @ApiProperty({ enum: AttemptStatus })
  status: AttemptStatus;

  @ApiPropertyOptional()
  examId?: string;

  @ApiPropertyOptional()
  title?: string;

  @ApiPropertyOptional()
  certification?: any;

  @ApiPropertyOptional({ description: 'Effective time limit in minutes' })
  timeLimit?: number;

  @ApiPropertyOptional({ enum: TimerMode })
  timerMode?: TimerMode;

  @ApiPropertyOptional({ enum: PracticeMode, nullable: true })
  practiceMode?: PracticeMode | null;

  @ApiPropertyOptional({ enum: FeedbackMode })
  feedbackMode?: FeedbackMode;

  @ApiPropertyOptional()
  totalQuestions?: number;

  @ApiPropertyOptional()
  startedAt?: Date;

  @ApiPropertyOptional({ nullable: true, type: Date })
  expiresAt?: Date | null;

  @ApiPropertyOptional({ description: 'Server clock, to correct client skew' })
  serverNow?: Date;

  @ApiPropertyOptional({ type: [Object] })
  questions?: any[];

  @ApiPropertyOptional({ type: [SavedAnswerState] })
  answers?: SavedAnswerState[];

  @ApiPropertyOptional({ type: [CheckAnswerResponse] })
  checked?: CheckAnswerResponse[];

  @ApiPropertyOptional({ description: 'Adaptive tests only' })
  cat?: {
    answered: number;
    minItems: number;
    maxItems: number;
    standardError: number;
    targetStandardError: number;
    done: boolean;
    stoppedBy: string | null;
  };
}
