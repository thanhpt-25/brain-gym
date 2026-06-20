import {
  Controller,
  Get,
  Put,
  Param,
  Body,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { ScorecardService } from './scorecard.service';
import { UpsertDomainMappingDto } from './dto/upsert-domain-mapping.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrgRoleGuard } from '../organizations/guards/org-role.guard';
import { OrgRoles } from '../common/decorators/org-roles.decorator';

@Controller('organizations/:orgId/assessments/:assessmentId')
@UseGuards(JwtAuthGuard, OrgRoleGuard)
export class ScorecardController {
  constructor(private readonly service: ScorecardService) {}

  @Get('domain-mapping')
  @OrgRoles('OWNER', 'ADMIN', 'MANAGER')
  getDomainMappings(
    @Param('orgId') orgId: string,
    @Param('assessmentId') assessmentId: string,
  ) {
    return this.service.getDomainMappings(orgId, assessmentId);
  }

  @Put('domain-mapping')
  @OrgRoles('OWNER', 'ADMIN', 'MANAGER')
  upsertDomainMappings(
    @Param('orgId') orgId: string,
    @Param('assessmentId') assessmentId: string,
    @Body() dto: UpsertDomainMappingDto,
  ) {
    return this.service.upsertDomainMappings(orgId, assessmentId, dto);
  }

  @Get('candidates/:inviteId/scorecard')
  @OrgRoles('OWNER', 'ADMIN', 'MANAGER', 'RECRUITER')
  getScorecard(
    @Param('orgId') orgId: string,
    @Param('assessmentId') assessmentId: string,
    @Param('inviteId') inviteId: string,
    @Query('jobRoleId') jobRoleId?: string,
  ) {
    return this.service.buildForCandidate(
      orgId,
      assessmentId,
      inviteId,
      jobRoleId,
    );
  }

  @Get('candidates/:inviteId/scorecard/csv')
  @OrgRoles('OWNER', 'ADMIN', 'MANAGER', 'RECRUITER')
  async getScorecardCsv(
    @Param('orgId') orgId: string,
    @Param('assessmentId') assessmentId: string,
    @Param('inviteId') inviteId: string,
    @Query('jobRoleId') jobRoleId: string | undefined,
    @Res() res: Response,
  ) {
    const csv = await this.service.exportCsv(
      orgId,
      assessmentId,
      inviteId,
      jobRoleId,
    );
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="scorecard-${inviteId}.csv"`,
    );
    res.send(csv);
  }
}
