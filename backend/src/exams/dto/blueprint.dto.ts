import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsObject,
  IsOptional,
  Min,
  ValidateNested,
} from 'class-validator';

export class BlueprintDifficultyDto {
  @ApiPropertyOptional({ example: 15, description: 'Number of EASY questions' })
  @IsOptional()
  @IsInt()
  @Min(0)
  EASY?: number;

  @ApiPropertyOptional({ example: 25, description: 'Number of MEDIUM questions' })
  @IsOptional()
  @IsInt()
  @Min(0)
  MEDIUM?: number;

  @ApiPropertyOptional({ example: 10, description: 'Number of HARD questions' })
  @IsOptional()
  @IsInt()
  @Min(0)
  HARD?: number;
}

export class BlueprintDto {
  @ApiPropertyOptional({
    type: () => BlueprintDifficultyDto,
    description:
      'Quota per difficulty level. Numbers are absolute question counts (not %).',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => BlueprintDifficultyDto)
  byDifficulty?: BlueprintDifficultyDto;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: { type: 'integer' },
    example: { 'domain-uuid-a': 20, 'domain-uuid-b': 15 },
    description:
      'Quota per domain. Keys are domainId, values are absolute question counts (not %). ' +
      'Questions within each domain are picked at random across all difficulties. ' +
      'Mutually exclusive with byDifficulty — supply only one axis.',
  })
  @IsOptional()
  @IsObject()
  byDomain?: Record<string, number>;
}
