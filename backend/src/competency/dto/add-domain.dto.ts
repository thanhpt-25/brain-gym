import { IsString, IsOptional, IsEnum, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CompetencyDomainSource } from '@prisma/client';

export class AddDomainDto {
  @ApiProperty({ maxLength: 200 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  domainName: string;

  @ApiPropertyOptional({ enum: CompetencyDomainSource, default: 'ORG_QUESTION_CATEGORY' })
  @IsEnum(CompetencyDomainSource)
  @IsOptional()
  source?: CompetencyDomainSource;
}
