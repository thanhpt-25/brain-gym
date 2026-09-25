import { ApiProperty } from '@nestjs/swagger';
import { AttemptStatus, FeedbackMode, MistakeType } from '@prisma/client';

export class ChoiceResponse {
  @ApiProperty()
  id: string;

  @ApiProperty()
  label: string;

  @ApiProperty()
  content: string;

  @ApiProperty()
  isCorrect: boolean;
}

export class QuestionResultResponse {
  @ApiProperty()
  answerId: string;

  @ApiProperty()
  questionId: string;

  @ApiProperty()
  title: string;

  @ApiProperty({ required: false })
  description?: string;

  @ApiProperty({ required: false })
  explanation?: string;

  @ApiProperty()
  domain: string;

  @ApiProperty()
  correct: boolean;

  @ApiProperty({
    required: false,
    description: 'When the answer was revealed during an INTERACTIVE attempt',
  })
  checkedAt?: Date;

  @ApiProperty({ enum: MistakeType, required: false })
  mistakeType?: MistakeType;

  @ApiProperty({ type: [String] })
  selectedAnswers: string[];

  @ApiProperty({ type: [String] })
  correctAnswers: string[];

  @ApiProperty({ type: [ChoiceResponse] })
  choices: ChoiceResponse[];
}

export class AttemptResultResponse {
  @ApiProperty()
  attemptId: string;

  @ApiProperty()
  examId: string;

  @ApiProperty()
  examTitle: string;

  @ApiProperty()
  certification: any; // Ideally this would be typed too

  @ApiProperty({ enum: AttemptStatus })
  status: AttemptStatus;

  @ApiProperty({ enum: FeedbackMode })
  feedbackMode: FeedbackMode;

  @ApiProperty()
  score: number;

  @ApiProperty()
  totalCorrect: number;

  @ApiProperty()
  totalQuestions: number;

  @ApiProperty()
  percentage: number;

  @ApiProperty()
  domainScores: Record<string, { correct: number; total: number }>;

  @ApiProperty()
  timeSpent: number;

  @ApiProperty()
  startedAt: Date;

  @ApiProperty({ required: false })
  submittedAt?: Date;

  @ApiProperty({ type: [QuestionResultResponse] })
  questionResults: QuestionResultResponse[];
}
