import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { PeerReviewService } from './peer-review.service';
import { PeerReviewController } from './peer-review.controller';

@Module({
  imports: [PrismaModule],
  controllers: [PeerReviewController],
  providers: [PeerReviewService],
  exports: [PeerReviewService],
})
export class PeerReviewModule {}
