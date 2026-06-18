import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Res,
  Header,
} from '@nestjs/common';
import type { Response } from 'express';
import { AssessmentsService } from './assessments.service';
import { CandidateService } from './candidate.service';
import { CreateAssessmentDto } from './dto/create-assessment.dto';
import { UpdateAssessmentDto } from './dto/update-assessment.dto';
import { InviteCandidateDto } from './dto/invite-candidate.dto';
import { UpdateCandidateDecisionDto } from './dto/update-candidate-decision.dto';
import { BulkCsvInviteDto } from './dto/bulk-csv-invite.dto';
import { OrgRoleGuard } from '../organizations/guards/org-role.guard';
import { OrgRoles } from '../common/decorators/org-roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AssessmentStatus } from '@prisma/client';

@Controller('organizations/:orgId/assessments')
@UseGuards(JwtAuthGuard, OrgRoleGuard)
@OrgRoles('OWNER', 'ADMIN', 'MANAGER', 'RECRUITER')
export class AssessmentsController {
  constructor(
    private readonly service: AssessmentsService,
    private readonly candidateService: CandidateService,
  ) {}

  @Get()
  list(
    @Param('orgId') orgId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.list(
      orgId,
      Math.max(1, Number(page) || 1),
      Number(limit) || 20,
    );
  }

  /** Preview: count APPROVED questions available for a given pool filter config. */
  @Get('pool-count')
  getPoolCount(
    @Param('orgId') orgId: string,
    @Query('difficulty') difficulty?: string,
    @Query('certificationId') certificationId?: string,
    @Query('categories') categories?: string,
    @Query('tags') tags?: string,
  ) {
    return this.service.getPoolCount(orgId, {
      difficulty: difficulty || undefined,
      certificationId: certificationId || undefined,
      categories: categories
        ? categories
            .split(',')
            .map((c) => c.trim())
            .filter(Boolean)
        : undefined,
      tags: tags
        ? tags
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean)
        : undefined,
    });
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
  getResults(
    @Param('orgId') orgId: string,
    @Param('aid') aid: string,
    @Query('filter') filter?: string,
  ) {
    return this.service.getResults(orgId, aid, filter);
  }

  @Get(':aid/results/export')
  @OrgRoles('OWNER', 'ADMIN')
  @Header('Content-Type', 'text/csv')
  async exportCsv(
    @Param('orgId') orgId: string,
    @Param('aid') aid: string,
    @Res() res: Response,
    @Query('filter') filter?: string,
  ) {
    const csv = await this.service.exportCsv(orgId, aid, filter);
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="assessment-results.csv"',
    );
    res.send(csv);
  }

  @Post(':aid/candidates/bulk-csv')
  bulkCsvInvite(
    @Param('orgId') orgId: string,
    @Param('aid') aid: string,
    @Body() dto: BulkCsvInviteDto,
  ) {
    return this.service.bulkCsvInvite(orgId, aid, dto);
  }

  @Patch(':aid/candidates/:inviteId')
  updateCandidateDecision(
    @Param('orgId') orgId: string,
    @Param('aid') aid: string,
    @Param('inviteId') inviteId: string,
    @Body() dto: UpdateCandidateDecisionDto,
    @CurrentUser() user: any,
  ) {
    return this.service.updateCandidateDecision(
      orgId,
      aid,
      inviteId,
      dto,
      user.id,
    );
  }

  @Get(':aid/candidates/:inviteId/events')
  getCandidateEvents(
    @Param('aid') aid: string,
    @Param('inviteId') inviteId: string,
  ) {
    return this.candidateService.getEvents(inviteId, aid);
  }

  @Delete(':aid')
  @OrgRoles('OWNER', 'ADMIN')
  delete(@Param('orgId') orgId: string, @Param('aid') aid: string) {
    return this.service.delete(orgId, aid);
  }
}
