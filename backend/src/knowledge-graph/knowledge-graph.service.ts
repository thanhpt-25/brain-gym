import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { EmbeddingService } from '../ai-question-bank/embedding/embedding.service';
import { OVERLAP_QUEUE, OverlapJobData } from './overlap.processor';

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
  skipTopics: string[];
  mustLearnTopics: string[];
}

export interface StudyPlanDto {
  id?: string;
  targetCertId: string;
  sourceCertIds: string[];
  skipTopics: string[];
  mustLearnTopics: string[];
  effortReductionPct: number;
  totalTopics: number;
  skippableCount: number;
  createdAt?: Date;
}

const SKIP_THRESHOLD = 0.65;
const MUST_LEARN_THRESHOLD = 0.3;

@Injectable()
export class KnowledgeGraphService {
  private readonly logger = new Logger(KnowledgeGraphService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly embedding: EmbeddingService,
    @InjectQueue(OVERLAP_QUEUE)
    private readonly overlapQueue: Queue<OverlapJobData>,
  ) {}

  // ─── Overlap Compute (US-1001: async via BullMQ) ──────────────────────────

  /**
   * Enqueue an async overlap recompute job. Returns BullMQ job id (202 async).
   */
  async enqueueOverlapCompute(certId: string): Promise<{ jobId: string }> {
    const job = await this.overlapQueue.add('compute', { certId });
    this.logger.log(`overlap_enqueued certId=${certId} jobId=${job.id}`);
    return { jobId: job.id ?? '' };
  }

  /**
   * Core overlap compute — called by OverlapProcessor inside a BullMQ worker.
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

    this.logger.log(`overlap_compute_done certId=${certId}`);
  }

  private async computeDomainOverlap(
    certAId: string,
    domainAId: string,
    certBId: string,
    domainBId: string,
  ): Promise<number> {
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

  // ─── Study Plan (US-1002: persist + cosine-weighted estimate) ────────────

  async generateStudyPlan(
    userId: string,
    targetCertId: string,
    userPassedCertIds: string[],
  ): Promise<StudyPlanDto> {
    const targetDomains = await this.prisma.domain.findMany({
      where: { certificationId: targetCertId },
    });

    const overlaps = await this.prisma.certOverlap.findMany({
      where: { certBId: targetCertId, certAId: { in: userPassedCertIds } },
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

    // Cosine-weighted effort reduction: sum of skip overlaps / total domains
    let weightedSum = 0;
    for (const domain of targetDomains) {
      const overlap = domainOverlapMap.get(domain.id) ?? 0;
      if (overlap >= SKIP_THRESHOLD) weightedSum += overlap;
    }
    const effortReductionPct =
      totalTopics > 0
        ? Math.min(100, Math.round((weightedSum / totalTopics) * 100))
        : 0;

    const plan = await this.prisma.studyPlan.create({
      data: {
        userId,
        targetCertId,
        sourceCertIds: userPassedCertIds,
        skipTopics: skipTopics,
        mustLearnTopics: mustLearnTopics,
        effortReductionPct,
        totalTopics,
        skippableCount,
      },
    });

    return {
      id: plan.id,
      targetCertId,
      sourceCertIds: userPassedCertIds,
      skipTopics,
      mustLearnTopics,
      effortReductionPct,
      totalTopics,
      skippableCount,
      createdAt: plan.createdAt,
    };
  }

  async listStudyPlans(userId: string): Promise<StudyPlanDto[]> {
    const plans = await this.prisma.studyPlan.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return plans.map((p) => ({
      id: p.id,
      targetCertId: p.targetCertId,
      sourceCertIds: p.sourceCertIds,
      skipTopics: p.skipTopics as string[],
      mustLearnTopics: p.mustLearnTopics as string[],
      effortReductionPct: p.effortReductionPct,
      totalTopics: p.totalTopics,
      skippableCount: p.skippableCount,
      createdAt: p.createdAt,
    }));
  }

  // ─── Study Plan Scheduling (US-1104) ─────────────────────────────────────

  /**
   * Generate ReviewSchedule entries for must-learn domain questions from a saved plan.
   * Skip-able topics produce no schedules. Idempotent — existing schedules untouched.
   */
  async scheduleFromPlan(
    userId: string,
    studyPlanId: string,
  ): Promise<{ scheduled: number; alreadyExisted: number }> {
    const plan = await this.prisma.studyPlan.findUnique({
      where: { id: studyPlanId },
    });
    if (!plan) throw new Error(`StudyPlan ${studyPlanId} not found`);
    if (plan.userId !== userId)
      throw new Error('StudyPlan does not belong to user');

    const mustLearnTopics = plan.mustLearnTopics as string[];
    if (!mustLearnTopics.length) return { scheduled: 0, alreadyExisted: 0 };

    const domains = await this.prisma.domain.findMany({
      where: {
        certificationId: plan.targetCertId,
        name: { in: mustLearnTopics },
      },
      select: { id: true },
    });
    if (!domains.length) return { scheduled: 0, alreadyExisted: 0 };

    const domainIds = domains.map((d) => d.id);
    const questions = await this.prisma.question.findMany({
      where: {
        domainId: { in: domainIds },
        certificationId: plan.targetCertId,
        deletedAt: null,
      },
      select: { id: true },
    });

    let scheduled = 0;
    let alreadyExisted = 0;
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    for (const q of questions) {
      const existing = await this.prisma.reviewSchedule.findUnique({
        where: { userId_questionId: { userId, questionId: q.id } },
      });
      if (existing) {
        alreadyExisted++;
        continue;
      }
      await this.prisma.reviewSchedule.create({
        data: {
          userId,
          questionId: q.id,
          nextReviewDate: tomorrow,
          intervalDays: 1,
          repetitions: 0,
        },
      });
      scheduled++;
    }

    this.logger.log(
      `study_plan_scheduled userId=${userId} planId=${studyPlanId} scheduled=${scheduled} existed=${alreadyExisted}`,
    );
    return { scheduled, alreadyExisted };
  }
}
