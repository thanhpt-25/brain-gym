import { Module } from '@nestjs/common';
import { TrainingController } from './training.controller';
import { TrainingService } from './training.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { LlmUsageModule } from '../ai-question-bank/llm-usage/llm-usage.module';
import { CoachRampService } from './coach/coach-ramp.service';
import { CoachSafetyService } from './coach/coach-safety.service';
import { CoachService } from './coach/coach.service';
import { CoachController } from './coach/coach.controller';
import { BurnoutDetector } from './coach/burnout.detector';
import { BurnoutController } from './coach/burnout.controller';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [PrismaModule, AnalyticsModule, LlmUsageModule, CommonModule],
  controllers: [TrainingController, CoachController, BurnoutController],
  providers: [
    TrainingService,
    CoachRampService,
    CoachSafetyService,
    CoachService,
    BurnoutDetector,
  ],
  exports: [
    TrainingService,
    CoachRampService,
    CoachSafetyService,
    CoachService,
    BurnoutDetector,
  ],
})
export class TrainingModule {}
