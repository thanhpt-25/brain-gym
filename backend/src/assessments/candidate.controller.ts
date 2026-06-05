import { Controller, Get, Post, Param, Body, Ip, UseGuards } from '@nestjs/common';
import { CandidateService } from './candidate.service';
import { CandidateSubmitDto } from './dto/candidate-submit.dto';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../common/decorators/public.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrgRoleGuard } from '../organizations/guards/org-role.guard';
import { OrgRoles } from '../organizations/decorators/org-roles.decorator';

@Controller('assessments/take')
@SkipThrottle()
export class CandidateController {
  constructor(private readonly service: CandidateService) {}

  @Get(':token')
  @Public()
  loadAssessment(@Param('token') token: string) {
    return this.service.loadAssessment(token);
  }

  @Post(':token/otp/request')
  @Public()
  requestOtp(@Param('token') token: string) {
    return this.service.requestOtp(token);
  }

  @Post(':token/otp/verify')
  @Public()
  verifyOtp(
    @Param('token') token: string,
    @Body('code') code: string,
  ) {
    return this.service.verifyOtp(token, code);
  }

  @Post(':token/start')
  @Public()
  startAttempt(@Param('token') token: string, @Ip() ip: string) {
    return this.service.startAttempt(token, ip);
  }

  @Post(':token/submit')
  @Public()
  submitAttempt(
    @Param('token') token: string,
    @Body() dto: CandidateSubmitDto,
  ) {
    return this.service.submitAttempt(token, dto);
  }

  @Post(':token/event')
  @Public()
  reportEvent(
    @Param('token') token: string,
    @Body('eventType') eventType: string,
    @Body('clientTs') clientTs: string,
    @Body('payload') payload: any,
  ) {
    return this.service.reportEvent(token, eventType, clientTs, payload);
  }
}
