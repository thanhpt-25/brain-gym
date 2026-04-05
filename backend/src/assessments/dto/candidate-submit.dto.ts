import { IsArray, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CandidateAnswerDto {
  @IsString()
  questionId: string;

  @IsArray()
  @IsString({ each: true })
  selectedChoices: string[];
}

export class CandidateSubmitDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CandidateAnswerDto)
  answers: CandidateAnswerDto[];
}
