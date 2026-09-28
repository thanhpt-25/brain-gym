import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AttemptsController } from './attempts.controller';
import { AttemptsService } from './attempts.service';
import { GamificationModule } from '../gamification/gamification.module';
import { ExamsModule } from '../exams/exams.module';
import { EXAM_CLEANUP_QUEUE } from './cleanup/exam-cleanup.constants';
import { ExamCleanupService } from './cleanup/exam-cleanup.service';
import { ExamCleanupProcessor } from './cleanup/exam-cleanup.processor';
import { ExamCleanupScheduler } from './cleanup/exam-cleanup.scheduler';

@Module({
  imports: [
    GamificationModule,
    ExamsModule,
    BullModule.registerQueue({ name: EXAM_CLEANUP_QUEUE }),
  ],
  controllers: [AttemptsController],
  providers: [
    AttemptsService,
    ExamCleanupService,
    ExamCleanupProcessor,
    ExamCleanupScheduler,
  ],
  exports: [AttemptsService],
})
export class AttemptsModule {}
