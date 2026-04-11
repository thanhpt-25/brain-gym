import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  Res,
  Header,
} from '@nestjs/common';
import type { Response } from 'express';
import { AssessmentsService } from './assessments.service';
import { CreateAssessmentDto } from './dto/create-assessment.dto';
import { UpdateAssessmentDto } from './dto/update-assessment.dto';
import { InviteCandidateDto } from './dto/invite-candidate.dto';
import { OrgRoleGuard } from '../organizations/guards/org-role.guard';
import { OrgRoles } from '../common/decorators/org-roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AssessmentStatus } from '@prisma/client';

@Controller('organizations/:orgId/assessments')
@UseGuards(JwtAuthGuard, OrgRoleGuard)
@OrgRoles('OWNER', 'ADMIN', 'MANAGER')
export class AssessmentsController {
  constructor(private readonly service: AssessmentsService) {}

  @Get()
  list(
    @Param('orgId') orgId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.list(orgId, Number(page) || 1, Number(limit) || 20);
  }

  @Post()
  create(
    @Param('orgId') orgId: string,
    @CurrentUser() user: any,
    @Body() dto: CreateAssessmentDto,
  ) {
    return this.service.create(orgId, user.id, dto);
  }

  @Get(':aid')
  getDetail(@Param('orgId') orgId: string, @Param('aid') aid: string) {
    return this.service.getDetail(orgId, aid);
  }

  @Patch(':aid')
  update(
    @Param('orgId') orgId: string,
    @Param('aid') aid: string,
    @Body() dto: UpdateAssessmentDto,
  ) {
    return this.service.update(orgId, aid, dto);
  }

  @Patch(':aid/status')
  @OrgRoles('OWNER', 'ADMIN')
  updateStatus(
    @Param('orgId') orgId: string,
    @Param('aid') aid: string,
    @Body('status') status: AssessmentStatus,
  ) {
    return this.service.updateStatus(orgId, aid, status);
  }

  @Post(':aid/invite')
  inviteCandidates(
    @Param('orgId') orgId: string,
    @Param('aid') aid: string,
    @Body() dto: InviteCandidateDto,
  ) {
    return this.service.inviteCandidates(orgId, aid, dto);
  }

  @Get(':aid/results')
  getResults(@Param('orgId') orgId: string, @Param('aid') aid: string) {
    return this.service.getResults(orgId, aid);
  }

  @Get(':aid/results/export')
  @OrgRoles('OWNER', 'ADMIN')
  @Header('Content-Type', 'text/csv')
  async exportCsv(
    @Param('orgId') orgId: string,
    @Param('aid') aid: string,
    @Res() res: Response,
  ) {
    const csv = await this.service.exportCsv(orgId, aid);
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="assessment-results.csv"',
    );
    res.send(csv);
  }
}
