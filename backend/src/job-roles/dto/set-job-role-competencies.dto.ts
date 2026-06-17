import { IsArray, IsString, IsInt, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class JobRoleRequirementItemDto {
  @ApiProperty()
  @IsString()
  competencyId: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  requiredLevel: number;
}

export class SetJobRoleCompetenciesDto {
  @ApiProperty({ type: [JobRoleRequirementItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => JobRoleRequirementItemDto)
  requirements: JobRoleRequirementItemDto[];
}
