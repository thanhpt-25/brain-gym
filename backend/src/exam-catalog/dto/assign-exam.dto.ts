import { IsOptional, IsUUID, IsDateString } from 'class-validator';

export class AssignExamDto {
  @IsOptional()
  @IsUUID()
  groupId?: string;

  @IsOptional()
  @IsUUID()
  memberId?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;
}
