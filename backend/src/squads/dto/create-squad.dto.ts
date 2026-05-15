import {
  IsString,
  IsUUID,
  IsOptional,
  IsDateString,
  MinLength,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSquadDto {
  @ApiProperty({ description: 'Squad name', minLength: 2, maxLength: 80 })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name: string;

  @ApiProperty({ description: 'Target certification UUID' })
  @IsUUID()
  certificationId: string;

  @ApiPropertyOptional({ description: 'Target exam date (ISO date string)' })
  @IsOptional()
  @IsDateString()
  targetExamDate?: string;
}
