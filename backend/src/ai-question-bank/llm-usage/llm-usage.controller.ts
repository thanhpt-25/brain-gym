import { Controller, Get, UseGuards, Req, Query } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { LlmUsageService } from './llm-usage.service';

@Controller('ai-question-bank/llm-usage')
@UseGuards(JwtAuthGuard)
export class LlmUsageController {
  constructor(
    private readonly llmUsageService: LlmUsageService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('metrics')
  async getMetrics(@Req() req: any, @Query('days') daysStr?: string) {
    const userId = req.user.id;
    const days = daysStr ? parseInt(daysStr, 10) : 30;

    // Get user's org
    const membership = await this.prisma.orgMember.findFirst({
      where: { userId },
      include: { organization: true },
    });

    const orgId = membership?.orgId;

    // Get total cost for period
    let totalCostUsd = 0;
    const dailyCosts: Array<{ date: string; cost: number }> = [];

    if (orgId) {
      for (let i = 0; i < days; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dayCost = await this.llmUsageService.getOrgDailyCost(orgId, date);
        if (dayCost > 0) {
          dailyCosts.unshift({
            date: date.toISOString().split('T')[0],
            cost: parseFloat(dayCost.toFixed(4)),
          });
        }
        totalCostUsd += dayCost;
      }
    }

    // Get token usage for period
    let totalTokens = 0;
    let inputTokens = 0;
    let outputTokens = 0;

    if (orgId) {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      startDate.setHours(0, 0, 0, 0);

      const events = await this.prisma.llmUsageEvent.findMany({
        where: {
          orgId,
          createdAt: { gte: startDate },
        },
        select: {
          inputTokens: true,
          outputTokens: true,
        },
      });

      inputTokens = events.reduce((sum, e) => sum + e.inputTokens, 0);
      outputTokens = events.reduce((sum, e) => sum + e.outputTokens, 0);
      totalTokens = inputTokens + outputTokens;
    }

    // Calculate quota (placeholder: $20 monthly budget)
    const monthlyQuota = 20;
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    let monthCost = 0;
    if (orgId) {
      const monthEvents = await this.prisma.llmUsageEvent.aggregate({
        where: {
          orgId,
          createdAt: { gte: monthStart },
        },
        _sum: { costUsd: true },
      });
      monthCost = monthEvents._sum?.costUsd
        ? parseFloat(monthEvents._sum.costUsd.toString())
        : 0;
    }

    const remainingQuota = Math.max(0, monthlyQuota - monthCost);
    const quotaUsedPercent = monthlyQuota > 0 ? (monthCost / monthlyQuota) * 100 : 0;

    return {
      totalCostUsd: parseFloat(totalCostUsd.toFixed(4)),
      tokenCount: totalTokens,
      inputTokens,
      outputTokens,
      dailyCostTrend: dailyCosts,
      monthlyQuota,
      monthlyUsed: parseFloat(monthCost.toFixed(4)),
      estimatedRemainingQuota: parseFloat(remainingQuota.toFixed(4)),
      quotaUsedPercent: parseFloat(quotaUsedPercent.toFixed(1)),
    };
  }
}
