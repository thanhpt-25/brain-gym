import { IsString, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';

export class CreateCaptureDto {
  @IsString()
  @IsNotEmpty()
  word: string;

  @IsString()
  @IsOptional()
  context?: string;

  @IsString()
  @IsOptional()
  @IsUUID()
  examAttemptId?: string;

  @IsString()
  @IsOptional()
  @IsUUID()
  questionId?: string;
}
