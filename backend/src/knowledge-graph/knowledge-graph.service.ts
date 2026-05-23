import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmbeddingService } from '../ai-question-bank/embedding/embedding.service';

export interface GraphNode {
  certId: string;
  certCode: string;
  certName: string;
  domainId: string | null;
  domainName: string | null;
}

export interface GraphEdge {
  nodeA: GraphNode;
  nodeB: GraphNode;
  overlapPct: number;
  sharedTopics: string[];
}

export interface KnowledgeGraphDto {
  nodes: GraphNode[];
  edges: GraphEdge[];
  computedAt: Date | null;
}

export interface NodeDrillDownDto {
  certId: string;
  domainId: string | null;
  skipTopics: string[]; // high-overlap domains the user can safely skim
  mustLearnTopics: string[]; // low-overlap or no-coverage domains
}

export interface StudyPlanDto {
  targetCertId: string;
  sourceCertIds: string[];
  skipTopics: string[];
  mustLearnTopics: string[];
  effortReductionPct: number; // 0–100 estimated % effort saved
  totalTopics: number;
  skippableCount: number;
}

const SKIP_THRESHOLD = 0.65; // overlap_pct ≥ this → skip-able
const MUST_LEARN_THRESHOLD = 0.3; // overlap_pct < this → must-learn

@Injectable()
export class KnowledgeGraphService {
  private readonly logger = new Logger(KnowledgeGraphService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly embedding: EmbeddingService,
  ) {}

  // ─── Overlap Compute ──────────────────────────────────────────────────────

  /**
   * Trigger a full (re)compute of cert-pair overlaps for a given cert.
   * Uses cosine similarity of question-embedding centroids per domain.
   * Falls back to Jaccard on shared tags when pgvector unavailable.
   */
  async computeOverlaps(certId: string): Promise<void> {
    const sourceCert = await this.prisma.certification.findUnique({
      where: { id: certId },
      include: { domains: true },
    });
    if (!sourceCert) return;

    const allCerts = await this.prisma.certification.findMany({
      where: { isActive: true, id: { not: certId } },
      include: { domains: true },
    });

    for (const targetCert of allCerts) {
      for (const domA of sourceCert.domains) {
        for (const domB of targetCert.domains) {
          const overlapPct = await this.computeDomainOverlap(
            certId,
            domA.id,
            targetCert.id,
            domB.id,
          );
          const sharedTopics = await this.findSharedTopics(domA.id, domB.id);

          await this.prisma.certOverlap.upsert({
            where: {
              certAId_certBId_domainAId_domainBId: {
                certAId: certId,
                certBId: targetCert.id,
                domainAId: domA.id,
                domainBId: domB.id,
              },
            },
            update: { overlapPct, sharedTopics, computedAt: new Date() },
            create: {
              certAId: certId,
              certBId: targetCert.id,
              domainAId: domA.id,
              domainBId: domB.id,
              overlapPct,
              sharedTopics,
            },
          });
        }
      }
    }

    this.logger.log(`Overlap compute done for cert ${certId}`);
  }

  private async computeDomainOverlap(
    certAId: string,
    domainAId: string,
    certBId: string,
    domainBId: string,
  ): Promise<number> {
    // Try vector centroid cosine similarity first
    try {
      type Row = { similarity: number };
      const rows = await this.prisma.$queryRawUnsafe<Row[]>(
        `SELECT
           1 - (avg_a.centroid <=> avg_b.centroid) AS similarity
         FROM (
           SELECT avg(qe.embedding) AS centroid
           FROM question_embeddings qe
           JOIN questions q ON q.id = qe.question_id
           WHERE q.certification_id = $1 AND q.domain_id = $2 AND q.deleted_at IS NULL
         ) avg_a,
         (
           SELECT avg(qe.embedding) AS centroid
           FROM question_embeddings qe
           JOIN questions q ON q.id = qe.question_id
           WHERE q.certification_id = $3 AND q.domain_id = $4 AND q.deleted_at IS NULL
         ) avg_b`,
        certAId,
        domainAId,
        certBId,
        domainBId,
      );

      if (rows[0]?.similarity != null) {
        return Math.max(0, Math.min(1, Number(rows[0].similarity)));
      }
    } catch {
      this.logger.warn(
        'pgvector centroid query failed; falling back to Jaccard',
      );
    }

    return this.jacquardTagOverlap(domainAId, domainBId);
  }

  private async jacquardTagOverlap(
    domainAId: string,
    domainBId: string,
  ): Promise<number> {
    const [tagsA, tagsB] = await Promise.all([
      this.prisma.questionTag.findMany({
        where: { question: { domainId: domainAId, deletedAt: null } },
        select: { tagId: true },
        distinct: ['tagId'],
      }),
      this.prisma.questionTag.findMany({
        where: { question: { domainId: domainBId, deletedAt: null } },
        select: { tagId: true },
        distinct: ['tagId'],
      }),
    ]);

    const setA = new Set(tagsA.map((t) => t.tagId));
    const setB = new Set(tagsB.map((t) => t.tagId));
    const intersection = [...setA].filter((id) => setB.has(id)).length;
    const union = new Set([...setA, ...setB]).size;
    return union === 0 ? 0 : intersection / union;
  }

  private async findSharedTopics(
    domainAId: string,
    domainBId: string,
  ): Promise<string[]> {
    const [tagsA, tagsB] = await Promise.all([
      this.prisma.questionTag.findMany({
        where: { question: { domainId: domainAId, deletedAt: null } },
        select: { tag: { select: { name: true } }, tagId: true },
        distinct: ['tagId'],
      }),
      this.prisma.questionTag.findMany({
        where: { question: { domainId: domainBId, deletedAt: null } },
        select: { tagId: true },
        distinct: ['tagId'],
      }),
    ]);

    const setBIds = new Set(tagsB.map((t) => t.tagId));
    return tagsA
      .filter((t) => setBIds.has(t.tagId))
      .map((t) => t.tag.name)
      .slice(0, 10);
  }

  // ─── Graph Query ─────────────────────────────────────────────────────────

  async getGraph(certId: string): Promise<KnowledgeGraphDto> {
    const overlaps = await this.prisma.certOverlap.findMany({
      where: { certAId: certId },
      include: { certA: true, certB: true, domainA: true, domainB: true },
      orderBy: { overlapPct: 'desc' },
    });

    const nodeMap = new Map<string, GraphNode>();
    const edges: GraphEdge[] = [];

    for (const o of overlaps) {
      const keyA = `${o.certAId}:${o.domainAId ?? ''}`;
      const keyB = `${o.certBId}:${o.domainBId ?? ''}`;

      if (!nodeMap.has(keyA)) {
        nodeMap.set(keyA, {
          certId: o.certAId,
          certCode: o.certA.code,
          certName: o.certA.name,
          domainId: o.domainAId,
          domainName: o.domainA?.name ?? null,
        });
      }
      if (!nodeMap.has(keyB)) {
        nodeMap.set(keyB, {
          certId: o.certBId,
          certCode: o.certB.code,
          certName: o.certB.name,
          domainId: o.domainBId,
          domainName: o.domainB?.name ?? null,
        });
      }

      edges.push({
        nodeA: nodeMap.get(keyA)!,
        nodeB: nodeMap.get(keyB)!,
        overlapPct: o.overlapPct,
        sharedTopics: (o.sharedTopics as string[]) ?? [],
      });
    }

    return {
      nodes: [...nodeMap.values()],
      edges,
      computedAt: overlaps.length > 0 ? overlaps[0].computedAt : null,
    };
  }

  // ─── Node Drill-Down ─────────────────────────────────────────────────────

  async getDrillDown(
    certId: string,
    domainId: string | null,
    userPassedCertIds: string[],
  ): Promise<NodeDrillDownDto> {
    const where = domainId
      ? {
          certBId: certId,
          domainBId: domainId,
          certAId: { in: userPassedCertIds },
        }
      : { certBId: certId, certAId: { in: userPassedCertIds } };

    const overlaps = await this.prisma.certOverlap.findMany({
      where,
      include: { domainB: true },
    });

    const skipTopics: string[] = [];
    const mustLearnTopics: string[] = [];

    for (const o of overlaps) {
      const topics = (o.sharedTopics as string[]) ?? [];
      if (o.overlapPct >= SKIP_THRESHOLD) {
        skipTopics.push(...topics);
      } else if (o.overlapPct < MUST_LEARN_THRESHOLD) {
        mustLearnTopics.push(o.domainB?.name ?? 'Unknown topic');
      }
    }

    return {
      certId,
      domainId,
      skipTopics: [...new Set(skipTopics)],
      mustLearnTopics: [...new Set(mustLearnTopics)],
    };
  }

  // ─── Study Plan Generation (US-017c) ────────────────────────────────────

  async generateStudyPlan(
    targetCertId: string,
    userPassedCertIds: string[],
  ): Promise<StudyPlanDto> {
    const targetDomains = await this.prisma.domain.findMany({
      where: { certificationId: targetCertId },
    });

    const overlaps = await this.prisma.certOverlap.findMany({
      where: { certBId: targetCertId, certAId: { in: userPassedCertIds } },
      include: { domainB: true },
    });

    const domainOverlapMap = new Map<string, number>();
    for (const o of overlaps) {
      if (!o.domainBId) continue;
      const existing = domainOverlapMap.get(o.domainBId) ?? 0;
      if (o.overlapPct > existing)
        domainOverlapMap.set(o.domainBId, o.overlapPct);
    }

    const skipTopics: string[] = [];
    const mustLearnTopics: string[] = [];

    for (const domain of targetDomains) {
      const overlap = domainOverlapMap.get(domain.id) ?? 0;
      if (overlap >= SKIP_THRESHOLD) {
        skipTopics.push(domain.name);
      } else {
        mustLearnTopics.push(domain.name);
      }
    }

    const totalTopics = targetDomains.length;
    const skippableCount = skipTopics.length;
    const effortReductionPct =
      totalTopics > 0 ? Math.round((skippableCount / totalTopics) * 100) : 0;

    return {
      targetCertId,
      sourceCertIds: userPassedCertIds,
      skipTopics,
      mustLearnTopics,
      effortReductionPct,
      totalTopics,
      skippableCount,
    };
  }
}
