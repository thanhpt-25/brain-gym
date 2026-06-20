import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../../mail/mail.service';
import { CAMPAIGN_REMINDER_QUEUE } from './campaign.job.interface';

const REMINDER_DAYS_BEFORE = 3;

@Processor(CAMPAIGN_REMINDER_QUEUE)
export class CampaignReminderProcessor extends WorkerHost {
  private readonly logger = new Logger(CampaignReminderProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {
    super();
  }

  async process(_job: Job): Promise<void> {
    const threshold = new Date();
    threshold.setDate(threshold.getDate() + REMINDER_DAYS_BEFORE);

    const campaigns = await this.prisma.assessmentCampaign.findMany({
      where: {
        status: 'ACTIVE',
        dueDate: { lte: threshold, gte: new Date() },
      },
      include: {
        assignments: {
          where: { reminderOptOut: false },
          include: {
            // Group-assigned members
            group: {
              include: {
                members: {
                  include: {
                    user: { select: { email: true, displayName: true } },
                  },
                },
              },
            },
            // Individually-assigned members
            member: {
              include: {
                user: { select: { email: true, displayName: true } },
              },
            },
          },
        },
      },
    });

    this.logger.log(
      `Campaign reminders: ${campaigns.length} active campaign(s) near due date`,
    );

    for (const campaign of campaigns) {
      const emails = this.collectEmails(campaign.assignments ?? []);
      if (emails.length === 0) continue;

      for (const { email, name } of emails) {
        try {
          await this.mailService.sendCampaignReminder({
            to: email,
            name,
            campaignName: campaign.name,
            dueDate: campaign.dueDate!,
          });
        } catch (err) {
          this.logger.error(`Failed to send reminder to ${email}`, err);
        }
      }

      this.logger.log(
        `Sent ${emails.length} reminder(s) for campaign "${campaign.name}"`,
      );
    }
  }

  private collectEmails(
    assignments: Array<{
      group?: {
        members?: Array<{
          user: { email: string; displayName: string };
        }>;
      } | null;
      member?: {
        user: { email: string; displayName: string };
      } | null;
    }>,
  ): Array<{ email: string; name: string }> {
    const seen = new Set<string>();
    const result: Array<{ email: string; name: string }> = [];

    const push = (email: string, displayName: string) => {
      if (email && !seen.has(email)) {
        seen.add(email);
        result.push({ email, name: displayName ?? email });
      }
    };

    for (const assignment of assignments) {
      // Group assignments: iterate all group members
      if (assignment.group?.members) {
        for (const member of assignment.group.members) {
          push(member.user.email, member.user.displayName);
        }
      }

      // Individual member assignments
      if (assignment.member?.user) {
        push(assignment.member.user.email, assignment.member.user.displayName);
      }
    }

    return result;
  }
}
