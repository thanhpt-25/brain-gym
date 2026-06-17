import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { JobRolesService } from './job-roles.service';
import { CreateJobRoleDto } from './dto/create-job-role.dto';
import { UpdateJobRoleDto } from './dto/update-job-role.dto';
import { SetJobRoleCompetenciesDto } from './dto/set-job-role-competencies.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrgRoleGuard } from '../organizations/guards/org-role.guard';
import { OrgRoles } from '../common/decorators/org-roles.decorator';

@Controller('organizations/:orgId/job-roles')
@UseGuards(JwtAuthGuard, OrgRoleGuard)
export class JobRolesController {
  constructor(private readonly service: JobRolesService) {}

  @Get()
  list(@Param('orgId') orgId: string) {
    return this.service.list(orgId);
  }

  @Post()
  @OrgRoles('OWNER', 'ADMIN', 'MANAGER', 'RECRUITER')
  create(@Param('orgId') orgId: string, @Body() dto: CreateJobRoleDto) {
    return this.service.create(orgId, dto);
  }

  @Patch(':roleId')
  @OrgRoles('OWNER', 'ADMIN', 'MANAGER', 'RECRUITER')
  update(
    @Param('orgId') orgId: string,
    @Param('roleId') roleId: string,
    @Body() dto: UpdateJobRoleDto,
  ) {
    return this.service.update(orgId, roleId, dto);
  }

  @Delete(':roleId')
  @OrgRoles('OWNER', 'ADMIN')
  remove(@Param('orgId') orgId: string, @Param('roleId') roleId: string) {
    return this.service.remove(orgId, roleId);
  }

  // ── US-A2: Competency Requirements ────────────────────────────────────────

  @Get(':roleId/competencies')
  @OrgRoles('OWNER', 'ADMIN', 'MANAGER', 'RECRUITER', 'MEMBER')
  getRequirements(
    @Param('orgId') orgId: string,
    @Param('roleId') roleId: string,
  ) {
    return this.service.getRequirements(orgId, roleId);
  }

  @Put(':roleId/competencies')
  @OrgRoles('OWNER', 'ADMIN', 'MANAGER')
  setRequirements(
    @Param('orgId') orgId: string,
    @Param('roleId') roleId: string,
    @Body() dto: SetJobRoleCompetenciesDto,
  ) {
    return this.service.setRequirements(orgId, roleId, dto);
  }
}
