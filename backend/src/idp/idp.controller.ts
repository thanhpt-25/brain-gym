import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { IdpService, UpsertReviewDto, CreateIdpDto } from './idp.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrgRoleGuard } from '../organizations/guards/org-role.guard';
import { OrgRoles } from '../common/decorators/org-roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller()
@UseGuards(JwtAuthGuard, OrgRoleGuard)
export class IdpController {
  constructor(private readonly service: IdpService) {}

  // ─── Campaign Member Reviews ──────────────────────────────────────

  @Get('organizations/:orgId/campaigns/:campaignId/reviews')
  @OrgRoles('OWNER', 'ADMIN', 'MANAGER')
  listCampaignReviews(
    @Param('orgId') orgId: string,
    @Param('campaignId') campaignId: string,
  ) {
    return this.service.listCampaignReviews(orgId, campaignId);
  }

  @Get('organizations/:orgId/campaigns/:campaignId/reviews/:memberId')
  @OrgRoles('OWNER', 'ADMIN', 'MANAGER')
  getReview(
    @Param('orgId') orgId: string,
    @Param('campaignId') campaignId: string,
    @Param('memberId') memberId: string,
  ) {
    return this.service.getReview(orgId, campaignId, memberId);
  }

  @Post('organizations/:orgId/campaigns/:campaignId/reviews/:memberId')
  @OrgRoles('OWNER', 'ADMIN', 'MANAGER')
  upsertReview(
    @Param('orgId') orgId: string,
    @Param('campaignId') campaignId: string,
    @Param('memberId') memberId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpsertReviewDto,
  ) {
    return this.service.upsertReview(orgId, campaignId, memberId, userId, dto);
  }

  // ─── Member IDPs ──────────────────────────────────────────────────

  @Get('organizations/:orgId/members/:memberId/idp')
  @OrgRoles('OWNER', 'ADMIN', 'MANAGER', 'MEMBER')
  listIdps(
    @Param('orgId') orgId: string,
    @Param('memberId') memberId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('orgRole') orgRole: string,
  ) {
    return this.service.listIdps(orgId, memberId, userId, orgRole ?? 'MEMBER');
  }

  @Post('organizations/:orgId/members/:memberId/idp')
  @OrgRoles('OWNER', 'ADMIN', 'MANAGER')
  createIdp(
    @Param('orgId') orgId: string,
    @Param('memberId') memberId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CreateIdpDto,
  ) {
    return this.service.createIdp(orgId, memberId, userId, dto);
  }

  @Patch('organizations/:orgId/members/:memberId/idp/:idpId/complete')
  @OrgRoles('OWNER', 'ADMIN', 'MANAGER', 'MEMBER')
  completeIdp(
    @Param('orgId') orgId: string,
    @Param('memberId') memberId: string,
    @Param('idpId') idpId: string,
  ) {
    return this.service.completeIdp(orgId, memberId, idpId);
  }

  @Delete('organizations/:orgId/members/:memberId/idp/:idpId')
  @OrgRoles('OWNER', 'ADMIN', 'MANAGER')
  deleteIdp(
    @Param('orgId') orgId: string,
    @Param('memberId') memberId: string,
    @Param('idpId') idpId: string,
  ) {
    return this.service.deleteIdp(orgId, memberId, idpId);
  }
}
