import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../mail.service';
import { BehavioralService } from '../../insights/behavioral/behavioral.service';

interface TopicProgress {
  topic: string;
  mastery: number;
  questionsAnswered: number;
}

export interface DigestData {
  questionsAnswered: number;
  correctCount: number;
  streakDays: number;
  badgesEarned: string[];
  topicProgress: TopicProgress[];
  insights: string[];
}

export interface DigestBatchResult {
  sent: number;
  skipped: number;
  failed: number;
}

@Injectable()
export class DigestGenerationService {
  private readonly logger = new Logger(DigestGenerationService.name);
  private readonly MONITORING_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

  constructor(
    private prisma: PrismaService,
    private mail: MailService,
    private insights: BehavioralService,
  ) {}

  async generateDigestHTML(userId: string, data: DigestData): Promise<string> {
    const topicRows = data.topicProgress
      .map(
        (t) => `
      <tr style="border-bottom: 1px solid #f0f0f0;">
        <td style="padding: 12px; font-size: 14px; color: #333;">${t.topic}</td>
        <td style="padding: 12px; text-align: center; font-size: 14px; color: #666;">${t.questionsAnswered}</td>
        <td style="padding: 12px; text-align: center; font-size: 14px; color: #2563eb; font-weight: 600;">${(t.mastery * 100).toFixed(0)}%</td>
      </tr>
    `,
      )
      .join('');

    const badgeElements = data.badgesEarned
      .map(
        (badge) => `
      <span style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 6px 12px; border-radius: 4px; font-size: 12px; margin-right: 8px; margin-bottom: 8px; font-weight: 600;">
        🏆 ${badge.replace(/_/g, ' ')}
      </span>
    `,
      )
      .join('');

    const insightElements = data.insights
      .slice(0, 4)
      .map(
        (insight) => `
      <li style="margin: 8px 0; color: #555; font-size: 14px; line-height: 1.6;">✓ ${insight}</li>
    `,
      )
      .join('');

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #333; }
            a { color: #2563eb; text-decoration: none; }
            a:hover { text-decoration: underline; }
          </style>
        </head>
        <body style="margin: 0; padding: 0; background: #f9fafb;">
          <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center; color: white;">
              <h1 style="margin: 0; font-size: 28px; font-weight: 700;">Weekly Summary</h1>
              <p style="margin: 8px 0 0 0; font-size: 14px; opacity: 0.9;">Your learning progress this week</p>
            </div>

            <!-- Stats Grid -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; padding: 24px; background: #f9fafb;">
              <div style="background: white; padding: 16px; border-radius: 6px; border-left: 4px solid #2563eb;">
                <div style="font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Questions</div>
                <div style="font-size: 32px; font-weight: 700; color: #2563eb;">${data.questionsAnswered}</div>
              </div>
              <div style="background: white; padding: 16px; border-radius: 6px; border-left: 4px solid #10b981;">
                <div style="font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Accuracy</div>
                <div style="font-size: 32px; font-weight: 700; color: #10b981;">${data.questionsAnswered > 0 ? ((data.correctCount / data.questionsAnswered) * 100).toFixed(0) : 0}%</div>
              </div>
              <div style="background: white; padding: 16px; border-radius: 6px; border-left: 4px solid #f59e0b;">
                <div style="font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Current Streak</div>
                <div style="font-size: 32px; font-weight: 700; color: #f59e0b;">${data.streakDays} <span style="font-size: 16px;">days</span></div>
              </div>
              <div style="background: white; padding: 16px; border-radius: 6px; border-left: 4px solid #8b5cf6;">
                <div style="font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Correct</div>
                <div style="font-size: 32px; font-weight: 700; color: #8b5cf6;">${data.correctCount}</div>
              </div>
            </div>

            <!-- Topics Table -->
            <div style="padding: 24px;">
              <h2 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 600; color: #333;">Performance by Topic</h2>
              <table style="width: 100%; border-collapse: collapse;">
                <thead>
                  <tr style="background: #f0f0f0; border-bottom: 2px solid #d0d0d0;">
                    <th style="padding: 12px; text-align: left; font-size: 14px; font-weight: 600; color: #333;">Topic</th>
                    <th style="padding: 12px; text-align: center; font-size: 14px; font-weight: 600; color: #333;">Questions</th>
                    <th style="padding: 12px; text-align: center; font-size: 14px; font-weight: 600; color: #333;">Mastery</th>
                  </tr>
                </thead>
                <tbody>
                  ${topicRows}
                </tbody>
              </table>
            </div>

            <!-- Achievements -->
            ${
              badgeElements
                ? `
              <div style="padding: 24px; border-top: 1px solid #e5e7eb;">
                <h2 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 600; color: #333;">Achievements</h2>
                <div>
                  ${badgeElements}
                </div>
              </div>
            `
                : ''
            }

            <!-- Insights -->
            <div style="padding: 24px; border-top: 1px solid #e5e7eb;">
              <h2 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 600; color: #333;">Key Insights</h2>
              <ul style="margin: 0; padding: 0; list-style: none;">
                ${insightElements}
              </ul>
            </div>

            <!-- CTA -->
            <div style="padding: 24px; text-align: center; border-top: 1px solid #e5e7eb;">
              <a href="https://certgym.com/dashboard" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 32px; border-radius: 4px; font-weight: 600; font-size: 14px; text-decoration: none;">
                Review Your Progress
              </a>
            </div>

            <!-- Footer -->
            <div style="padding: 20px; background: #f9fafb; border-top: 1px solid #e5e7eb; text-align: center; font-size: 12px; color: #999;">
              <p style="margin: 0 0 8px 0;">
                <a href="https://certgym.com/settings/digest?action=disable" style="color: #666; font-size: 12px;">
                  Unsubscribe from weekly digests
                </a>
              </p>
              <p style="margin: 8px 0 0 0;">© 2026 CertGym. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  async prepareDigestData(
    userId: string,
    fromDate: Date = new Date(Date.now() - this.MONITORING_WINDOW_MS),
  ): Promise<DigestData> {
    const insights = await this.insights.getBehavioralInsightsForUser(
      userId,
      fromDate,
    );

    if (!insights || insights.length === 0) {
      return {
        questionsAnswered: 0,
        correctCount: 0,
        streakDays: 0,
        badgesEarned: [],
        topicProgress: [],
        insights: [],
      };
    }

    const questionsAnswered = insights.reduce(
      (sum, i) => sum + (i.metadata?.questionsAnswered || 0),
      0,
    );
    const correctCount = insights.reduce(
      (sum, i) => sum + (i.metadata?.correctCount || 0),
      0,
    );
    const streakDays = await this.calculateStreakDays(insights);

    // Aggregate by topic
    const topicMap = new Map<string, { correct: number; total: number }>();
    insights.forEach((insight) => {
      const topic = insight.metadata?.topic || 'General';
      if (!topicMap.has(topic)) {
        topicMap.set(topic, { correct: 0, total: 0 });
      }
      const entry = topicMap.get(topic)!;
      entry.total += insight.metadata?.questionsAnswered || 0;
      entry.correct += insight.metadata?.correctCount || 0;
    });

    const topicProgress: TopicProgress[] = Array.from(topicMap.entries())
      .map(([topic, { correct, total }]) => ({
        topic,
        mastery: total > 0 ? correct / total : 0,
        questionsAnswered: total,
      }))
      .sort((a, b) => b.mastery - a.mastery);

    // Extract badges
    const badgesEarned = new Set<string>();
    insights.forEach((i) => {
      if (i.metadata?.badgeEarned) {
        badgesEarned.add(i.metadata.badgeEarned);
      }
    });

    // Format insights
    const formattedInsights = await this.formatAggregateInsights({
      questionsAnswered,
      correctCount,
      streakDays,
      badgesEarned: Array.from(badgesEarned),
      topicProgress,
      insights: [],
    });

    return {
      questionsAnswered,
      correctCount,
      streakDays,
      badgesEarned: Array.from(badgesEarned),
      topicProgress,
      insights: formattedInsights,
    };
  }

  async sendDigestToUser(
    userId: string,
    data: DigestData,
  ): Promise<{ sent: boolean; error?: string }> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        this.logger.warn(`User ${userId} not found for digest send`);
        return { sent: false, error: 'User not found' };
      }

      const digestEnabled =
        user.preferences && typeof user.preferences === 'object'
          ? (user.preferences as Record<string, unknown>).digestEnabled !==
            false
          : true;

      if (!digestEnabled) {
        this.logger.debug(`Digest disabled for user ${userId}`);
        return { sent: false };
      }

      const html = await this.generateDigestHTML(userId, data);
      await this.mail.sendEmail({
        to: user.email,
        subject: `Your Weekly CertGym Digest – ${data.questionsAnswered} Questions Answered`,
        html,
      });

      this.logger.log(`Digest sent to ${user.email} (user: ${userId})`);
      return { sent: true };
    } catch (error) {
      this.logger.error(
        `Failed to send digest to ${userId}`,
        error instanceof Error ? error.message : String(error),
      );
      return {
        sent: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async generateWeeklyDigests(): Promise<DigestBatchResult> {
    const result: DigestBatchResult = { sent: 0, skipped: 0, failed: 0 };

    const premiumUsers = await this.prisma.user.findMany({
      where: {
        subscriptionTier: 'PREMIUM',
      },
    });

    this.logger.log(
      `Starting digest generation for ${premiumUsers.length} PREMIUM users`,
    );

    for (const user of premiumUsers) {
      try {
        const data = await this.prepareDigestData(user.id);
        const sendResult = await this.sendDigestToUser(user.id, data);

        if (sendResult.sent) {
          result.sent++;
        } else if (sendResult.error) {
          result.failed++;
        } else {
          result.skipped++;
        }
      } catch (error) {
        this.logger.error(
          `Digest generation failed for ${user.id}`,
          error instanceof Error ? error.message : String(error),
        );
        result.failed++;
      }
    }

    this.logger.log(
      `Digest generation complete: sent=${result.sent}, skipped=${result.skipped}, failed=${result.failed}`,
    );
    return result;
  }

  async toggleUserDigestPreference(
    userId: string,
    enabled: boolean,
  ): Promise<boolean> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        return false;
      }

      const currentPrefs =
        user.preferences && typeof user.preferences === 'object'
          ? (user.preferences as Record<string, unknown>)
          : {};

      await this.prisma.user.update({
        where: { id: userId },
        data: {
          preferences: {
            ...currentPrefs,
            digestEnabled: enabled,
          },
        },
      });

      this.logger.log(
        `Digest preference toggled for ${userId}: ${enabled ? 'enabled' : 'disabled'}`,
      );
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to toggle digest preference for ${userId}`,
        error instanceof Error ? error.message : String(error),
      );
      return false;
    }
  }

  private async calculateStreakDays(
    insights: Array<{ metadata?: Record<string, unknown> }>,
  ): Promise<number> {
    if (insights.length === 0) return 0;

    const dates = insights
      .filter((i) => i.metadata?.activityDate)
      .map((i) => new Date(i.metadata!.activityDate as string).toDateString())
      .sort();

    if (dates.length === 0) return 0;

    const uniqueDates = Array.from(new Set(dates));
    let streak = 1;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = uniqueDates.length - 1; i > 0; i--) {
      const current = new Date(uniqueDates[i]);
      const previous = new Date(uniqueDates[i - 1]);
      const diffDays = Math.floor(
        (current.getTime() - previous.getTime()) / (1000 * 60 * 60 * 24),
      );

      if (diffDays === 1) {
        streak++;
      } else {
        break;
      }
    }

    return streak;
  }

  private async formatAggregateInsights(data: DigestData): Promise<string[]> {
    const insights: string[] = [];

    if (data.topicProgress.length > 0) {
      const topTopic = data.topicProgress[0];
      insights.push(
        `Strong performance in ${topTopic.topic}: ${(topTopic.mastery * 100).toFixed(0)}% accuracy`,
      );
    }

    if (data.streakDays > 3) {
      insights.push(
        `Amazing consistency: ${data.streakDays}-day learning streak!`,
      );
    }

    if (data.questionsAnswered >= 30) {
      insights.push(
        `Productive week: ${data.questionsAnswered} questions mastered`,
      );
    }

    if (data.badgesEarned.length > 0) {
      insights.push(
        `Unlocked ${data.badgesEarned.length} achievement${data.badgesEarned.length > 1 ? 's' : ''}!`,
      );
    }

    if (insights.length === 0) {
      insights.push(
        'Keep up the practice to unlock insights about your progress',
      );
    }

    return insights;
  }
}
