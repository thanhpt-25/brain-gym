import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateJobRoleDto {
  @IsString()
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  department?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
