import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { DigestGenerationService } from './digest-generation.service';
import { DigestGenerationProcessor } from './digest-generation.processor';
import { DigestSchedulerService } from './digest-scheduler.service';
import { DigestController } from './digest.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { BehavioralModule } from '../../insights/behavioral/behavioral.module';
import { MailService } from '../mail.service';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'DIGEST_GENERATION',
    }),
    PrismaModule,
    BehavioralModule,
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
