import { IsArray, IsOptional, IsUUID } from 'class-validator';

export class AssignCampaignDto {
  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  groupIds?: string[];

  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  memberIds?: string[];
}
