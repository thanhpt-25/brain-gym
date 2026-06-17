import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AttemptStatus, CandidateAttemptStatus } from '@prisma/client';
import { inferCompetencyLevel, DEFAULT_THRESHOLDS_1_5 } from '../competency/scoring/infer-competency-level';

@Injectable()
export class OrgAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  private async getOrgMemberUserIds(orgId: string): Promise<string[]> {
    const members = await this.prisma.orgMember.findMany({
      where: { orgId, isActive: true },
      select: { userId: true },
    });
    return members.map((m) => m.userId);
  }

  private async resolveOrgId(orgIdOrSlug: string): Promise<string> {
    const org = await this.prisma.organization.findFirst({
      where: {
        OR: [{ id: orgIdOrSlug }, { slug: orgIdOrSlug }],
      },
      select: { id: true },
    });
    if (!org) throw new NotFoundException('Organization not found');
    return org.id;
  }

  async getOverview(orgIdOrSlug: string) {
    const orgId = await this.resolveOrgId(orgIdOrSlug);
    const userIds = await this.getOrgMemberUserIds(orgId);

    if (userIds.length === 0) {
      return {
        memberCount: 0,
        activeUsersLast7d: 0,
        totalExamsTaken: 0,
        avgScore: 0,
        passRate: 0,
        totalAssessments: 0,
        totalCandidatesInvited: 0,
      };
    }

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const [attempts, activeUsers, assessmentStats] = await Promise.all([
      this.prisma.examAttempt.findMany({
        where: { userId: { in: userIds }, status: AttemptStatus.SUBMITTED },
        select: { score: true },
      }),
      this.prisma.examAttempt.findMany({
        where: {
          userId: { in: userIds },
          status: AttemptStatus.SUBMITTED,
          submittedAt: { gte: sevenDaysAgo },
        },
        select: { userId: true },
        distinct: ['userId'],
      }),
      this.prisma.assessment.findMany({
        where: { orgId },
        select: {
          id: true,
          _count: { select: { candidateInvites: true } },
        },
      }),
    ]);

    const scores = attempts.map((a) => Number(a.score ?? 0));
    const avgScore =
      scores.length > 0
        ? Math.round(scores.reduce((s, v) => s + v, 0) / scores.length)
        : 0;
    const totalPassed = scores.filter((s) => s >= 70).length;

    return {
      memberCount: userIds.length,
      activeUsersLast7d: activeUsers.length,
      totalExamsTaken: attempts.length,
      avgScore,
      passRate:
        scores.length > 0 ? Math.round((totalPassed / scores.length) * 100) : 0,
      totalAssessments: assessmentStats.length,
      totalCandidatesInvited: assessmentStats.reduce(
        (sum, a) => sum + a._count.candidateInvites,
        0,
      ),
    };
  }

  async getReadiness(orgIdOrSlug: string) {
    const orgId = await this.resolveOrgId(orgIdOrSlug);
    const userIds = await this.getOrgMemberUserIds(orgId);

    if (userIds.length === 0) return [];

    const attempts = await this.prisma.examAttempt.findMany({
      where: { userId: { in: userIds }, status: AttemptStatus.SUBMITTED },
      select: {
        userId: true,
        score: true,
        submittedAt: true,
        exam: {
          select: {
            certification: { select: { id: true, name: true, code: true } },
          },
        },
      },
    });

    // Group by certification
    const certMap: Record<
      string,
      {
        certName: string;
        certCode: string;
        members: Record<string, { scores: number[]; latestDate: Date }>;
      }
    > = {};

    for (const a of attempts) {
      const cert = a.exam.certification;
      if (!cert) continue;

      if (!certMap[cert.id]) {
        certMap[cert.id] = {
          certName: cert.name,
          certCode: cert.code,
          members: {},
        };
      }

      if (!certMap[cert.id].members[a.userId]) {
        certMap[cert.id].members[a.userId] = {
          scores: [],
          latestDate: new Date(0),
        };
      }

      const memberData = certMap[cert.id].members[a.userId];
      memberData.scores.push(Number(a.score ?? 0));
      if (a.submittedAt && a.submittedAt > memberData.latestDate) {
        memberData.latestDate = a.submittedAt;
      }
    }

    return Object.entries(certMap).map(([certId, data]) => {
      const memberEntries = Object.values(data.members);
      const allScores = memberEntries.flatMap((m) => m.scores);
      const avgScore =
        allScores.length > 0
          ? Math.round(allScores.reduce((s, v) => s + v, 0) / allScores.length)
          : 0;
      const passedMembers = memberEntries.filter(
        (m) => Math.max(...m.scores) >= 70,
      ).length;

      return {
        certificationId: certId,
        certificationName: data.certName,
        certificationCode: data.certCode,
        membersAttempted: memberEntries.length,
        totalMembers: userIds.length,
        avgScore,
        passedMembers,
        passRate:
          memberEntries.length > 0
            ? Math.round((passedMembers / memberEntries.length) * 100)
            : 0,
      };
    });
  }

  async getSkillGaps(orgIdOrSlug: string) {
    const orgId = await this.resolveOrgId(orgIdOrSlug);
    const userIds = await this.getOrgMemberUserIds(orgId);

    if (userIds.length === 0) return [];

    const attempts = await this.prisma.examAttempt.findMany({
      where: { userId: { in: userIds }, status: AttemptStatus.SUBMITTED },
      select: { domainScores: true },
    });

    const agg: Record<string, { correct: number; total: number }> = {};
    for (const a of attempts) {
      const ds = a.domainScores as Record<
        string,
        { correct: number; total: number }
      > | null;
      if (!ds) continue;
      for (const [domain, { correct, total }] of Object.entries(ds)) {
        if (!agg[domain]) agg[domain] = { correct: 0, total: 0 };
        agg[domain].correct += correct;
        agg[domain].total += total;
      }
    }

    return Object.entries(agg)
      .map(([domain, { correct, total }]) => ({
        domain,
        correct,
        total,
        percentage: total > 0 ? Math.round((correct / total) * 100) : 0,
      }))
      .sort((a, b) => a.percentage - b.percentage);
  }

  async getProgress(orgIdOrSlug: string, weeks = 12) {
    const orgId = await this.resolveOrgId(orgIdOrSlug);
    const userIds = await this.getOrgMemberUserIds(orgId);

    if (userIds.length === 0) return [];

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - weeks * 7);

    const attempts = await this.prisma.examAttempt.findMany({
      where: {
        userId: { in: userIds },
        status: AttemptStatus.SUBMITTED,
        submittedAt: { gte: startDate },
      },
      select: { userId: true, score: true, submittedAt: true },
      orderBy: { submittedAt: 'asc' },
    });

    // Group by ISO week
    const weekMap: Record<
      string,
      { examsTaken: number; scoreSum: number; activeUsers: Set<string> }
    > = {};

    for (const a of attempts) {
      if (!a.submittedAt) continue;
      const d = new Date(a.submittedAt);
      const yearWeek = getISOWeekLabel(d);

      if (!weekMap[yearWeek]) {
        weekMap[yearWeek] = {
          examsTaken: 0,
          scoreSum: 0,
          activeUsers: new Set(),
        };
      }

      weekMap[yearWeek].examsTaken++;
      weekMap[yearWeek].scoreSum += Number(a.score ?? 0);
      weekMap[yearWeek].activeUsers.add(a.userId);
    }

    return Object.entries(weekMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([week, data]) => ({
        week,
        examsTaken: data.examsTaken,
        avgScore:
          data.examsTaken > 0 ? Math.round(data.scoreSum / data.examsTaken) : 0,
        activeUsers: data.activeUsers.size,
      }));
  }

  async getEngagement(orgIdOrSlug: string) {
    const orgId = await this.resolveOrgId(orgIdOrSlug);
    const userIds = await this.getOrgMemberUserIds(orgId);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const [activeUsersLast7d, totalAttempts, assessmentFunnel] =
      await Promise.all([
        userIds.length > 0
          ? this.prisma.examAttempt.findMany({
              where: {
                userId: { in: userIds },
                submittedAt: { gte: sevenDaysAgo },
              },
              select: { userId: true },
              distinct: ['userId'],
            })
          : Promise.resolve([]),
        userIds.length > 0
          ? this.prisma.examAttempt.count({
              where: {
                userId: { in: userIds },
                status: AttemptStatus.SUBMITTED,
              },
            })
          : Promise.resolve(0),
        this.prisma.candidateInvite.findMany({
          where: { assessment: { orgId } },
          select: { status: true },
        }),
      ]);

    const funnelCounts = {
      invited: assessmentFunnel.length,
      started: assessmentFunnel.filter(
        (c) => c.status !== CandidateAttemptStatus.INVITED,
      ).length,
      submitted: assessmentFunnel.filter(
        (c) => c.status === CandidateAttemptStatus.SUBMITTED,
      ).length,
      expired: assessmentFunnel.filter(
        (c) => c.status === CandidateAttemptStatus.EXPIRED,
      ).length,
    };

    return {
      totalMembers: userIds.length,
      activeUsersLast7d: activeUsersLast7d.length,
      activeRate:
        userIds.length > 0
          ? Math.round((activeUsersLast7d.length / userIds.length) * 100)
          : 0,
      totalExamsTaken: totalAttempts,
      avgExamsPerMember:
        userIds.length > 0
          ? parseFloat((totalAttempts / userIds.length).toFixed(1))
          : 0,
      assessmentFunnel: funnelCounts,
    };
  }

  async getMemberAnalytics(orgIdOrSlug: string, userId: string) {
    const orgId = await this.resolveOrgId(orgIdOrSlug);

    // Verify user is a member
    const membership = await this.prisma.orgMember.findFirst({
      where: { orgId, userId, isActive: true },
      include: {
        user: {
          select: { id: true, displayName: true, email: true, avatarUrl: true },
        },
        group: { select: { id: true, name: true } },
      },
    });

    if (!membership) {
      throw new NotFoundException('Member not found in this organization');
    }

    const attempts = await this.prisma.examAttempt.findMany({
      where: { userId, status: AttemptStatus.SUBMITTED },
      select: {
        id: true,
        score: true,
        totalCorrect: true,
        totalQuestions: true,
        timeSpent: true,
        domainScores: true,
        submittedAt: true,
        exam: {
          select: {
            title: true,
            certification: { select: { id: true, name: true, code: true } },
          },
        },
      },
      orderBy: { submittedAt: 'desc' },
    });

    const scores = attempts.map((a) => Number(a.score ?? 0));
    const totalPassed = scores.filter((s) => s >= 70).length;

    // Domain aggregation
    const domainAgg: Record<string, { correct: number; total: number }> = {};
    for (const a of attempts) {
      const ds = a.domainScores as Record<
        string,
        { correct: number; total: number }
      > | null;
      if (!ds) continue;
      for (const [domain, { correct, total }] of Object.entries(ds)) {
        if (!domainAgg[domain]) domainAgg[domain] = { correct: 0, total: 0 };
        domainAgg[domain].correct += correct;
        domainAgg[domain].total += total;
      }
    }

    const domains = Object.entries(domainAgg)
      .map(([domain, { correct, total }]) => ({
        domain,
        correct,
        total,
        percentage: total > 0 ? Math.round((correct / total) * 100) : 0,
      }))
      .sort((a, b) => a.percentage - b.percentage);

    return {
      member: {
        userId: membership.user.id,
        displayName: membership.user.displayName,
        email: membership.user.email,
        avatarUrl: membership.user.avatarUrl,
        role: membership.role,
        group: membership.group,
        joinedAt: membership.joinedAt,
      },
      summary: {
        totalExams: attempts.length,
        totalPassed,
        passRate:
          attempts.length > 0
            ? Math.round((totalPassed / attempts.length) * 100)
            : 0,
        avgScore:
          scores.length > 0
            ? Math.round(scores.reduce((s, v) => s + v, 0) / scores.length)
            : 0,
        bestScore: scores.length > 0 ? Math.round(Math.max(...scores)) : 0,
      },
      domains,
      recentAttempts: attempts.slice(0, 10).map((a) => ({
        id: a.id,
        examTitle: a.exam.title,
        certification: a.exam.certification,
        score: Math.round(Number(a.score ?? 0)),
        totalCorrect: a.totalCorrect ?? 0,
        totalQuestions: a.totalQuestions ?? 0,
        passed: Number(a.score ?? 0) >= 70,
        timeSpent: a.timeSpent ?? 0,
        submittedAt: a.submittedAt,
      })),
    };
  }
  // ── US-A3: Competency Profile ─────────────────────────────────────────────

  async getCompetencyProfile(
    orgIdOrSlug: string,
    memberId?: string,
    jobRoleId?: string,
  ) {
    const orgId = await this.resolveOrgId(orgIdOrSlug);

    // Load competencies for this org
    const competencies = await this.prisma.competency.findMany({
      where: { orgId, isActive: true },
      include: {
        domains: { select: { domainName: true } },
        jobRoles: jobRoleId
          ? { where: { jobRoleId }, select: { requiredLevel: true } }
          : { where: { jobRoleId: '__none__' }, select: { requiredLevel: true } },
      },
    });

    if (competencies.length === 0) return { competencies: [], memberId, jobRoleId };

    // Collect exam attempts to compute domain scores
    const targetUserIds = memberId
      ? [memberId]
      : await this.getOrgMemberUserIds(orgId);

    const attempts = await this.prisma.examAttempt.findMany({
      where: { userId: { in: targetUserIds }, status: 'SUBMITTED' },
      select: { domainScores: true },
    });

    // Aggregate domain scores across attempts
    const domainAgg: Record<string, { correct: number; total: number }> = {};
    for (const attempt of attempts) {
      const breakdown = attempt.domainScores as Record<string, { correct: number; total: number }> | null;
      if (!breakdown) continue;
      for (const [domain, scores] of Object.entries(breakdown)) {
        if (!domainAgg[domain]) domainAgg[domain] = { correct: 0, total: 0 };
        domainAgg[domain].correct += scores.correct ?? 0;
        domainAgg[domain].total += scores.total ?? 0;
      }
    }

    const result = competencies.map((comp) => {
      const domainNames = (comp as any).domains.map((d: { domainName: string }) => d.domainName);
      const mappedDomains = domainNames.filter((d: string) => domainAgg[d]);
      const domainScores: Record<string, { correct: number; total: number }> = {};
      for (const d of mappedDomains) domainScores[d] = domainAgg[d];

      const inferred = inferCompetencyLevel(domainScores, mappedDomains, {
        scaleMin: comp.scaleMin,
        scaleMax: comp.scaleMax,
        thresholds: DEFAULT_THRESHOLDS_1_5,
      });

      const requiredLevel = jobRoleId && (comp as any).jobRoles?.length > 0
        ? (comp as any).jobRoles[0].requiredLevel
        : null;

      return {
        competencyId: comp.id,
        competencyName: comp.name,
        inferredLevel: inferred.level,
        confidence: inferred.confidence,
        sampleSize: inferred.sampleSize,
        requiredLevel,
        gap: requiredLevel != null ? inferred.level - requiredLevel : null,
        scaleMin: comp.scaleMin,
        scaleMax: comp.scaleMax,
      };
    });

    return { competencies: result, memberId: memberId ?? null, jobRoleId: jobRoleId ?? null };
  }

  async getCompetencyHeatmap(orgIdOrSlug: string) {
    const orgId = await this.resolveOrgId(orgIdOrSlug);
    const members = await this.prisma.orgMember.findMany({
      where: { orgId, isActive: true },
      include: { user: { select: { id: true, displayName: true, email: true } } },
    });
    if (members.length === 0) return { members: [], competencies: [], cells: [] };

    const competencies = await this.prisma.competency.findMany({
      where: { orgId, isActive: true },
      include: { domains: { select: { domainName: true } } },
    });
    if (competencies.length === 0) return { members: [], competencies: [], cells: [] };

    const userIds = members.map((m) => m.userId);
    const attempts = await this.prisma.examAttempt.findMany({
      where: { userId: { in: userIds }, status: 'SUBMITTED' },
      select: { userId: true, domainScores: true },
    });

    // Per-user domain aggregation
    const userDomainAgg: Record<string, Record<string, { correct: number; total: number }>> = {};
    for (const attempt of attempts) {
      const uid = attempt.userId;
      const breakdown = attempt.domainScores as Record<string, { correct: number; total: number }> | null;
      if (!breakdown) continue;
      if (!userDomainAgg[uid]) userDomainAgg[uid] = {};
      for (const [domain, scores] of Object.entries(breakdown)) {
        if (!userDomainAgg[uid][domain]) userDomainAgg[uid][domain] = { correct: 0, total: 0 };
        userDomainAgg[uid][domain].correct += scores.correct ?? 0;
        userDomainAgg[uid][domain].total += scores.total ?? 0;
      }
    }

    const cells: { userId: string; competencyId: string; level: number; confidence: string }[] = [];
    for (const member of members) {
      const uid = member.userId;
      const domainAgg = userDomainAgg[uid] ?? {};
      for (const comp of competencies) {
        const domainNames = (comp as any).domains.map((d: { domainName: string }) => d.domainName);
        const mappedDomains = domainNames.filter((d: string) => domainAgg[d]);
        const domainScores: Record<string, { correct: number; total: number }> = {};
        for (const d of mappedDomains) domainScores[d] = domainAgg[d];
        const inferred = inferCompetencyLevel(domainScores, mappedDomains, {
          scaleMin: comp.scaleMin,
          scaleMax: comp.scaleMax,
          thresholds: DEFAULT_THRESHOLDS_1_5,
        });
        cells.push({ userId: uid, competencyId: comp.id, level: inferred.level, confidence: inferred.confidence });
      }
    }

    return {
      members: members.map((m) => ({ userId: m.userId, displayName: m.user.displayName, email: m.user.email })),
      competencies: competencies.map((c) => ({ id: c.id, name: c.name, scaleMin: c.scaleMin, scaleMax: c.scaleMax })),
      cells,
    };
  }

}

function getISOWeekLabel(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  const weekNum =
    1 +
    Math.round(
      ((d.getTime() - week1.getTime()) / 86400000 -
        3 +
        ((week1.getDay() + 6) % 7)) /
        7,
    );
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}
