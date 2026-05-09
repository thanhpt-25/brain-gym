import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  UseGuards,
  Query,
  Param,
  Body,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { AuditService } from '../audit/audit.service';
import { RolesGuard } from '../auth/guards/roles.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

interface AdminRequest extends Request {
  user: {
    sub?: string;
    id?: string;
    email?: string;
  };
}

interface BadgeCriteria {
  [key: string]: unknown;
}

@ApiTags('admin')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiBearerAuth()
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly auditService: AuditService,
  ) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Get admin dashboard statistics' })
  getDashboard() {
    return this.adminService.getDashboard();
  }

  @Get('exams')
  @ApiOperation({ summary: 'List all exams (admin view)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({
    name: 'visibility',
    required: false,
    enum: ['PUBLIC', 'PRIVATE', 'LINK'],
  })
  getExams(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('visibility') visibility?: string,
  ) {
    return this.adminService.getExams({
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
      visibility,
    });
  }

  @Get('generation-jobs')
  @ApiOperation({ summary: 'List all AI generation jobs' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'],
  })
  getGenerationJobs(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
  ) {
    return this.adminService.getGenerationJobs({
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
      status,
    });
  }

  @Get('domains')
  @ApiOperation({ summary: 'List all domains with stats' })
  @ApiQuery({ name: 'certificationId', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getDomains(
    @Query('certificationId') certificationId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.getDomains({
      certificationId,
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
    });
  }

  @Get('audit-logs')
  @ApiOperation({ summary: 'List audit logs' })
  @ApiQuery({ name: 'action', required: false, type: String })
  @ApiQuery({ name: 'targetType', required: false, type: String })
  @ApiQuery({ name: 'userId', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getAuditLogs(
    @Query('action') action?: string,
    @Query('targetType') targetType?: string,
    @Query('userId') userId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.auditService.findAll({
      action,
      targetType,
      userId,
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
    });
  }

  // ─── Domain CRUD ─────────────────────────────────────────────────────────────

  @Post('domains')
  @ApiOperation({ summary: 'Create a domain for a certification' })
  createDomain(
    @Req() req: AdminRequest,
    @Body()
    body: {
      name: string;
      certificationId: string;
      description?: string;
      weight?: number;
    },
  ) {
    const adminId = (req.user?.sub || req.user?.id) as string;
    return this.adminService.createDomain(body).then(async (domain) => {
      await this.auditService.log({
        userId: adminId,
        action: 'CREATE_DOMAIN',
        targetType: 'Domain',
        targetId: domain.id,
        metadata: { name: domain.name },
      });
      return domain;
    });
  }

  @Put('domains/:id')
  @ApiOperation({ summary: 'Update a domain' })
  updateDomain(
    @Req() req: AdminRequest,
    @Param('id') id: string,
    @Body() body: { name?: string; description?: string; weight?: number },
  ) {
    const adminId = (req.user?.sub || req.user?.id) as string;
    return this.adminService.updateDomain(id, body).then(async (domain) => {
      await this.auditService.log({
        userId: adminId,
        action: 'UPDATE_DOMAIN',
        targetType: 'Domain',
        targetId: id,
      });
      return domain;
    });
  }

  @Delete('domains/:id')
  @ApiOperation({ summary: 'Delete a domain (only if no questions assigned)' })
  deleteDomain(@Req() req: AdminRequest, @Param('id') id: string) {
    const adminId = (req.user?.sub || req.user?.id) as string;
    return this.adminService.deleteDomain(id).then(async () => {
      await this.auditService.log({
        userId: adminId,
        action: 'DELETE_DOMAIN',
        targetType: 'Domain',
        targetId: id,
      });
      return { message: 'Domain deleted' };
    });
  }

  @Put('domains/reorder')
  @ApiOperation({ summary: 'Reorder domains within a certification' })
  reorderDomains(
    @Body() body: { certificationId: string; orderedIds: string[] },
  ) {
    return this.adminService.reorderDomains(
      body.certificationId,
      body.orderedIds,
    );
  }

  // ─── Exam Visibility ─────────────────────────────────────────────────────────

  @Patch('exams/:id/visibility')
  @ApiOperation({ summary: 'Update exam visibility' })
  updateExamVisibility(
    @Req() req: AdminRequest,
    @Param('id') id: string,
    @Body() body: { visibility: string },
  ) {
    const adminId = (req.user?.sub || req.user?.id) as string;
    return this.adminService
      .updateExamVisibility(id, body.visibility)
      .then(async (exam) => {
        await this.auditService.log({
          userId: adminId,
          action: 'UPDATE_EXAM_VISIBILITY',
          targetType: 'Exam',
          targetId: id,
          metadata: { visibility: body.visibility },
        });
        return exam;
      });
  }

  // ─── Source Materials ─────────────────────────────────────────────────────────

  @Get('source-materials')
  @ApiOperation({ summary: 'List all source materials (admin view)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getSourceMaterials(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.getSourceMaterials({
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
    });
  }

  @Delete('source-materials/:id')
  @ApiOperation({ summary: 'Delete a source material' })
  deleteSourceMaterial(@Req() req: AdminRequest, @Param('id') id: string) {
    const adminId = (req.user?.sub || req.user?.id) as string;
    return this.adminService.deleteSourceMaterial(id).then(async () => {
      await this.auditService.log({
        userId: adminId,
        action: 'DELETE_SOURCE_MATERIAL',
        targetType: 'SourceMaterial',
        targetId: id,
      });
      return { message: 'Source material deleted' };
    });
  }

  // ─── Badge Admin ─────────────────────────────────────────────────────────────

  @Post('badges')
  @ApiOperation({ summary: 'Create a badge' })
  createBadge(
    @Req() req: AdminRequest,
    @Body()
    body: {
      name: string;
      description?: string;
      iconUrl?: string;
      criteria?: BadgeCriteria;
    },
  ) {
    const adminId = (req.user?.sub || req.user?.id) as string;
    return this.adminService.createBadge(body).then(async (badge) => {
      await this.auditService.log({
        userId: adminId,
        action: 'CREATE_BADGE',
        targetType: 'Badge',
        targetId: badge.id,
        metadata: { name: badge.name },
      });
      return badge;
    });
  }

  @Put('badges/:id')
  @ApiOperation({ summary: 'Update a badge' })
  updateBadge(
    @Req() req: AdminRequest,
    @Param('id') id: string,
    @Body()
    body: {
      name?: string;
      description?: string;
      iconUrl?: string;
      criteria?: BadgeCriteria;
    },
  ) {
    const adminId = (req.user?.sub || req.user?.id) as string;
    return this.adminService.updateBadge(id, body).then(async (badge) => {
      await this.auditService.log({
        userId: adminId,
        action: 'UPDATE_BADGE',
        targetType: 'Badge',
        targetId: id,
      });
      return badge;
    });
  }

  @Delete('badges/:id')
  @ApiOperation({ summary: 'Delete a badge' })
  deleteBadge(@Req() req: AdminRequest, @Param('id') id: string) {
    const adminId = (req.user?.sub || req.user?.id) as string;
    return this.adminService.deleteBadge(id).then(async () => {
      await this.auditService.log({
        userId: adminId,
        action: 'DELETE_BADGE',
        targetType: 'Badge',
        targetId: id,
      });
      return { message: 'Badge deleted' };
    });
  }

  @Post('badges/:id/award')
  @ApiOperation({ summary: 'Manually award a badge to a user' })
  awardBadge(
    @Req() req: AdminRequest,
    @Param('id') id: string,
    @Body() body: { userId: string },
  ) {
    const adminId = (req.user?.sub || req.user?.id) as string;
    return this.adminService.awardBadge(id, body.userId).then(async (award) => {
      await this.auditService.log({
        userId: adminId,
        action: 'AWARD_BADGE',
        targetType: 'Badge',
        targetId: id,
        metadata: { awardedTo: body.userId },
      });
      return award;
    });
  }

  @Delete('badges/:id/awards/:userId')
  @ApiOperation({ summary: 'Revoke a badge from a user' })
  revokeBadge(
    @Req() req: AdminRequest,
    @Param('id') id: string,
    @Param('userId') userId: string,
  ) {
    const adminId = (req.user?.sub || req.user?.id) as string;
    return this.adminService.revokeBadge(id, userId).then(async () => {
      await this.auditService.log({
        userId: adminId,
        action: 'REVOKE_BADGE',
        targetType: 'Badge',
        targetId: id,
        metadata: { revokedFrom: userId },
      });
      return { message: 'Badge revoked' };
    });
  }

  @Get('badges')
  @ApiOperation({ summary: 'List all badges with award counts (admin view)' })
  getAdminBadges() {
    return this.adminService.getAdminBadges();
  }

  // ─── Bulk Operations ─────────────────────────────────────────────────────────

  @Post('questions/bulk-status')
  @ApiOperation({ summary: 'Bulk approve or reject questions' })
  async bulkQuestionStatus(
    @Req() req: AdminRequest,
    @Body() body: { ids: string[]; status: string },
  ) {
    const adminId = (req.user?.sub || req.user?.id) as string;
    const result = await this.adminService.bulkUpdateQuestionStatus(
      body.ids,
      body.status,
    );
    await this.auditService.log({
      userId: adminId,
      action: 'BULK_QUESTION_STATUS',
      targetType: 'Question',
      targetId: 'bulk',
      metadata: { ids: body.ids, status: body.status, count: body.ids.length },
    });
    return result;
  }

  @Post('users/bulk-role')
  @ApiOperation({ summary: 'Bulk update user roles' })
  async bulkUserRole(
    @Req() req: AdminRequest,
    @Body() body: { userIds: string[]; role: string },
  ) {
    const adminId = (req.user?.sub || req.user?.id) as string;
    const result = await this.adminService.bulkUpdateUserRole(
      body.userIds,
      body.role,
    );
    await this.auditService.log({
      userId: adminId,
      action: 'BULK_USER_ROLE',
      targetType: 'User',
      targetId: 'bulk',
      metadata: {
        userIds: body.userIds,
        role: body.role,
        count: body.userIds.length,
      },
    });
    return result;
  }

  @Patch('users/:userId/plan')
  @ApiOperation({ summary: 'Upgrade or change user plan' })
  async updateUserPlan(
    @Req() req: AdminRequest,
    @Param('userId') userId: string,
    @Body() body: { plan: string },
  ) {
    const adminId = (req.user?.sub || req.user?.id) as string;
    const result = await this.adminService.updateUserPlan(userId, body.plan);
    await this.auditService.log({
      userId: adminId,
      action: 'UPDATE_USER_PLAN',
      targetType: 'User',
      targetId: userId,
      metadata: { plan: body.plan },
    });
    return result;
  }

  // ─── Organization Management ──────────────────────────────────────────────────

  @Get('organizations')
  @ApiOperation({ summary: 'List all organizations (admin)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'search', required: false })
  async getOrganizations(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    return this.adminService.getOrganizations({
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
      search,
    });
  }

  @Get('organizations/:orgId')
  @ApiOperation({ summary: 'Get organization detail (admin)' })
  async getOrganization(@Param('orgId') orgId: string) {
    return this.adminService.getOrganization(orgId);
  }

  @Patch('organizations/:orgId')
  @ApiOperation({ summary: 'Update organization (admin)' })
  async updateOrganization(
    @Req() req: AdminRequest,
    @Param('orgId') orgId: string,
    @Body()
    body: {
      name?: string;
      description?: string;
      industry?: string;
      logoUrl?: string;
      accentColor?: string;
      maxSeats?: number;
      isActive?: boolean;
    },
  ) {
    const adminId = (req.user?.sub || req.user?.id) as string;
    const result = await this.adminService.updateOrganization(orgId, body);
    await this.auditService.log({
      userId: adminId,
      action: 'UPDATE_ORGANIZATION',
      targetType: 'Organization',
      targetId: orgId,
      metadata: body,
    });
    return result;
  }

  @Delete('organizations/:orgId')
  @ApiOperation({ summary: 'Delete organization (admin)' })
  async deleteOrganization(
    @Req() req: AdminRequest,
    @Param('orgId') orgId: string,
  ) {
    const adminId = (req.user?.sub || req.user?.id) as string;
    const result = await this.adminService.deleteOrganization(orgId);
    await this.auditService.log({
      userId: adminId,
      action: 'DELETE_ORGANIZATION',
      targetType: 'Organization',
      targetId: orgId,
    });
    return result;
  }

  @Get('organizations/:orgId/members')
  @ApiOperation({ summary: 'List members of an organization (admin)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async getOrgMembers(
    @Param('orgId') orgId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.getOrgMembers(orgId, {
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
    });
  }

  @Patch('organizations/:orgId/members/:userId')
  @ApiOperation({ summary: 'Update member role in organization (admin)' })
  async updateOrgMemberRole(
    @Req() req: AdminRequest,
    @Param('orgId') orgId: string,
    @Param('userId') userId: string,
    @Body() body: { role: string },
  ) {
    const adminId = (req.user?.sub || req.user?.id) as string;
    const result = await this.adminService.updateOrgMemberRole(
      orgId,
      userId,
      body.role,
    );
    await this.auditService.log({
      userId: adminId,
      action: 'UPDATE_ORG_MEMBER_ROLE',
      targetType: 'OrgMember',
      targetId: `${orgId}/${userId}`,
      metadata: { role: body.role },
    });
    return result;
  }

  @Delete('organizations/:orgId/members/:userId')
  @ApiOperation({ summary: 'Remove member from organization (admin)' })
  async removeOrgMember(
    @Req() req: AdminRequest,
    @Param('orgId') orgId: string,
    @Param('userId') userId: string,
  ) {
    const adminId = (req.user?.sub || req.user?.id) as string;
    const result = await this.adminService.removeOrgMember(orgId, userId);
    await this.auditService.log({
      userId: adminId,
      action: 'REMOVE_ORG_MEMBER',
      targetType: 'OrgMember',
      targetId: `${orgId}/${userId}`,
    });
    return result;
  }

  // ─── Data Export ─────────────────────────────────────────────────────────────

  @Get('export/users')
  @ApiOperation({ summary: 'Export users as CSV' })
  async exportUsers(@Res() res: Response) {
    const csv = await this.adminService.exportUsers();
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="users.csv"');
    res.send(csv);
  }

  @Get('export/questions')
  @ApiOperation({ summary: 'Export questions as CSV' })
  async exportQuestions(@Res() res: Response) {
    const csv = await this.adminService.exportQuestions();
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="questions.csv"',
    );
    res.send(csv);
  }

  @Get('export/analytics')
  @ApiOperation({ summary: 'Export exam analytics as CSV' })
  async exportAnalytics(@Res() res: Response) {
    const csv = await this.adminService.exportAnalytics();
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="analytics.csv"',
    );
    res.send(csv);
  }
}
