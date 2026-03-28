import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class BanUserDto {
  @ApiProperty({ example: 'Persistent abusive behavior' })
  @IsString()
  @IsNotEmpty()
  reason: string;
}
