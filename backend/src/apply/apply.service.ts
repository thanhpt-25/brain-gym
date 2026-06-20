import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  GoneException,
} from '@nestjs/common';
import { randomBytes, randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { CreateApplyLinkDto } from './dto/create-apply-link.dto';
import { PublicApplyDto } from './dto/public-apply.dto';

@Injectable()
export class ApplyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orgsService: OrganizationsService,
  ) {}

  private generateCode(): string {
    return randomBytes(6).toString('base64url');
  }

  // ── Admin: manage apply links under an org/job-role ──────────────────────

  async createLink(
    slugOrId: string,
    jobRoleId: string,
    dto: CreateApplyLinkDto,
    userId: string,
  ) {
    const orgId = await this.orgsService.resolveOrgId(slugOrId);

    const jobRole = await this.prisma.jobRole.findFirst({
      where: { id: jobRoleId, orgId },
    });
    if (!jobRole) throw new NotFoundException('Job role not found');

    const assessment = await this.prisma.assessment.findFirst({
      where: { id: dto.assessmentId, orgId },
    });
    if (!assessment) throw new NotFoundException('Assessment not found in org');

    let code: string;
    let attempts = 0;
    do {
      code = this.generateCode();
      attempts++;
      if (attempts > 10)
        throw new Error('Failed to generate unique apply link code');
    } while (await this.prisma.publicApplyLink.findUnique({ where: { code } }));

    return this.prisma.publicApplyLink.create({
      data: {
        orgId,
        jobRoleId,
        assessmentId: dto.assessmentId,
        code,
        maxUses: dto.maxUses ?? null,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        createdBy: userId,
      },
    });
  }

  async listLinks(slugOrId: string, jobRoleId: string) {
    const orgId = await this.orgsService.resolveOrgId(slugOrId);
    const jobRole = await this.prisma.jobRole.findFirst({
      where: { id: jobRoleId, orgId },
    });
    if (!jobRole) throw new NotFoundException('Job role not found');

    return this.prisma.publicApplyLink.findMany({
      where: { orgId, jobRoleId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async deactivateLink(slugOrId: string, jobRoleId: string, linkId: string) {
    const orgId = await this.orgsService.resolveOrgId(slugOrId);
    const link = await this.prisma.publicApplyLink.findFirst({
      where: { id: linkId, orgId, jobRoleId },
    });
    if (!link) throw new NotFoundException('Apply link not found');

    return this.prisma.publicApplyLink.update({
      where: { id: linkId },
      data: { isActive: false },
    });
  }

  // ── Public: no-auth apply flow ────────────────────────────────────────────

  async getPublicLink(code: string) {
    const link = await this.prisma.publicApplyLink.findUnique({
      where: { code },
      include: {
        jobRole: { select: { id: true, title: true } },
        assessment: {
          select: {
            id: true,
            title: true,
            description: true,
            timeLimit: true,
            questionCount: true,
          },
        },
      },
    });

    if (!link) throw new NotFoundException('Apply link not found');
    this.assertLinkUsable(link);

    return {
      jobRole: link.jobRole,
      assessment: link.assessment,
      expiresAt: link.expiresAt,
      maxUses: link.maxUses,
      currentUses: link.currentUses,
    };
  }

  async submitApplication(code: string, dto: PublicApplyDto, ip: string) {
    if (dto.honeypot) throw new BadRequestException('Bot submission detected');

    if (!dto.consentGiven) {
      throw new BadRequestException('Consent is required to apply');
    }

    const link = await this.prisma.publicApplyLink.findUnique({
      where: { code },
      include: { assessment: true },
    });

    if (!link) throw new NotFoundException('Apply link not found');
    this.assertLinkUsable(link);

    // Dedup: if this email already has a non-expired invite for this assessment, return existing
    const existing = await this.prisma.candidateInvite.findFirst({
      where: {
        assessmentId: link.assessmentId,
        candidateEmail: dto.email.toLowerCase(),
        status: { not: 'EXPIRED' },
      },
    });

    if (existing) {
      return { token: existing.token, alreadyApplied: true };
    }

    const token = randomUUID();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + link.assessment.linkExpiryHours);

    const invite = await this.prisma.$transaction(async (tx) => {
      // Re-read currentUses inside the transaction so concurrent submissions
      // that passed the earlier assertLinkUsable check are caught here.
      const fresh = await tx.publicApplyLink.findUnique({
        where: { id: link.id },
        select: {
          isActive: true,
          expiresAt: true,
          maxUses: true,
          currentUses: true,
        },
      });
      if (!fresh) throw new GoneException('Apply link not found');
      this.assertLinkUsable(fresh);

      await tx.publicApplyLink.update({
        where: { id: link.id },
        data: { currentUses: { increment: 1 } },
      });

      return tx.candidateInvite.create({
        data: {
          assessmentId: link.assessmentId,
          candidateEmail: dto.email.toLowerCase(),
          candidateName: dto.fullName,
          token,
          expiresAt,
          consentedAt: new Date(),
          applyLinkId: link.id,
          ipAddress: ip,
        },
      });
    });

    return { token: invite.token, alreadyApplied: false };
  }

  private assertLinkUsable(link: {
    isActive: boolean;
    expiresAt: Date | null;
    maxUses: number | null;
    currentUses: number;
  }) {
    if (!link.isActive)
      throw new GoneException('This apply link is no longer active');
    if (link.expiresAt && link.expiresAt < new Date()) {
      throw new GoneException('This apply link has expired');
    }
    if (link.maxUses !== null && link.currentUses >= link.maxUses) {
      throw new GoneException('This apply link has reached its maximum uses');
    }
  }
}
