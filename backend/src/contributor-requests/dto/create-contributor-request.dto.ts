import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  MaxLength,
} from 'class-validator';

export class CreateContributorRequestDto {
  @ApiProperty({ minLength: 50, maxLength: 1000 })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(50, 1000)
  motivation: string;

  @ApiPropertyOptional({
    type: [String],
    description: 'Certification ids the user is confident in',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  expertise?: string[];

  @ApiPropertyOptional({ description: 'https:// portfolio / credential link' })
  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(500)
  sampleUrl?: string;
}
