import {
  IsString,
  IsOptional,
  IsDateString,
  IsBoolean,
  IsEnum,
  MaxLength,
  IsUUID,
  ValidateIf,
} from 'class-validator';

export enum RecurrenceInterval {
  MONTHLY_3 = 'MONTHLY_3',
  MONTHLY_6 = 'MONTHLY_6',
  MONTHLY_12 = 'MONTHLY_12',
}

export class CreateCampaignDto {
  @IsString()
  @MaxLength(200)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsUUID()
  catalogItemId: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsBoolean()
  recurrenceEnabled?: boolean;

  @IsOptional()
  @IsEnum(RecurrenceInterval)
  @ValidateIf((o) => o.recurrenceEnabled === true)
  recurrenceInterval?: RecurrenceInterval;
}
