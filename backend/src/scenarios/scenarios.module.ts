import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from '../prisma/prisma.module';
import { LlmUsageModule } from '../ai-question-bank/llm-usage/llm-usage.module';
import { ScenariosService } from './scenarios.service';
import { ScenarioGenerationProcessor } from './scenario-generation.processor';
import { ExplanationGenerationService } from './explanation-generation.service';
import { ScenariosController } from './scenarios.controller';
import { SCENARIO_GENERATION_QUEUE } from '../queues/scenario-generation/scenario-generation.job.interface';

@Module({
  imports: [
    BullModule.registerQueue({
      name: SCENARIO_GENERATION_QUEUE,
    }),
    PrismaModule,
    LlmUsageModule,
  ],
  providers: [
    ScenariosService,
    ScenarioGenerationProcessor,
    ExplanationGenerationService,
  ],
  controllers: [ScenariosController],
  exports: [ScenariosService],
})
export class ScenariosModule {}
