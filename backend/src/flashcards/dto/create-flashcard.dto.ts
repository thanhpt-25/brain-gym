import { IsString, IsOptional, IsArray, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateFlashcardDto {
  @ApiProperty()
  @IsUUID()
  deckId: string;

  @ApiProperty()
  @IsString()
  front: string;

  @ApiProperty()
  @IsString()
  back: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  hint?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];
}
