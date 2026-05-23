import { Module } from '@nestjs/common';
import { SquadsService } from './squads.service';
import { SquadsController } from './squads.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { PeerReviewModule } from './peer-review/peer-review.module';

@Module({
  imports: [PrismaModule, PeerReviewModule],
  controllers: [SquadsController],
  providers: [SquadsService],
  exports: [SquadsService],
})
export class SquadsModule {}
