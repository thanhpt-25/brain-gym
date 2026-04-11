import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { CreateCertificationDto } from './create-certification.dto';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateCertificationDto extends PartialType(
  CreateCertificationDto,
) {
  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
