import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class OAuthLoginDto {
  @ApiProperty({ description: 'ID token from the OAuth provider (e.g. Google)' })
  @IsString()
  @IsNotEmpty()
  token: string;
}
