import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { LlmUsageModule } from '../llm-usage/llm-usage.module';
import { DdsService } from './dds.service';
import { DdsController } from './dds.controller';

@Module({
  imports: [PrismaModule, LlmUsageModule],
  controllers: [DdsController],
  providers: [DdsService],
  exports: [DdsService],
})
export class DdsModule {}
