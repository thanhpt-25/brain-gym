import { Module } from '@nestjs/common';
import { InterviewPacketService } from './interview-packet.service';
import { InterviewPacketController } from './interview-packet.controller';
import { InterviewPacketPublicController } from './interview-packet-public.controller';
import { ScorecardModule } from '../scorecard/scorecard.module';

@Module({
  imports: [ScorecardModule],
  controllers: [InterviewPacketController, InterviewPacketPublicController],
  providers: [InterviewPacketService],
})
export class InterviewPacketModule {}
