import { IsOptional, IsString, IsInt, IsUUID, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ListCatalogDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsUUID()
  trackId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}
