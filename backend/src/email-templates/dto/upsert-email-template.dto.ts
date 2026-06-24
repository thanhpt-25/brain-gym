import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { EmailTemplateTrigger } from '@prisma/client';

export class UpsertEmailTemplateDto {
  @IsString()
  @MaxLength(200)
  subject: string;

  @IsString()
  @MaxLength(50_000)
  bodyHtml: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class PreviewEmailTemplateDto {
  @IsEnum(EmailTemplateTrigger)
  trigger: EmailTemplateTrigger;

  @IsString()
  @MaxLength(200)
  subject: string;

  @IsString()
  @MaxLength(50_000)
  bodyHtml: string;
}
