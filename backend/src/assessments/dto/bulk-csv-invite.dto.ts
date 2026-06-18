import { IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * IMPORTANT: The 2 MB @MaxLength limit relies on Express body-size being
 * configured to accept at least that payload (default is 100 kb).
 * Set `bodyParser: { limit: '2mb' }` in NestJS / the underlying Express
 * instance before deploying this endpoint to production.
 */
export class BulkCsvInviteDto {
  @ApiProperty({
    description: 'CSV content with email,name header; max ~2 MB raw text',
  })
  @IsString()
  @MaxLength(2_000_000)
  csv: string;
}
