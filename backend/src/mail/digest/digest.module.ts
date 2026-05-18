import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { DigestGenerationService } from './digest-generation.service';
import { DigestGenerationProcessor } from './digest-generation.processor';
import { DigestSchedulerService } from './digest-scheduler.service';
import { DigestController } from './digest.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { BehavioralInsightsModule } from '../../ai-question-bank/behavioral-insights/behavioral-insights.module';
import { MailService } from '../mail.service';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'DIGEST_GENERATION',
    }),
    PrismaModule,
    BehavioralInsightsModule,
  ],
  controllers: [DigestController],
  providers: [
    DigestGenerationService,
    DigestGenerationProcessor,
    DigestSchedulerService,
    MailService,
  ],
  exports: [DigestGenerationService],
})
export class DigestModule {}
