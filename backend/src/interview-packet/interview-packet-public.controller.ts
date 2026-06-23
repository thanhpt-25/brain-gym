import { Controller, Get, Param } from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { Public } from '../common/decorators/public.decorator';
import { InterviewPacketService } from './interview-packet.service';

@Controller('packet')
@SkipThrottle()
export class InterviewPacketPublicController {
  constructor(private readonly service: InterviewPacketService) {}

  @Get(':token')
  @Public()
  @SkipThrottle({ default: false })
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  getPacket(@Param('token') token: string) {
    return this.service.getPacket(token);
  }
}
