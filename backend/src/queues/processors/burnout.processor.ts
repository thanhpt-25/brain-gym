import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BurnoutDetector } from '../../training/coach/burnout.detector';

interface BurnoutJobData {
  userId?: string;
  type: 'check-user' | 'daily-scan';
}

@Processor('burnout-detection')
export class BurnoutProcessor extends WorkerHost {
  private readonly logger = new Logger(BurnoutProcessor.name);

  constructor(
    private prisma: PrismaService,
    private burnoutDetector: BurnoutDetector,
  ) {
    super();
  }

  async process(job: Job<BurnoutJobData>): Promise<void> {
    const { type, userId } = job.data;

    if (type === 'check-user' && userId) {
      await this.checkUserBurnout(userId);
    } else if (type === 'daily-scan') {
      await this.dailyBurnoutScan();
    }
  }

  private async checkUserBurnout(userId: string): Promise<void> {
    this.logger.debug(`Checking burnout for user ${userId}`);

    try {
      const result = await this.burnoutDetector.checkUserBurnout(userId);

      if (result && result.severity !== 'low') {
        this.logger.warn(
          `Burnout detected for user ${userId}: ${result.severity}`,
        );

        // Could emit event here for coach intervention flow
        // e.g., schedule follow-up coach session, send notification, etc.
      }
    } catch (error) {
      this.logger.error(
        `Error checking burnout for user ${userId}`,
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    }
  }

  private async dailyBurnoutScan(): Promise<void> {
    this.logger.log('Starting daily burnout scan...');

    try {
      // Get all active users from past 7 days
      const activeUsers = await this.prisma.user.findMany({
        where: {
          updatedAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
        select: { id: true },
      });

      this.logger.log(`Scanning ${activeUsers.length} active users for burnout`);

      let criticalCount = 0;
      let highCount = 0;

      for (const user of activeUsers) {
        const result = await this.burnoutDetector.checkUserBurnout(user.id);
        if (result) {
          if (result.severity === 'critical') criticalCount++;
          if (result.severity === 'high') highCount++;
        }
      }

      this.logger.log(
        `Burnout scan complete: ${criticalCount} critical, ${highCount} high`,
      );
    } catch (error) {
      this.logger.error(
        'Error in daily burnout scan',
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    }
  }
}
