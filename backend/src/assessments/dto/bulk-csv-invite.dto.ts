import { IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class BulkCsvInviteDto {
  @ApiProperty({ description: 'CSV content with email,name header' })
  @IsString()
  @MaxLength(2_000_000)
  csv: string;
}
