import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApplyService } from './apply.service';
import { CreateApplyLinkDto } from './dto/create-apply-link.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrgRoleGuard } from '../organizations/guards/org-role.guard';
import { OrgRoles } from '../common/decorators/org-roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('organizations/:orgId/job-roles/:jobRoleId/apply-links')
@UseGuards(JwtAuthGuard, OrgRoleGuard)
export class ApplyAdminController {
  constructor(private readonly service: ApplyService) {}

  @Get()
  @OrgRoles('OWNER', 'ADMIN', 'MANAGER', 'RECRUITER')
  listLinks(
    @Param('orgId') orgId: string,
    @Param('jobRoleId') jobRoleId: string,
  ) {
    return this.service.listLinks(orgId, jobRoleId);
  }

  @Post()
  @OrgRoles('OWNER', 'ADMIN', 'MANAGER', 'RECRUITER')
  createLink(
    @Param('orgId') orgId: string,
    @Param('jobRoleId') jobRoleId: string,
    @Body() dto: CreateApplyLinkDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.service.createLink(orgId, jobRoleId, dto, userId);
  }

  @Delete(':linkId')
  @OrgRoles('OWNER', 'ADMIN', 'MANAGER')
  @HttpCode(HttpStatus.NO_CONTENT)
  deactivateLink(
    @Param('orgId') orgId: string,
    @Param('jobRoleId') jobRoleId: string,
    @Param('linkId') linkId: string,
  ) {
    return this.service.deactivateLink(orgId, jobRoleId, linkId);
  }
}
