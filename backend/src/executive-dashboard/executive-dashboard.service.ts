import { Injectable, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { REDIS_CLIENT } from '../redis/redis.module';
import type Redis from 'ioredis';
import { addDays, isBefore } from 'date-fns';

const CACHE_TTL = 300; // 5 min

@Injectable()
export class ExecutiveDashboardService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async getDashboard(orgId: string) {
    const cacheKey = `exec-dashboard:${orgId}`;
    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch {}

    const [compliance, funnel, integrity] = await Promise.all([
      this.getComplianceMetrics(orgId),
      this.getHiringFunnel(orgId),
      this.getIntegrityMetrics(orgId),
    ]);

    const result = { compliance, funnel, integrity, generatedAt: new Date() };

    try {
      await this.redis.set(cacheKey, JSON.stringify(result), 'EX', CACHE_TTL);
    } catch {}

    return result;
  }

  async getComplianceMetrics(orgId: string) {
    const members = await this.prisma.orgMember.findMany({
      where: { orgId, isActive: true },
      select: { id: true },
    });
    const memberIds = members.map((m) => m.id);

    const allCerts = await this.prisma.competencyCertification.findMany({
      where: { orgId, memberId: { in: memberIds } },
      select: {
        memberId: true,
        competencyId: true,
        expiresAt: true,
        revokedAt: true,
      },
    });

    const now = new Date();
    const soon = addDays(now, 30);
    let active = 0;
    let expiringSoon = 0;
    let expired = 0;

    for (const c of allCerts) {
      if (c.revokedAt || isBefore(c.expiresAt, now)) {
        expired++;
      } else if (isBefore(c.expiresAt, soon)) {
        expiringSoon++;
      } else {
        active++;
      }
    }

    const uniqueMembersWithCert = new Set(allCerts.map((c) => c.memberId)).size;
    const certRate =
      members.length > 0
        ? Math.round((uniqueMembersWithCert / members.length) * 100)
        : 0;

    return {
      totalMembers: members.length,
      certifiedMembers: uniqueMembersWithCert,
      certRate,
      certsByStatus: { active, expiringSoon, expired },
    };
  }

  async getHiringFunnel(orgId: string) {
    const campaigns = await this.prisma.assessmentCampaign.findMany({
      where: { orgId },
      select: {
        id: true,
        status: true,
        _count: { select: { assignments: true } },
      },
    });

    // Single query — id used for counts, passingScore used for pass threshold
    const assessmentsWithScore = await this.prisma.assessment.findMany({
      where: { orgId },
      select: { id: true, passingScore: true },
    });
    const assessmentIds = assessmentsWithScore.map((a) => a.id);

    const [invited, started, submitted] = await Promise.all([
      this.prisma.candidateInvite.count({
        where: { assessmentId: { in: assessmentIds } },
      }),
      this.prisma.candidateInvite.count({
        where: {
          assessmentId: { in: assessmentIds },
          status: { in: ['STARTED', 'SUBMITTED', 'EXPIRED'] },
        },
      }),
      this.prisma.candidateInvite.count({
        where: { assessmentId: { in: assessmentIds }, status: 'SUBMITTED' },
      }),
    ]);
    let passedCount = 0;
    for (const a of assessmentsWithScore) {
      const threshold = a.passingScore ?? 70;
      passedCount += await this.prisma.candidateInvite.count({
        where: {
          assessmentId: a.id,
          status: 'SUBMITTED',
          score: { gte: threshold },
        },
      });
    }

    return {
      campaigns: campaigns.length,
      activeCampaigns: campaigns.filter((c) => c.status === 'OPEN').length,
      totalCandidates: invited,
      started,
      submitted,
      passed: passedCount,
      conversionRate: invited > 0 ? Math.round((submitted / invited) * 100) : 0,
      passRate: submitted > 0 ? Math.round((passedCount / submitted) * 100) : 0,
    };
  }

  async getIntegrityMetrics(orgId: string) {
    const assessments = await this.prisma.assessment.findMany({
      where: { orgId },
      select: { id: true },
    });
    const assessmentIds = assessments.map((a) => a.id);

    const flagged = await this.prisma.candidateInvite.count({
      where: { assessmentId: { in: assessmentIds }, isFlagged: true },
    });

    const total = await this.prisma.candidateInvite.count({
      where: {
        assessmentId: { in: assessmentIds },
        status: 'SUBMITTED',
      },
    });

    const avgIntegrity = await this.prisma.candidateInvite.aggregate({
      where: {
        assessmentId: { in: assessmentIds },
        status: 'SUBMITTED',
        integrityScore: { not: null },
      },
      _avg: { integrityScore: true },
    });

    return {
      totalSubmitted: total,
      flaggedCount: flagged,
      flagRate: total > 0 ? Math.round((flagged / total) * 100) : 0,
      avgIntegrityScore: avgIntegrity._avg.integrityScore
        ? Math.round(Number(avgIntegrity._avg.integrityScore))
        : null,
    };
  }

  async exportCsv(orgId: string): Promise<string> {
    const data = await this.getDashboard(orgId);
    const { compliance, funnel, integrity } = data;

    const rows = [
      ['Metric', 'Value'],
      ['Total Members', String(compliance.totalMembers)],
      ['Certified Members', String(compliance.certifiedMembers)],
      ['Certification Rate (%)', String(compliance.certRate)],
      ['Active Certs', String(compliance.certsByStatus.active)],
      ['Expiring Soon Certs', String(compliance.certsByStatus.expiringSoon)],
      ['Expired Certs', String(compliance.certsByStatus.expired)],
      ['Active Campaigns', String(funnel.activeCampaigns)],
      ['Total Candidates', String(funnel.totalCandidates)],
      ['Submitted', String(funnel.submitted)],
      ['Passed', String(funnel.passed)],
      ['Conversion Rate (%)', String(funnel.conversionRate)],
      ['Pass Rate (%)', String(funnel.passRate)],
      ['Flagged Candidates', String(integrity.flaggedCount)],
      ['Flag Rate (%)', String(integrity.flagRate)],
      ['Avg Integrity Score', String(integrity.avgIntegrityScore ?? 'N/A')],
    ];

    return rows.map((r) => r.map((v) => `"${v}"`).join(',')).join('\n');
  }
}
