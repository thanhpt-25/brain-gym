import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateCertificationDto {
  @ApiProperty({ example: 'Solutions Architect Associate' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'uuid-of-provider' })
  @IsString()
  @IsNotEmpty()
  providerId: string;

  @ApiProperty({ example: 'SAA-C03' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiPropertyOptional({ example: 'Design distributed systems on AWS...' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ example: ['Design Resilient Architectures'] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  domains?: string[];

  @ApiPropertyOptional({
    example: 72,
    description:
      'Passing score as a percentage (0-100). Falls back to 70 when unset.',
  })
  @IsInt()
  @Min(0)
  @Max(100)
  @IsOptional()
  @Type(() => Number)
  passingScore?: number;
}
