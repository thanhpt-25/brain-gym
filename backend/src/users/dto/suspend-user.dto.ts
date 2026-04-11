import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsDateString,
} from 'class-validator';

export class SuspendUserDto {
  @ApiProperty({ example: 'Repeated spam in comments' })
  @IsString()
  @IsNotEmpty()
  reason: string;

  @ApiPropertyOptional({ example: '2026-04-15T00:00:00.000Z' })
  @IsDateString()
  @IsOptional()
  suspendedUntil?: string;
}
