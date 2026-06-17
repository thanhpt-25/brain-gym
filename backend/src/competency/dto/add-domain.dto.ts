import { IsString, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CompetencyDomainSource } from '@prisma/client';

export class AddDomainDto {
  @ApiProperty()
  @IsString()
  domainName: string;

  @ApiPropertyOptional({ enum: CompetencyDomainSource, default: 'ORG_QUESTION_CATEGORY' })
  @IsEnum(CompetencyDomainSource)
  @IsOptional()
  source?: CompetencyDomainSource;
}
