import {
  IsArray,
  ValidateNested,
  IsString,
  IsNumber,
  IsUUID,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class DomainMappingItemDto {
  @IsString()
  domainKey: string;

  @IsUUID()
  competencyId: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  weight: number;
}

export class UpsertDomainMappingDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DomainMappingItemDto)
  mappings: DomainMappingItemDto[];
}
