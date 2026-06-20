import {
  IsEmail,
  IsString,
  IsOptional,
  IsBoolean,
  MaxLength,
  MinLength,
} from 'class-validator';

export class PublicApplyDto {
  @IsEmail()
  @MaxLength(254)
  email: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  fullName: string;

  @IsBoolean()
  consentGiven: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  honeypot?: string;
}
