import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter;

  constructor(private readonly config: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.config.get('MAIL_HOST', 'sandbox.smtp.mailtrap.io'),
      port: this.config.get<number>('MAIL_PORT', 2525),
      auth: {
        user: this.config.get('MAIL_USER', ''),
        pass: this.config.get('MAIL_PASS', ''),
      },
    });
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
    const dueLine = dueDate ? `<p>Due: <strong>${dueDate.toUTCString()}</strong></p>` : '';
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
      this.logger.error(`Failed to send exam assigned email to ${email}`, error);
    }
  }
}
