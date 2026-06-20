import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { UpsertDomainMappingDto } from './dto/upsert-domain-mapping.dto';

@Injectable()
export class ScorecardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orgsService: OrganizationsService,
  ) {}

  // ── Domain mapping admin ──────────────────────────────────────────────────

  async getDomainMappings(slugOrId: string, assessmentId: string) {
    const orgId = await this.orgsService.resolveOrgId(slugOrId);
    await this.assertAssessmentInOrg(orgId, assessmentId);
    return this.prisma.examDomainCompetency.findMany({
      where: { assessmentId },
      include: {
        competency: {
          select: { id: true, name: true, scaleMin: true, scaleMax: true },
        },
      },
    });
  }

  async upsertDomainMappings(
    slugOrId: string,
    assessmentId: string,
    dto: UpsertDomainMappingDto,
  ) {
    const orgId = await this.orgsService.resolveOrgId(slugOrId);
    await this.assertAssessmentInOrg(orgId, assessmentId);

    // Batch-validate all competencies belong to this org in one query
    const competencyIds = dto.mappings.map((m) => m.competencyId);
    const found = await this.prisma.competency.findMany({
      where: { id: { in: competencyIds }, orgId },
      select: { id: true },
    });
    const foundIds = new Set(found.map((c) => c.id));
    const missing = competencyIds.find((id) => !foundIds.has(id));
    if (missing) {
      throw new BadRequestException(`Competency ${missing} not found in org`);
    }

    // Upsert each mapping in a single transaction (unique on assessmentId + domainKey)
    const results = await this.prisma.$transaction(
      dto.mappings.map((item) =>
        this.prisma.examDomainCompetency.upsert({
          where: {
            assessmentId_domainKey: {
              assessmentId,
              domainKey: item.domainKey,
            },
          },
          create: {
            assessmentId,
            domainKey: item.domainKey,
            competencyId: item.competencyId,
            weight: item.weight,
          },
          update: {
            competencyId: item.competencyId,
            weight: item.weight,
          },
        }),
      ),
    );

    return results;
  }

  // ── Scorecard computation ─────────────────────────────────────────────────

  async buildForCandidate(
    slugOrId: string,
    assessmentId: string,
    inviteId: string,
    jobRoleId?: string,
  ) {
    const orgId = await this.orgsService.resolveOrgId(slugOrId);
    await this.assertAssessmentInOrg(orgId, assessmentId);

    const invite = await this.prisma.candidateInvite.findFirst({
      where: { id: inviteId, assessmentId },
      select: {
        id: true,
        candidateName: true,
        candidateEmail: true,
        score: true,
        domainScores: true,
        status: true,
        submittedAt: true,
      },
    });
    if (!invite) throw new NotFoundException('Candidate invite not found');
    if (invite.status !== 'SUBMITTED') {
      throw new BadRequestException(
        'Scorecard is only available for submitted assessments',
      );
    }

    const mappings = await this.prisma.examDomainCompetency.findMany({
      where: { assessmentId },
      include: {
        competency: {
          select: {
            id: true,
            name: true,
            scaleMin: true,
            scaleMax: true,
          },
        },
      },
    });

    const domainScores = invite.domainScores as Record<
      string,
      { correct: number; total: number }
    > | null;

    // Aggregate per-competency weighted average
    const competencyMap = new Map<
      string,
      {
        name: string;
        scaleMin: number;
        scaleMax: number;
        weightedSum: number;
        totalWeight: number;
      }
    >();

    for (const mapping of mappings) {
      const ds = domainScores?.[mapping.domainKey];
      if (!ds || ds.total === 0) continue;

      const domainPct = (ds.correct / ds.total) * 100;
      const key = mapping.competencyId;

      if (!competencyMap.has(key)) {
        competencyMap.set(key, {
          name: mapping.competency.name,
          scaleMin: mapping.competency.scaleMin,
          scaleMax: mapping.competency.scaleMax,
          weightedSum: 0,
          totalWeight: 0,
        });
      }

      const entry = competencyMap.get(key)!;
      entry.weightedSum += domainPct * mapping.weight;
      entry.totalWeight += mapping.weight;
    }

    // Normalize to competency scale and build scorecard rows
    const competencies = Array.from(competencyMap.entries()).map(
      ([competencyId, entry]) => {
        const rawPct =
          entry.totalWeight > 0 ? entry.weightedSum / entry.totalWeight : 0;
        const range = entry.scaleMax - entry.scaleMin;
        const scaledScore = entry.scaleMin + (rawPct / 100) * range;

        return {
          competencyId,
          name: entry.name,
          scaleMin: entry.scaleMin,
          scaleMax: entry.scaleMax,
          score: Math.round(scaledScore * 100) / 100,
          pct: Math.round(rawPct * 100) / 100,
        };
      },
    );

    // Optionally enrich with job-role requirements
    let jobRoleRequirements: Record<string, number> | null = null;
    if (jobRoleId) {
      const requirements = await this.prisma.jobRoleCompetency.findMany({
        where: { jobRoleId },
        select: { competencyId: true, requiredLevel: true },
      });
      jobRoleRequirements = Object.fromEntries(
        requirements.map((r) => [r.competencyId, r.requiredLevel]),
      );
    }

    return {
      candidate: {
        name: invite.candidateName,
        email: invite.candidateEmail,
        submittedAt: invite.submittedAt,
        overallScore: invite.score,
      },
      competencies: competencies.map((c) => ({
        ...c,
        requiredLevel: jobRoleRequirements?.[c.competencyId] ?? null,
        gap:
          jobRoleRequirements?.[c.competencyId] != null
            ? c.score - jobRoleRequirements[c.competencyId]
            : null,
      })),
    };
  }

  async exportCsv(
    slugOrId: string,
    assessmentId: string,
    inviteId: string,
    jobRoleId?: string,
  ): Promise<string> {
    const scorecard = await this.buildForCandidate(
      slugOrId,
      assessmentId,
      inviteId,
      jobRoleId,
    );

    const esc = (v: string | number | null | undefined) => {
      const s = String(v ?? '').replace(/"/g, '""');
      // Prefix formula-injection chars so spreadsheet apps don't execute them
      const safe = /^[=+\-@]/.test(s) ? `\t${s}` : s;
      return `"${safe}"`;
    };

    const header =
      'Candidate Name,Email,Submitted At,Overall Score (%),Competency,Scale Min,Scale Max,Score,Percentile (%),Required Level,Gap';

    const rows = scorecard.competencies.map((c) =>
      [
        esc(scorecard.candidate.name),
        esc(scorecard.candidate.email),
        esc(scorecard.candidate.submittedAt?.toISOString()),
        esc(
          scorecard.candidate.overallScore != null
            ? Number(scorecard.candidate.overallScore)
            : null,
        ),
        esc(c.name),
        esc(c.scaleMin),
        esc(c.scaleMax),
        esc(c.score),
        esc(c.pct),
        esc(c.requiredLevel),
        esc(c.gap),
      ].join(','),
    );

    return [header, ...rows].join('\n');
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private async assertAssessmentInOrg(orgId: string, assessmentId: string) {
    const assessment = await this.prisma.assessment.findFirst({
      where: { id: assessmentId, orgId },
    });
    if (!assessment) throw new NotFoundException('Assessment not found');
  }
}
