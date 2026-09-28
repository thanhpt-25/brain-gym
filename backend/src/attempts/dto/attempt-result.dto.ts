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
  codeSnippet?: string;

  @ApiProperty({ required: false })
  imageUrl?: string;

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

  @ApiProperty({
    required: false,
    description: 'Seconds spent on the question',
  })
  timeSpent?: number;

  @ApiProperty({
    enum: MistakeType,
    required: false,
    description: 'Hint derived from the time spent on a wrong answer',
  })
  suggestedMistakeType?: MistakeType;

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

  @ApiProperty({
    description: 'Pass mark (%) of the certification, 70 when unset',
  })
  passingScore: number;

  @ApiProperty()
  passed: boolean;

  @ApiProperty({
    nullable: true,
    type: Number,
    description: 'Seconds per question needed to finish within the time limit',
  })
  targetSecondsPerQuestion: number | null;

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
