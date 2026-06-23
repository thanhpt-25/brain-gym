import {
  BadRequestException,
  GoneException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ScorecardService } from '../scorecard/scorecard.service';
import { CreatePacketTokenDto } from './dto/create-packet-token.dto';

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return email;
  const visible = local[0] ?? '';
  return `${visible}***@${domain}`;
}

@Injectable()
export class InterviewPacketService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly scorecardService: ScorecardService,
    private readonly config: ConfigService,
  ) {}

  async createToken(
    orgId: string,
    inviteId: string,
    dto: CreatePacketTokenDto,
    userId: string,
  ) {
    const invite = await this.prisma.candidateInvite.findFirst({
      where: { id: inviteId },
      include: {
        assessment: { select: { id: true, orgId: true } },
        packetTokens: {
          where: { expiresAt: { gt: new Date() } },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!invite || invite.assessment.orgId !== orgId) {
      throw new NotFoundException('Candidate invite not found');
    }

    const allowedStages = ['SHORTLISTED', 'INTERVIEW', 'HIRED'];
    if (!allowedStages.includes(invite.stage as string)) {
      throw new BadRequestException(
        'Interview packet is only available for shortlisted candidates',
      );
    }

    if (invite.packetTokens.length > 0) {
      const existing = invite.packetTokens[0];
      const appUrl = this.config.get<string>('APP_URL') ?? '';
      return {
        token: existing.token,
        packetUrl: `${appUrl}/packet/${existing.token}`,
        expiresAt: existing.expiresAt,
      };
    }

    const token = randomBytes(24).toString('base64url');
    const expiresInDays = dto.expiresInDays ?? 7;
    const expiresAt = new Date(Date.now() + expiresInDays * 86_400_000);

    const record = await this.prisma.interviewPacketToken.create({
      data: {
        inviteId,
        token,
        createdBy: userId,
        expiresAt,
      },
    });

    await this.auditService.log({
      userId,
      action: 'interview_packet_token_created',
      targetType: 'CandidateInvite',
      targetId: inviteId,
      metadata: { tokenId: record.id, expiresAt: expiresAt.toISOString() },
    });

    const appUrl = this.config.get<string>('APP_URL') ?? '';
    return {
      token: record.token,
      packetUrl: `${appUrl}/packet/${record.token}`,
      expiresAt: record.expiresAt,
    };
  }

  async getPacket(token: string) {
    const record = await this.prisma.interviewPacketToken.findUnique({
      where: { token },
      include: {
        invite: {
          include: {
            assessment: { select: { id: true, orgId: true, title: true } },
          },
        },
      },
    });

    if (!record) throw new NotFoundException('Packet not found');
    if (record.expiresAt < new Date()) {
      throw new GoneException('Packet link has expired');
    }

    const { invite } = record;
    const assessment = invite.assessment;

    let scorecard: any[] = [];
    try {
      const result = await this.scorecardService.buildForCandidate(
        assessment.orgId,
        assessment.id,
        invite.id,
      );
      scorecard = result.competencies ?? [];
    } catch {
      scorecard = [];
    }

    return {
      candidate: {
        name: invite.candidateName,
        email: maskEmail(invite.candidateEmail),
        stage: invite.stage,
        interviewScheduledAt: invite.interviewScheduledAt ?? null,
      },
      exam: {
        title: assessment.title,
        submittedAt: invite.submittedAt ?? null,
        score: invite.score != null ? Number(invite.score) : null,
        totalCorrect: invite.totalCorrect ?? null,
        totalQuestions: invite.totalQuestions ?? null,
        timeSpent: invite.timeSpent ?? null,
      },
      integrity: {
        score:
          invite.integrityScore != null ? Number(invite.integrityScore) : null,
        isFlagged: invite.isFlagged ?? false,
        flaggedReason: invite.flaggedReason ?? null,
      },
      scorecard,
    };
  }
}
