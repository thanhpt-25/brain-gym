import { Controller, Get, Param, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { ExecutiveDashboardService } from './executive-dashboard.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrgRoleGuard } from '../organizations/guards/org-role.guard';
import { OrgRoles } from '../common/decorators/org-roles.decorator';

@Controller('organizations/:orgId/executive-dashboard')
@UseGuards(JwtAuthGuard, OrgRoleGuard)
@OrgRoles('OWNER', 'ADMIN')
export class ExecutiveDashboardController {
  constructor(private readonly service: ExecutiveDashboardService) {}

  @Get()
  getDashboard(@Param('orgId') orgId: string) {
    return this.service.getDashboard(orgId);
  }

  @Get('compliance')
  getCompliance(@Param('orgId') orgId: string) {
    return this.service.getComplianceMetrics(orgId);
  }

  @Get('hiring-funnel')
  getHiringFunnel(@Param('orgId') orgId: string) {
    return this.service.getHiringFunnel(orgId);
  }

  @Get('integrity')
  getIntegrity(@Param('orgId') orgId: string) {
    return this.service.getIntegrityMetrics(orgId);
  }

  @Get('export/csv')
  async exportCsv(@Param('orgId') orgId: string, @Res() res: Response) {
    const csv = await this.service.exportCsv(orgId);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="executive-dashboard-${orgId}-${Date.now()}.csv"`,
    );
    res.send(csv);
  }
}
