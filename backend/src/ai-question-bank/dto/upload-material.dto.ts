import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MaterialContentType } from '@prisma/client';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
} from 'class-validator';

export class UploadMaterialDto {
  @ApiProperty({ example: 'AWS SAA Study Notes' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ enum: MaterialContentType })
  @IsEnum(MaterialContentType)
  contentType: MaterialContentType;

  @ApiPropertyOptional({ example: 'aws-saa' })
  @IsString()
  @IsOptional()
  certificationId?: string;

  @ApiPropertyOptional({ description: 'Required when contentType is TEXT' })
  @IsString()
  @IsOptional()
  textContent?: string;

  @ApiPropertyOptional({ description: 'Required when contentType is URL' })
  @IsUrl()
  @IsOptional()
  sourceUrl?: string;
}
