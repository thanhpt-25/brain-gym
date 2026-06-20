import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CAMPAIGN_RECURRENCE_QUEUE } from './campaign.job.interface';
import { randomUUID } from 'crypto';

@Processor(CAMPAIGN_RECURRENCE_QUEUE)
export class CampaignRecurrenceProcessor extends WorkerHost {
  private readonly logger = new Logger(CampaignRecurrenceProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(_job: Job): Promise<void> {
    const now = new Date();

    const due = await this.prisma.assessmentCampaign.findMany({
      where: {
        recurrenceEnabled: true,
        status: 'ACTIVE',
        nextRunAt: { lte: now },
      },
    });

    this.logger.log(`Campaign recurrence: ${due.length} campaign(s) to clone`);

    for (const campaign of due) {
      try {
        await this.cloneCampaign(campaign, now);
      } catch (err) {
        this.logger.error(`Failed to clone campaign ${campaign.id}`, err);
      }
    }
  }

  private async cloneCampaign(
    parent: {
      id: string;
      orgId: string;
      name: string;
      description: string | null;
      catalogItemId: string;
      recurrenceInterval: string | null;
      dueDate: Date | null;
      createdBy: string;
    },
    now: Date,
  ) {
    if (!parent.recurrenceInterval || !parent.dueDate) return;

    const months =
      parent.recurrenceInterval === 'MONTHLY_3'
        ? 3
        : parent.recurrenceInterval === 'MONTHLY_6'
          ? 6
          : 12;

    const newDueDate = new Date(parent.dueDate);
    newDueDate.setMonth(newDueDate.getMonth() + months);

    const nextNextRunAt = new Date(newDueDate);
    nextNextRunAt.setMonth(nextNextRunAt.getMonth() + months);

    // Clone campaign with incremented name
    const cloneName = `${parent.name} (${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')})`;

    await this.prisma.$transaction([
      this.prisma.assessmentCampaign.create({
        data: {
          id: randomUUID(),
          orgId: parent.orgId,
          name: cloneName,
          description: parent.description,
          catalogItemId: parent.catalogItemId,
          dueDate: newDueDate,
          status: 'ACTIVE',
          recurrenceEnabled: true,
          recurrenceInterval: parent.recurrenceInterval as any,
          nextRunAt: nextNextRunAt,
          parentCampaignId: parent.id,
          createdBy: parent.createdBy,
          updatedAt: now,
        },
      }),
      // Close the parent so the hourly scan won't pick it up again and
      // exponentially clone it each recurrence cycle. The new clone above
      // carries the recurrence chain forward.
      this.prisma.assessmentCampaign.update({
        where: { id: parent.id },
        data: { status: 'CLOSED', recurrenceEnabled: false, nextRunAt: null },
      }),
    ]);

    this.logger.log(
      `Cloned campaign "${parent.name}" → "${cloneName}" due ${newDueDate.toISOString()}`,
    );
  }
}
