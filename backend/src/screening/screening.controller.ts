import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ScreeningService } from './screening.service';
import { CreateScreeningRuleDto } from './dto/create-screening-rule.dto';
import { UpdateScreeningRuleDto } from './dto/update-screening-rule.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrgRoleGuard } from '../organizations/guards/org-role.guard';
import { OrgRoles } from '../common/decorators/org-roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('organizations/:orgId/assessments/:assessmentId/screening-rules')
@UseGuards(JwtAuthGuard, OrgRoleGuard)
export class ScreeningController {
  constructor(private readonly service: ScreeningService) {}

  @Get()
  @OrgRoles('OWNER', 'ADMIN', 'MANAGER', 'RECRUITER')
  list(
    @Param('orgId') orgId: string,
    @Param('assessmentId') assessmentId: string,
  ) {
    return this.service.listRules(orgId, assessmentId);
  }

  @Post()
  @OrgRoles('OWNER', 'ADMIN', 'MANAGER')
  create(
    @Param('orgId') orgId: string,
    @Param('assessmentId') assessmentId: string,
    @Body() dto: CreateScreeningRuleDto,
  ) {
    return this.service.createRule(orgId, assessmentId, dto);
  }

  @Patch(':ruleId')
  @OrgRoles('OWNER', 'ADMIN', 'MANAGER')
  update(
    @Param('orgId') orgId: string,
    @Param('assessmentId') assessmentId: string,
    @Param('ruleId') ruleId: string,
    @Body() dto: UpdateScreeningRuleDto,
  ) {
    return this.service.updateRule(orgId, assessmentId, ruleId, dto);
  }

  @Delete(':ruleId')
  @OrgRoles('OWNER', 'ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(
    @Param('orgId') orgId: string,
    @Param('assessmentId') assessmentId: string,
    @Param('ruleId') ruleId: string,
  ) {
    return this.service.deleteRule(orgId, assessmentId, ruleId);
  }

  @Get('invites/:inviteId/decision-log')
  @OrgRoles('OWNER', 'ADMIN', 'MANAGER', 'RECRUITER')
  decisionLog(
    @Param('orgId') orgId: string,
    @Param('assessmentId') assessmentId: string,
    @Param('inviteId') inviteId: string,
  ) {
    return this.service.getDecisionLog(orgId, assessmentId, inviteId);
  }
}
