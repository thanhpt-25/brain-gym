import { ApiProperty } from '@nestjs/swagger';

export class CheckAnswerResponse {
  @ApiProperty()
  questionId: string;

  @ApiProperty()
  isCorrect: boolean;

  @ApiProperty({ type: [String] })
  selectedChoiceIds: string[];

  @ApiProperty({ type: [String] })
  correctChoiceIds: string[];

  @ApiProperty({ nullable: true, type: String, description: 'Markdown' })
  explanation: string | null;

  @ApiProperty()
  checkedAt: Date;
}
