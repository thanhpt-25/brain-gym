import { Controller, Get, Param, Query, UseGuards, Req } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { OrgAnalyticsService } from './org-analytics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrgRoleGuard } from '../organizations/guards/org-role.guard';
import { OrgRoles } from '../common/decorators/org-roles.decorator';
import { OrgRole } from '@prisma/client';

@ApiTags('org-analytics')
@Controller('organizations/:orgId/analytics')
export class OrgAnalyticsController {
  constructor(private readonly orgAnalyticsService: OrgAnalyticsService) {}

  @Get('overview')
  @OrgRoles(OrgRole.OWNER, OrgRole.ADMIN, OrgRole.MANAGER)
  @UseGuards(JwtAuthGuard, OrgRoleGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get team overview KPIs' })
  getOverview(@Param('orgId') orgId: string) {
    return this.orgAnalyticsService.getOverview(orgId);
  }

  @Get('readiness')
  @OrgRoles(OrgRole.OWNER, OrgRole.ADMIN, OrgRole.MANAGER)
  @UseGuards(JwtAuthGuard, OrgRoleGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get per-certification readiness across team' })
  getReadiness(@Param('orgId') orgId: string) {
    return this.orgAnalyticsService.getReadiness(orgId);
  }

  @Get('skill-gaps')
  @OrgRoles(OrgRole.OWNER, OrgRole.ADMIN, OrgRole.MANAGER)
  @UseGuards(JwtAuthGuard, OrgRoleGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get domain-level weakness analysis' })
  getSkillGaps(@Param('orgId') orgId: string) {
    return this.orgAnalyticsService.getSkillGaps(orgId);
  }

  @Get('progress')
  @OrgRoles(OrgRole.OWNER, OrgRole.ADMIN, OrgRole.MANAGER)
  @UseGuards(JwtAuthGuard, OrgRoleGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get week-over-week progress trends' })
  @ApiQuery({ name: 'weeks', required: false, type: Number })
  getProgress(@Param('orgId') orgId: string, @Query('weeks') weeks?: string) {
    return this.orgAnalyticsService.getProgress(orgId, weeks ? +weeks : 12);
  }

  @Get('engagement')
  @OrgRoles(OrgRole.OWNER, OrgRole.ADMIN, OrgRole.MANAGER)
  @UseGuards(JwtAuthGuard, OrgRoleGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get engagement metrics' })
  getEngagement(@Param('orgId') orgId: string) {
    return this.orgAnalyticsService.getEngagement(orgId);
  }

  @Get('member/:userId')
  @OrgRoles(OrgRole.OWNER, OrgRole.ADMIN, OrgRole.MANAGER)
  @UseGuards(JwtAuthGuard, OrgRoleGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get individual member deep-dive analytics' })
  getMemberAnalytics(
    @Param('orgId') orgId: string,
    @Param('userId') userId: string,
  ) {
    return this.orgAnalyticsService.getMemberAnalytics(orgId, userId);
  }
}
