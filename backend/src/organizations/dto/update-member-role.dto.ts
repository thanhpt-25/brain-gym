import { IsEnum } from 'class-validator';
import { OrgRole } from '@prisma/client';

export class UpdateMemberRoleDto {
  @IsEnum(OrgRole)
  role: OrgRole;
}
