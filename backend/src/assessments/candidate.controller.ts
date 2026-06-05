import { Controller, Get, Post, Param, Body, Ip } from '@nestjs/common';
import { CandidateService } from './candidate.service';
import { CandidateSubmitDto } from './dto/candidate-submit.dto';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { Public } from '../common/decorators/public.decorator';

@Controller('assessments/take')
@SkipThrottle()
export class CandidateController {
  constructor(private readonly service: CandidateService) {}

  @Get(':token')
  @Public()
  loadAssessment(@Param('token') token: string) {
    return this.service.loadAssessment(token);
  }

  // 5 requests per 10 minutes per IP — prevents OTP brute-force
  @Post(':token/otp/request')
  @Public()
  @SkipThrottle({ default: false })
  @Throttle({ default: { limit: 5, ttl: 600_000 } })
  requestOtp(@Param('token') token: string) {
    return this.service.requestOtp(token);
  }

  // 10 attempts per 10 minutes per IP — 6-digit space is 10^6, this makes it infeasible
  @Post(':token/otp/verify')
  @Public()
  @SkipThrottle({ default: false })
  @Throttle({ default: { limit: 10, ttl: 600_000 } })
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
