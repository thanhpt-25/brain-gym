import { IsString, IsNotEmpty, MaxLength, IsUUID, IsOptional, IsDateString } from 'class-validator';

export class CreateSquadDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsUUID()
  @IsNotEmpty()
  certificationId: string;

  @IsDateString()
  @IsOptional()
  targetExamDate?: string;
}
