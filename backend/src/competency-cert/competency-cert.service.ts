import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ScorecardService } from '../scorecard/scorecard.service';
import { addMonths, addDays, isBefore } from 'date-fns';

export type CertStatus =
  | 'ACTIVE'
  | 'EXPIRING_SOON'
  | 'EXPIRED'
  | 'NOT_CERTIFIED';

function certStatus(
  expiresAt: Date,
  revokedAt: Date | null,
): Exclude<CertStatus, 'NOT_CERTIFIED'> {
  if (revokedAt) return 'EXPIRED';
  const now = new Date();
  if (isBefore(expiresAt, now)) return 'EXPIRED';
  if (isBefore(expiresAt, addDays(now, 30))) return 'EXPIRING_SOON';
  return 'ACTIVE';
}

@Injectable()
export class CompetencyCertService {
  private readonly logger = new Logger(CompetencyCertService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly scorecard: ScorecardService,
  ) {}

  async issueByCampaign(orgId: string, campaignId: string) {
    const campaign = await this.prisma.assessmentCampaign.findFirst({
      where: { id: campaignId, orgId },
      include: {
        assignments: {
          include: {
            member: { include: { user: { select: { email: true } } } },
          },
        },
        catalogItem: true,
      },
    });
    if (!campaign) throw new NotFoundException('Campaign not found');
    if (campaign.status !== 'CLOSED')
      throw new BadRequestException(
        'Campaign must be CLOSED before issuing certifications',
      );

    // Batch: all org assessment IDs (Assessment and ExamCatalogItem have no direct FK)
    const orgAssessmentIds = (
      await this.prisma.assessment.findMany({
        where: { orgId },
        select: { id: true },
      })
    ).map((a) => a.id);

    // Batch: build member → email lookup
    const memberEmailMap = new Map<string, string>();
    for (const assignment of campaign.assignments) {
      if (assignment.memberId && assignment.member?.user?.email) {
        memberEmailMap.set(assignment.memberId, assignment.member.user.email);
      }
    }
    const allEmails = [...new Set(memberEmailMap.values())];

    // Batch: latest submitted invite per candidate email
    const invites = await this.prisma.candidateInvite.findMany({
      where: {
        assessmentId: { in: orgAssessmentIds },
        candidateEmail: { in: allEmails },
        status: 'SUBMITTED',
      },
      select: {
        id: true,
        assessmentId: true,
        candidateEmail: true,
        submittedAt: true,
      },
      orderBy: { submittedAt: 'desc' },
    });

    const emailToInvite = new Map<
      string,
      { id: string; assessmentId: string }
    >();
    for (const invite of invites) {
      if (invite.candidateEmail && !emailToInvite.has(invite.candidateEmail)) {
        emailToInvite.set(invite.candidateEmail, {
          id: invite.id,
          assessmentId: invite.assessmentId,
        });
      }
    }

    // Batch: existing active certs for all campaign members
    const memberIds = campaign.assignments
      .map((a) => a.memberId)
      .filter(Boolean) as string[];

    const existingCerts = await this.prisma.competencyCertification.findMany({
      where: {
        memberId: { in: memberIds },
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: {
        id: true,
        memberId: true,
        competencyId: true,
        achievedLevel: true,
      },
    });

    const existingCertMap = new Map<
      string,
      { id: string; achievedLevel: number }
    >();
    for (const cert of existingCerts) {
      existingCertMap.set(`${cert.memberId}:${cert.competencyId}`, {
        id: cert.id,
        achievedLevel: cert.achievedLevel,
      });
    }

    const results = {
      issued: 0,
      upgraded: 0,
      skipped: 0,
      certifications: [] as any[],
    };

    for (const assignment of campaign.assignments) {
      if (!assignment.memberId) continue;

      const email = memberEmailMap.get(assignment.memberId);
      if (!email) continue;

      const invite = emailToInvite.get(email);
      if (!invite) continue;

      let scorecard: any;
      try {
        scorecard = await this.scorecard.buildForCandidate(
          orgId,
          invite.assessmentId,
          invite.id,
        );
      } catch (err) {
        this.logger.warn(
          `Scorecard build failed for invite ${invite.id}: ${String(err)}`,
        );
        continue;
      }

      // Batch-fetch all competencies referenced in this scorecard
      const passedItems = (scorecard.items ?? []).filter((i: any) => i.passed);
      const competencyIds: string[] = [
        ...new Set(passedItems.map((i: any) => i.competencyId as string)),
      ];
      const competencies = await this.prisma.competency.findMany({
        where: { id: { in: competencyIds } },
        select: { id: true, validityMonths: true },
      });
      const competencyMap = new Map(competencies.map((c) => [c.id, c]));

      for (const item of passedItems) {
        const competency = competencyMap.get(item.competencyId);
        if (!competency) continue;

        const achievedLevel = Math.round(item.normalizedLevel);
        const expiresAt = addMonths(new Date(), competency.validityMonths);
        const cacheKey = `${assignment.memberId}:${item.competencyId}`;
        const existing = existingCertMap.get(cacheKey);

        if (existing) {
          if (existing.achievedLevel >= achievedLevel) {
            results.skipped++;
            results.certifications.push({
              memberId: assignment.memberId,
              competencyId: item.competencyId,
              competencyName: item.competencyName,
              achievedLevel,
              action: 'SKIPPED',
            });
            continue;
          }
          // Revoke superseded cert before issuing upgraded one
          await this.prisma.competencyCertification.update({
            where: { id: existing.id },
            data: { revokedAt: new Date() },
          });
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
    const now = new Date();
    const soon = addDays(now, 30);

    const memberWhere: any = { orgId };
    if (groupId) memberWhere.groupId = groupId;

    const memberIds = (
      await this.prisma.orgMember.findMany({
        where: memberWhere,
        select: { id: true },
      })
    ).map((m) => m.id);

    // Push status filter into the DB query using date predicates
    const statusWhere: any = {};
    if (status && status !== 'ALL') {
      if (status === 'ACTIVE') {
        statusWhere.revokedAt = null;
        statusWhere.expiresAt = { gte: soon };
      } else if (status === 'EXPIRING_SOON') {
        statusWhere.revokedAt = null;
        statusWhere.expiresAt = { gte: now, lt: soon };
      } else if (status === 'EXPIRED') {
        statusWhere.OR = [
          { revokedAt: { not: null } },
          { expiresAt: { lt: now } },
        ];
      }
    }

    const where = {
      orgId,
      memberId: { in: memberIds },
      ...(competencyId ? { competencyId } : {}),
      ...statusWhere,
    };

    const [total, certs] = await Promise.all([
      this.prisma.competencyCertification.count({ where }),
      this.prisma.competencyCertification.findMany({
        where,
        include: {
          competency: {
            select: { name: true, scaleMin: true, scaleMax: true },
          },
          member: { include: { user: { select: { displayName: true } } } },
          campaign: { select: { name: true } },
        },
        orderBy: { issuedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    const rows = certs.map((c) => ({
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
    }));

    return { total, page, limit, rows };
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

    const memberIds = members.map((m) => m.id);

    const jobRoleCompetencies = await this.prisma.jobRoleCompetency.findMany({
      where: {
        jobRole: { orgId },
        ...(competencyId ? { competencyId } : {}),
      },
      include: {
        competency: { select: { name: true } },
        jobRole: { select: { id: true } },
      },
    });

    // Bulk-fetch all certs for all members — eliminates N×M DB queries
    const allCerts = await this.prisma.competencyCertification.findMany({
      where: {
        memberId: { in: memberIds },
        ...(competencyId ? { competencyId } : {}),
      },
      select: {
        memberId: true,
        competencyId: true,
        achievedLevel: true,
        expiresAt: true,
        revokedAt: true,
        issuedAt: true,
      },
      orderBy: { issuedAt: 'desc' },
    });

    // Map: `${memberId}:${competencyId}` → most recent cert
    const certMap = new Map<string, (typeof allCerts)[number]>();
    for (const cert of allCerts) {
      const key = `${cert.memberId}:${cert.competencyId}`;
      if (!certMap.has(key)) certMap.set(key, cert);
    }

    const rows: any[] = [];
    for (const member of members) {
      for (const jrc of jobRoleCompetencies) {
        const key = `${member.id}:${jrc.competencyId}`;
        const cert = certMap.get(key);
        const cs: CertStatus = cert
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
}
