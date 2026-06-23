import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class CreateIngestionJobDto {
  @IsString()
  certificationId: string;

  @IsBoolean()
  rightsAttestation: boolean;

  @IsOptional()
  @IsString()
  declaredSource?: string;
}

export class EstimateIngestionDto {
  @IsString()
  certificationId: string;
}
