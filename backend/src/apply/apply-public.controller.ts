import { Controller, Get, Post, Param, Body, Ip } from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { Public } from '../common/decorators/public.decorator';
import { ApplyService } from './apply.service';
import { PublicApplyDto } from './dto/public-apply.dto';

@Controller('apply')
@SkipThrottle()
export class ApplyPublicController {
  constructor(private readonly service: ApplyService) {}

  @Get(':code')
  @Public()
  @SkipThrottle({ default: false })
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  getLink(@Param('code') code: string) {
    return this.service.getPublicLink(code);
  }

  // 10 submissions per 15 minutes per IP to prevent spam
  @Post(':code')
  @Public()
  @SkipThrottle({ default: false })
  @Throttle({ default: { limit: 10, ttl: 900_000 } })
  submit(
    @Param('code') code: string,
    @Body() dto: PublicApplyDto,
    @Ip() ip: string,
  ) {
    return this.service.submitApplication(code, dto, ip);
  }
}
