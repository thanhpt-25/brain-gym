import { Controller, Get, Post, Param, Query, UseGuards } from '@nestjs/common';
import { CompetencyCertService } from './competency-cert.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrgRoleGuard } from '../organizations/guards/org-role.guard';
import { OrgRoles } from '../common/decorators/org-roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller()
@UseGuards(JwtAuthGuard, OrgRoleGuard)
export class CompetencyCertController {
  constructor(private readonly service: CompetencyCertService) {}

  @Post('organizations/:orgId/campaigns/:campaignId/issue-certifications')
  @OrgRoles('OWNER', 'ADMIN')
  issueByCampaign(
    @Param('orgId') orgId: string,
    @Param('campaignId') campaignId: string,
  ) {
    return this.service.issueByCampaign(orgId, campaignId);
  }

  @Get('organizations/:orgId/members/:memberId/certifications')
  @OrgRoles('OWNER', 'ADMIN', 'MANAGER', 'MEMBER')
  findByMember(
    @Param('orgId') orgId: string,
    @Param('memberId') memberId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('orgRole') orgRole: string,
    @Query('status') status?: string,
  ) {
    return this.service.findByMember(
      orgId,
      memberId,
      userId,
      orgRole ?? 'MEMBER',
      status,
    );
  }

  @Get('organizations/:orgId/certifications')
  @OrgRoles('OWNER', 'ADMIN', 'MANAGER')
  findByOrg(
    @Param('orgId') orgId: string,
    @Query('competencyId') competencyId?: string,
    @Query('groupId') groupId?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.findByOrg(orgId, {
      competencyId,
      groupId,
      status,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20,
    });
  }

  @Get('organizations/:orgId/certifications/compliance')
  @OrgRoles('OWNER', 'ADMIN')
  getCompliance(
    @Param('orgId') orgId: string,
    @Query('competencyId') competencyId?: string,
    @Query('groupId') groupId?: string,
    @Query('status') status?: string,
  ) {
    return this.service.getCompliance(orgId, { competencyId, groupId, status });
  }
}
