import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { OrgQuestionsService } from './org-questions.service';
import { CreateOrgQuestionDto } from './dto/create-org-question.dto';
import { UpdateOrgQuestionDto } from './dto/update-org-question.dto';
import { ListOrgQuestionsDto } from './dto/list-org-questions.dto';
import { RejectOrgQuestionDto } from './dto/reject-org-question.dto';
import { OrgRoleGuard } from '../organizations/guards/org-role.guard';
import { OrgRoles } from '../common/decorators/org-roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { OrgRole } from '@prisma/client';

@ApiTags('org-questions')
@ApiBearerAuth()
@SkipThrottle()
@Controller('organizations/:orgId/questions')
@UseGuards(OrgRoleGuard)
export class OrgQuestionsController {
  constructor(private readonly orgQuestionsService: OrgQuestionsService) {}

  @Get()
  @ApiOperation({ summary: 'List org questions (paginated, filtered)' })
  findAll(
    @Param('orgId') orgId: string,
    @Query() filters: ListOrgQuestionsDto,
  ) {
    return this.orgQuestionsService.findAll(orgId, filters);
  }

  @Get(':questionId')
  @ApiOperation({ summary: 'Get single org question' })
  findOne(
    @Param('orgId') orgId: string,
    @Param('questionId') questionId: string,
  ) {
    return this.orgQuestionsService.findOne(orgId, questionId);
  }

  @Post()
  @ApiOperation({ summary: 'Create org question (DRAFT)' })
  create(
    @Param('orgId') orgId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CreateOrgQuestionDto,
  ) {
    return this.orgQuestionsService.create(orgId, userId, dto);
  }

  @Patch(':questionId')
  @ApiOperation({ summary: 'Update org question (DRAFT/REJECTED only)' })
  update(
    @Param('orgId') orgId: string,
    @Param('questionId') questionId: string,
    @CurrentUser('id') userId: string,
    @Req() req: any,
    @Body() dto: UpdateOrgQuestionDto,
  ) {
    const role = req.orgMembership?.role || OrgRole.MEMBER;
    return this.orgQuestionsService.update(
      orgId,
      questionId,
      userId,
      role,
      dto,
    );
  }

  @Delete(':questionId')
  @ApiOperation({ summary: 'Delete org question' })
  remove(
    @Param('orgId') orgId: string,
    @Param('questionId') questionId: string,
    @CurrentUser('id') userId: string,
    @Req() req: any,
  ) {
    const role = req.orgMembership?.role || OrgRole.MEMBER;
    return this.orgQuestionsService.remove(orgId, questionId, userId, role);
  }

  @Post(':questionId/submit')
  @ApiOperation({
    summary: 'Submit question for review (DRAFT → UNDER_REVIEW)',
  })
  submitForReview(
    @Param('orgId') orgId: string,
    @Param('questionId') questionId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.orgQuestionsService.submitForReview(orgId, questionId, userId);
  }

  @Post(':questionId/approve')
  @OrgRoles(OrgRole.OWNER, OrgRole.ADMIN)
  @ApiOperation({ summary: 'Approve question (UNDER_REVIEW → APPROVED)' })
  approve(
    @Param('orgId') orgId: string,
    @Param('questionId') questionId: string,
  ) {
    return this.orgQuestionsService.approve(orgId, questionId);
  }

  @Post(':questionId/reject')
  @OrgRoles(OrgRole.OWNER, OrgRole.ADMIN)
  @ApiOperation({ summary: 'Reject question (UNDER_REVIEW → REJECTED)' })
  reject(
    @Param('orgId') orgId: string,
    @Param('questionId') questionId: string,
    @Body() dto: RejectOrgQuestionDto,
  ) {
    return this.orgQuestionsService.reject(orgId, questionId);
  }

  @Post('clone/:sourceQuestionId')
  @ApiOperation({ summary: 'Clone a public question into the org bank' })
  cloneFromPublic(
    @Param('orgId') orgId: string,
    @Param('sourceQuestionId') sourceQuestionId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.orgQuestionsService.cloneFromPublic(
      orgId,
      userId,
      sourceQuestionId,
    );
  }
}
