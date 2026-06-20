import {
  IsString,
  IsOptional,
  IsDateString,
  IsBoolean,
  IsEnum,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { RecurrenceInterval } from './create-campaign.dto';

export enum CampaignStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  CLOSED = 'CLOSED',
}

export class UpdateCampaignDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsEnum(CampaignStatus)
  status?: CampaignStatus;

  @IsOptional()
  @IsBoolean()
  recurrenceEnabled?: boolean;

  @IsOptional()
  @IsEnum(RecurrenceInterval)
  @ValidateIf((o) => o.recurrenceEnabled === true)
  recurrenceInterval?: RecurrenceInterval;
}
