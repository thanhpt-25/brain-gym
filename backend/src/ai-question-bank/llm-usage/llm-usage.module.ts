import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { LlmUsageService } from './llm-usage.service';
import { LlmQuotaService } from './llm-quota.service';

/**
 * RFC-012: LLM Usage & Quota Module
 * Provides services for recording LLM API usage events and enforcing per-org quotas
 */
@Module({
  imports: [PrismaModule],
  providers: [LlmUsageService, LlmQuotaService],
  exports: [LlmUsageService, LlmQuotaService],
})
export class LlmUsageModule {}
