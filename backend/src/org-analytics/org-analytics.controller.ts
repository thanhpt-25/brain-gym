import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
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
@UseGuards(JwtAuthGuard, OrgRoleGuard)
@OrgRoles(OrgRole.OWNER, OrgRole.ADMIN, OrgRole.MANAGER)
@ApiBearerAuth()
export class OrgAnalyticsController {
  constructor(private readonly orgAnalyticsService: OrgAnalyticsService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Get team overview KPIs' })
  getOverview(@Param('orgId') orgId: string) {
    return this.orgAnalyticsService.getOverview(orgId);
  }

  @Get('readiness')
  @ApiOperation({ summary: 'Get per-certification readiness across team' })
  getReadiness(@Param('orgId') orgId: string) {
    return this.orgAnalyticsService.getReadiness(orgId);
  }

  @Get('skill-gaps')
  @ApiOperation({ summary: 'Get domain-level weakness analysis' })
  getSkillGaps(@Param('orgId') orgId: string) {
    return this.orgAnalyticsService.getSkillGaps(orgId);
  }

  @Get('progress')
  @ApiOperation({ summary: 'Get week-over-week progress trends' })
  @ApiQuery({
    name: 'weeks',
    required: false,
    type: Number,
    minimum: 1,
    maximum: 52,
  })
  getProgress(@Param('orgId') orgId: string, @Query('weeks') weeks?: string) {
    const w = weeks ? Math.min(52, Math.max(1, +weeks)) : 12;
    return this.orgAnalyticsService.getProgress(orgId, w);
  }

  @Get('engagement')
  @ApiOperation({ summary: 'Get engagement metrics' })
  getEngagement(@Param('orgId') orgId: string) {
    return this.orgAnalyticsService.getEngagement(orgId);
  }

  @Get('member/:userId')
  @ApiOperation({ summary: 'Get individual member deep-dive analytics' })
  getMemberAnalytics(
    @Param('orgId') orgId: string,
    @Param('userId') userId: string,
  ) {
    return this.orgAnalyticsService.getMemberAnalytics(orgId, userId);
  }

  @Get('competency-profile')
  @ApiOperation({
    summary: 'Get competency profile for org or individual member',
  })
  @ApiQuery({ name: 'memberId', required: false })
  @ApiQuery({ name: 'jobRoleId', required: false })
  getCompetencyProfile(
    @Param('orgId') orgId: string,
    @Query('memberId') memberId?: string,
    @Query('jobRoleId') jobRoleId?: string,
  ) {
    return this.orgAnalyticsService.getCompetencyProfile(
      orgId,
      memberId,
      jobRoleId,
    );
  }

  @Get('competency-heatmap')
  @ApiOperation({
    summary: 'Get competency heatmap (all members x all competencies)',
  })
  getCompetencyHeatmap(@Param('orgId') orgId: string) {
    return this.orgAnalyticsService.getCompetencyHeatmap(orgId);
  }
}
