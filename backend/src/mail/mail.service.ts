import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter;

  constructor(private readonly config: ConfigService) {
    if (process.env.NODE_ENV === 'test') {
      this.transporter = { sendMail: async () => {} } as any;
    } else {
      this.transporter = nodemailer.createTransport({
        host: this.config.get('MAIL_HOST', 'sandbox.smtp.mailtrap.io'),
        port: this.config.get<number>('MAIL_PORT', 2525),
        auth: {
          user: this.config.get('MAIL_USER', ''),
          pass: this.config.get('MAIL_PASS', ''),
        },
      });
    }
  }

  private get from(): string {
    return this.config.get('MAIL_FROM', 'Brain Gym <noreply@braingym.app>');
  }

  async sendOrgInvite(
    email: string,
    orgName: string,
    inviteToken: string,
    invitedByName: string,
  ): Promise<void> {
    const appUrl = this.config.get('APP_URL', 'http://localhost');
    const link = `${appUrl}/org/accept-invite/${inviteToken}`;
    try {
      await this.transporter.sendMail({
        from: this.from,
        to: email,
        subject: `You've been invited to join ${orgName} on Brain Gym`,
        html: `
          <h2>You've been invited!</h2>
          <p><strong>${invitedByName}</strong> has invited you to join <strong>${orgName}</strong> on Brain Gym.</p>
          <p><a href="${link}" style="background:#6366f1;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;">Accept Invitation</a></p>
          <p>This link expires in 7 days. If you did not expect this invitation, you can ignore this email.</p>
        `,
      });
    } catch (error) {
      this.logger.error(`Failed to send org invite to ${email}`, error);
    }
  }

  async sendAssessmentInvite(
    email: string,
    candidateName: string,
    assessmentTitle: string,
    token: string,
    expiresAt: Date,
  ): Promise<void> {
    const appUrl = this.config.get('APP_URL', 'http://localhost');
    const link = `${appUrl}/assess/${token}`;
    const expiry = expiresAt.toUTCString();
    try {
      await this.transporter.sendMail({
        from: this.from,
        to: email,
        subject: `Assessment Invitation: ${assessmentTitle}`,
        html: `
          <h2>Hello${candidateName ? ' ' + candidateName : ''},</h2>
          <p>You have been invited to complete the assessment: <strong>${assessmentTitle}</strong>.</p>
          <p><a href="${link}" style="background:#6366f1;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;">Start Assessment</a></p>
          <p><strong>This link expires on ${expiry}.</strong> Please complete the assessment before then.</p>
          <p>If you believe this was sent in error, you may ignore this email.</p>
        `,
      });
    } catch (error) {
      this.logger.error(`Failed to send assessment invite to ${email}`, error);
    }
  }

  async sendExamAssigned(
    email: string,
    displayName: string,
    examTitle: string,
    orgName: string,
    dueDate?: Date,
  ): Promise<void> {
    const appUrl = this.config.get('APP_URL', 'http://localhost');
    const dueLine = dueDate
      ? `<p>Due: <strong>${dueDate.toUTCString()}</strong></p>`
      : '';
    try {
      await this.transporter.sendMail({
        from: this.from,
        to: email,
        subject: `New exam assigned: ${examTitle}`,
        html: `
          <h2>Hi ${displayName},</h2>
          <p><strong>${orgName}</strong> has assigned you the exam: <strong>${examTitle}</strong>.</p>
          ${dueLine}
          <p><a href="${appUrl}/dashboard" style="background:#6366f1;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;">Go to Dashboard</a></p>
        `,
      });
    } catch (error) {
      this.logger.error(
        `Failed to send exam assigned email to ${email}`,
        error,
      );
    }
  }

  async sendEmail(options: {
    to: string;
    subject: string;
    html: string;
  }): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: this.from,
        to: options.to,
        subject: options.subject,
        html: options.html,
      });
    } catch (error) {
      this.logger.error(`Failed to send email to ${options.to}`, error);
    }
  }

  async sendOtp(email: string, code: string, inviteId: string): Promise<void> {
    const maskedEmail = email.replace(/(.{2}).+(@.+)/, '$1***$2');
    try {
      await this.transporter.sendMail({
        from: this.from,
        to: email,
        subject: 'Your assessment verification code',
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:auto">
            <h2>Verification code</h2>
            <p>Use the code below to start your assessment:</p>
            <p style="font-size:32px;font-weight:bold;letter-spacing:6px;text-align:center;
                      background:#f4f4f5;padding:16px;border-radius:8px;margin:24px 0">
              ${code}
            </p>
            <p>This code expires in <strong>10 minutes</strong>.<br>
               Do not share this code with anyone.</p>
          </div>
        `,
      });
    } catch (error) {
      // Structured log — no code or hash exposed
      this.logger.error('OTP_MAIL_FAILED', {
        event: 'OTP_MAIL_FAILED',
        maskedEmail,
        inviteId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async sendCampaignReminder(opts: {
    to: string;
    name: string;
    campaignName: string;
    dueDate: Date;
  }): Promise<void> {
    const dueDateStr = opts.dueDate.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    await this.transporter.sendMail({
      from: this.from,
      to: opts.to,
      subject: `Reminder: "${opts.campaignName}" assessment due ${dueDateStr}`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:auto">
          <h2>Assessment Reminder</h2>
          <p>Hi ${opts.name},</p>
          <p>This is a reminder that the <strong>${opts.campaignName}</strong> assessment
             is due on <strong>${dueDateStr}</strong>.</p>
          <p>Please complete it before the deadline.</p>
        </div>
      `,
    });
  }

  // US-C3: Generic send for custom email templates
  async sendRaw(to: string, subject: string, html: string): Promise<void> {
    try {
      await this.transporter.sendMail({ from: this.from, to, subject, html });
    } catch (error) {
      this.logger.error(`Failed to send raw email to ${to}`, error);
    }
  }
}
