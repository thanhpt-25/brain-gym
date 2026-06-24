import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EmailTemplateTrigger } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { UpsertEmailTemplateDto } from './dto/upsert-email-template.dto';

const STAGE_TO_TRIGGER: Partial<Record<string, EmailTemplateTrigger>> = {
  SHORTLISTED: EmailTemplateTrigger.SHORTLISTED,
  INTERVIEW: EmailTemplateTrigger.INTERVIEW,
  REJECTED: EmailTemplateTrigger.REJECTED,
  HIRED: EmailTemplateTrigger.HIRED,
};

const DEFAULT_TEMPLATES: Record<
  EmailTemplateTrigger,
  { subject: string; bodyHtml: string }
> = {
  INVITE: {
    subject: 'You have been invited to complete an assessment',
    bodyHtml:
      '<p>Hi {candidateName},</p><p>You have been invited to complete <strong>{assessmentTitle}</strong>.</p><p><a href="{actionUrl}">Start Assessment</a></p>',
  },
  SHORTLISTED: {
    subject: 'Congratulations — you have been shortlisted',
    bodyHtml:
      '<p>Hi {candidateName},</p><p>You have been shortlisted for the role at <strong>{orgName}</strong>.</p>',
  },
  INTERVIEW: {
    subject: 'Interview invitation from {orgName}',
    bodyHtml:
      '<p>Hi {candidateName},</p><p>You have been invited for an interview at <strong>{orgName}</strong>.<br>Scheduled: {interviewDateTime}</p>',
  },
  REJECTED: {
    subject: 'Application update from {orgName}',
    bodyHtml:
      '<p>Hi {candidateName},</p><p>Thank you for applying to <strong>{orgName}</strong>. After careful consideration, we have decided not to move forward with your application at this time.</p>',
  },
  HIRED: {
    subject: 'Offer from {orgName} — congratulations!',
    bodyHtml:
      '<p>Hi {candidateName},</p><p>We are thrilled to extend an offer to you from <strong>{orgName}</strong>. We will be in touch with further details.</p>',
  },
};

function interpolate(
  template: string,
  vars: Record<string, string | null | undefined>,
): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? '');
}

const DANGEROUS_TAGS = new Set(['script', 'object', 'embed', 'iframe', 'form']);

function isTagNameEnd(ch: string): boolean {
  return (
    ch === '>' ||
    ch === '/' ||
    ch === ' ' ||
    ch === '\t' ||
    ch === '\n' ||
    ch === '\r'
  );
}

// Strip dangerous tags from admin-authored templates.
// Linear O(n) scanner — no regex quantifiers on user input, no backtracking.
// Strips the tag tokens; content between tags becomes plain visible text.
function sanitize(html: string): string {
  const out: string[] = [];
  let i = 0;
  while (i < html.length) {
    if (html[i] !== '<') {
      out.push(html[i++]);
      continue;
    }
    let j = i + 1;
    if (j < html.length && html[j] === '/') j++;
    let tagName = '';
    while (j < html.length && !isTagNameEnd(html[j])) {
      tagName += html[j++].toLowerCase();
    }
    if (DANGEROUS_TAGS.has(tagName)) {
      // Skip the entire tag (up to and including '>'); handles unclosed tags too
      while (i < html.length && html[i] !== '>') i++;
      if (i < html.length) i++;
    } else {
      out.push(html[i++]);
    }
  }
  return out.join('');
}

@Injectable()
export class EmailTemplatesService {
  private readonly logger = new Logger(EmailTemplatesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  async list(orgId: string) {
    const existing = await this.prisma.emailTemplate.findMany({
      where: { orgId },
    });

    // Return all 5 triggers, merging custom with defaults
    return Object.values(EmailTemplateTrigger).map((trigger) => {
      const custom = existing.find((t) => t.trigger === trigger);
      const def = DEFAULT_TEMPLATES[trigger];
      if (custom) {
        return { ...custom, isCustom: true };
      }
      return {
        id: null,
        orgId,
        trigger,
        subject: def.subject,
        bodyHtml: def.bodyHtml,
        isActive: true,
        isCustom: false,
        updatedAt: null,
      };
    });
  }

  async upsert(
    orgId: string,
    trigger: EmailTemplateTrigger,
    dto: UpsertEmailTemplateDto,
    userId: string,
  ) {
    return this.prisma.emailTemplate.upsert({
      where: { orgId_trigger: { orgId, trigger } },
      create: {
        orgId,
        trigger,
        subject: dto.subject,
        bodyHtml: sanitize(dto.bodyHtml),
        isActive: dto.isActive ?? true,
        createdBy: userId,
      },
      update: {
        subject: dto.subject,
        bodyHtml: sanitize(dto.bodyHtml),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  async remove(orgId: string, trigger: EmailTemplateTrigger) {
    const template = await this.prisma.emailTemplate.findUnique({
      where: { orgId_trigger: { orgId, trigger } },
    });
    if (!template) throw new NotFoundException('Email template not found');
    await this.prisma.emailTemplate.delete({
      where: { id: template.id },
    });
    return { message: 'Template removed — default will be used' };
  }

  async preview(
    subject: string,
    bodyHtml: string,
  ): Promise<{ subject: string; bodyHtml: string }> {
    const sampleVars = {
      candidateName: 'Alex Johnson',
      orgName: 'Acme Corp',
      assessmentTitle: 'AWS Solutions Architect',
      actionUrl: 'https://app.braingym.io/assess/preview',
      interviewDateTime: '2026-08-01 10:00 AM UTC',
      accentColor: '#6366f1',
    };
    return {
      subject: interpolate(subject, sampleVars),
      bodyHtml: interpolate(sanitize(bodyHtml), sampleVars),
    };
  }

  // Called fire-and-forget after stage transitions
  async sendForStage(params: {
    orgId: string;
    inviteId: string;
    toStage: string;
  }) {
    const trigger = STAGE_TO_TRIGGER[params.toStage];
    if (!trigger) return;

    const invite = await this.prisma.candidateInvite.findUnique({
      where: { id: params.inviteId },
      include: {
        assessment: {
          include: {
            organization: { select: { name: true, accentColor: true } },
          },
        },
      },
    });
    if (!invite) return;

    const org = invite.assessment.organization;
    const custom = await this.prisma.emailTemplate.findUnique({
      where: {
        orgId_trigger: { orgId: params.orgId, trigger },
        isActive: true,
      } as any,
    });
    const template = custom ?? DEFAULT_TEMPLATES[trigger];
    if (!template) return;

    const appUrl = process.env.APP_URL ?? '';
    const vars = {
      candidateName: invite.candidateName ?? '',
      orgName: org.name,
      assessmentTitle: invite.assessment.title,
      actionUrl: `${appUrl}/assess/${invite.token}`,
      interviewDateTime: invite.interviewScheduledAt
        ? new Date(invite.interviewScheduledAt).toUTCString()
        : '',
      accentColor: org.accentColor ?? '#6366f1',
    };

    const subject = interpolate(template.subject, vars);
    const bodyHtml = interpolate(sanitize(template.bodyHtml), vars);

    try {
      await this.mailService.sendRaw(invite.candidateEmail, subject, bodyHtml);
    } catch (err) {
      this.logger.error(
        `Failed to send stage email for invite ${params.inviteId}`,
        err,
      );
    }
  }
}
