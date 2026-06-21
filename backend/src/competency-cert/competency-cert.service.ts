import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ScorecardService } from '../scorecard/scorecard.service';
import { addMonths, addDays, isBefore } from 'date-fns';

export type CertStatus = 'ACTIVE' | 'EXPIRING_SOON' | 'EXPIRED';

function certStatus(expiresAt: Date, revokedAt: Date | null): CertStatus {
  if (revokedAt) return 'EXPIRED';
  const now = new Date();
  if (isBefore(expiresAt, now)) return 'EXPIRED';
  if (isBefore(expiresAt, addDays(now, 30))) return 'EXPIRING_SOON';
  return 'ACTIVE';
}

@Injectable()
export class CompetencyCertService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scorecard: ScorecardService,
  ) {}

  async issueByCampaign(orgId: string, campaignId: string) {
    const campaign = await this.prisma.assessmentCampaign.findFirst({
      where: { id: campaignId, orgId },
      include: {
        assignments: { include: { member: true } },
        catalogItem: true,
      },
    });
    if (!campaign) throw new NotFoundException('Campaign not found');
    if (campaign.status !== 'CLOSED')
      throw new BadRequestException(
        'Campaign must be CLOSED before issuing certifications',
      );

    // Need jobRoleId — take from the assessment linked via catalogItem
    const assessment = await this.prisma.assessment.findFirst({
      where: { orgId, jobRoleId: { not: null } },
      orderBy: { createdAt: 'desc' },
    });

    const results = {
      issued: 0,
      upgraded: 0,
      skipped: 0,
      certifications: [] as any[],
    };

    for (const assignment of campaign.assignments) {
      if (!assignment.memberId) continue;

      // Find submitted invite for this member in this assessment
      const assessmentIds = await this.getAssessmentIdsForCatalog(
        campaign.catalogItemId,
      );
      const memberEmail = assignment.member?.userId
        ? ((
            await this.prisma.user.findUnique({
              where: { id: assignment.member.userId },
              select: { email: true },
            })
          )?.email ?? '')
        : '';

      const invite = await this.prisma.candidateInvite.findFirst({
        where: {
          assessmentId: { in: assessmentIds },
          candidateEmail: memberEmail,
          status: 'SUBMITTED',
        },
        select: { id: true, assessmentId: true },
        orderBy: { submittedAt: 'desc' },
      });

      if (!invite || !assessment?.jobRoleId) continue;

      let scorecard: any;
      try {
        scorecard = await this.scorecard.buildForCandidate(
          orgId,
          invite.assessmentId,
          invite.id,
          assessment.jobRoleId,
        );
      } catch {
        continue;
      }

      for (const item of scorecard.items ?? []) {
        if (!item.passed) continue;

        const competency = await this.prisma.competency.findUnique({
          where: { id: item.competencyId },
          select: { validityMonths: true, scaleMin: true, scaleMax: true },
        });
        if (!competency) continue;

        const achievedLevel = Math.round(item.normalizedLevel);
        const expiresAt = addMonths(new Date(), competency.validityMonths);

        // Check existing active cert
        const existing = await this.prisma.competencyCertification.findFirst({
          where: {
            memberId: assignment.memberId,
            competencyId: item.competencyId,
            revokedAt: null,
            expiresAt: { gt: new Date() },
          },
          orderBy: { issuedAt: 'desc' },
        });

        if (existing) {
          if (existing.achievedLevel >= achievedLevel) {
            results.skipped++;
            results.certifications.push({
              memberId: assignment.memberId,
              competencyId: item.competencyId,
              competencyName: item.competencyName,
              achievedLevel,
              expiresAt,
              action: 'SKIPPED',
            });
            continue;
          }
          // Upgrade
          await this.prisma.competencyCertification.create({
            data: {
              orgId,
              memberId: assignment.memberId,
              competencyId: item.competencyId,
              campaignId,
              achievedLevel,
              expiresAt,
            },
          });
          results.upgraded++;
          results.certifications.push({
            memberId: assignment.memberId,
            memberName: assignment.member?.userId ?? '',
            competencyId: item.competencyId,
            competencyName: item.competencyName,
            achievedLevel,
            expiresAt,
            action: 'UPGRADED',
          });
        } else {
          await this.prisma.competencyCertification.create({
            data: {
              orgId,
              memberId: assignment.memberId,
              competencyId: item.competencyId,
              campaignId,
              achievedLevel,
              expiresAt,
            },
          });
          results.issued++;
          results.certifications.push({
            memberId: assignment.memberId,
            memberName: assignment.member?.userId ?? '',
            competencyId: item.competencyId,
            competencyName: item.competencyName,
            achievedLevel,
            expiresAt,
            action: 'ISSUED',
          });
        }
      }
    }

    return { campaignId, ...results };
  }

  async findByMember(
    orgId: string,
    memberId: string,
    requesterId: string,
    requesterRole: string,
    statusFilter?: string,
  ) {
    const member = await this.prisma.orgMember.findFirst({
      where: { id: memberId, orgId },
    });
    if (!member) throw new NotFoundException('Member not found');

    // MEMBER can only see their own certs
    if (requesterRole === 'MEMBER') {
      const requesterMember = await this.prisma.orgMember.findFirst({
        where: { orgId, userId: requesterId },
      });
      if (!requesterMember || requesterMember.id !== memberId)
        throw new ForbiddenException();
    }

    const certs = await this.prisma.competencyCertification.findMany({
      where: { memberId, orgId },
      include: {
        competency: { select: { name: true, scaleMin: true, scaleMax: true } },
        campaign: { select: { name: true } },
      },
      orderBy: { issuedAt: 'desc' },
    });

    const user = await this.prisma.user.findUnique({
      where: { id: member.userId },
      select: { displayName: true },
    });

    const rows = certs
      .map((c) => {
        const status = certStatus(c.expiresAt, c.revokedAt);
        return {
          id: c.id,
          competencyId: c.competencyId,
          competencyName: c.competency.name,
          achievedLevel: c.achievedLevel,
          scaleMax: c.competency.scaleMax,
          issuedAt: c.issuedAt,
          expiresAt: c.expiresAt,
          status,
          campaignName: c.campaign?.name ?? null,
        };
      })
      .filter(
        (c) =>
          !statusFilter || statusFilter === 'ALL' || c.status === statusFilter,
      );

    return {
      memberId,
      memberName: user?.displayName ?? '',
      certifications: rows,
    };
  }

  async findByOrg(
    orgId: string,
    filters: {
      competencyId?: string;
      groupId?: string;
      status?: string;
      page?: number;
      limit?: number;
    },
  ) {
    const { competencyId, groupId, status, page = 1, limit = 20 } = filters;

    const memberWhere: any = { orgId };
    if (groupId) memberWhere.groupId = groupId;

    const memberIds = (
      await this.prisma.orgMember.findMany({
        where: memberWhere,
        select: { id: true },
      })
    ).map((m) => m.id);

    const certs = await this.prisma.competencyCertification.findMany({
      where: {
        orgId,
        memberId: { in: memberIds },
        ...(competencyId ? { competencyId } : {}),
      },
      include: {
        competency: { select: { name: true, scaleMin: true, scaleMax: true } },
        member: { include: { user: { select: { displayName: true } } } },
        campaign: { select: { name: true } },
      },
      orderBy: { issuedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    const rows = certs
      .map((c) => ({
        id: c.id,
        memberId: c.memberId,
        memberName: c.member.user.displayName,
        competencyId: c.competencyId,
        competencyName: c.competency.name,
        achievedLevel: c.achievedLevel,
        scaleMax: c.competency.scaleMax,
        issuedAt: c.issuedAt,
        expiresAt: c.expiresAt,
        status: certStatus(c.expiresAt, c.revokedAt),
        campaignName: c.campaign?.name ?? null,
      }))
      .filter((c) => !status || status === 'ALL' || c.status === status);

    return { total: rows.length, page, limit, rows };
  }

  async getCompliance(
    orgId: string,
    filters: { competencyId?: string; groupId?: string; status?: string },
  ) {
    const { competencyId, groupId, status } = filters;

    const memberWhere: any = { orgId, isActive: true };
    if (groupId) memberWhere.groupId = groupId;
    const members = await this.prisma.orgMember.findMany({
      where: memberWhere,
      include: {
        user: { select: { displayName: true } },
        group: { select: { name: true } },
      },
    });

    const jobRoleCompetencies = await this.prisma.jobRoleCompetency.findMany({
      where: competencyId ? { competencyId } : {},
      include: {
        competency: { select: { name: true } },
        jobRole: { select: { id: true } },
      },
    });

    const now = new Date();
    const rows: any[] = [];

    for (const member of members) {
      for (const jrc of jobRoleCompetencies) {
        const cert = await this.prisma.competencyCertification.findFirst({
          where: {
            memberId: member.id,
            competencyId: jrc.competencyId,
            revokedAt: null,
          },
          orderBy: { issuedAt: 'desc' },
        });

        const cs = cert
          ? certStatus(cert.expiresAt, cert.revokedAt)
          : 'NOT_CERTIFIED';
        if (status && status !== 'ALL' && cs !== status) continue;

        rows.push({
          memberId: member.id,
          memberName: member.user.displayName,
          groupName: member.group?.name ?? null,
          competencyId: jrc.competencyId,
          competencyName: jrc.competency.name,
          certStatus: cs,
          achievedLevel: cert?.achievedLevel ?? null,
          requiredLevel: jrc.requiredLevel,
          expiresAt: cert?.expiresAt ?? null,
        });
      }
    }

    const certified = rows.filter((r) => r.certStatus === 'ACTIVE').length;
    const expiringSoon = rows.filter(
      (r) => r.certStatus === 'EXPIRING_SOON',
    ).length;
    const expired = rows.filter((r) => r.certStatus === 'EXPIRED').length;
    const notCertified = rows.filter(
      (r) => r.certStatus === 'NOT_CERTIFIED',
    ).length;

    return {
      summary: {
        totalMembers: members.length,
        certified,
        expiringSoon,
        expired,
        notCertified,
      },
      rows,
    };
  }

  private async getAssessmentIdsForCatalog(
    catalogItemId: string,
  ): Promise<string[]> {
    const assessments = await this.prisma.assessment.findMany({
      where: { id: catalogItemId },
      select: { id: true },
    });
    return assessments.map((a) => a.id);
  }
}
