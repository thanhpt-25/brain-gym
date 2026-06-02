import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
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
}
