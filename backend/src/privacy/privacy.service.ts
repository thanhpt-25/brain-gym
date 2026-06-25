import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const BATCH_SIZE = 100;
const DAYS_PER_MONTH = 30;

@Injectable()
export class PrivacyService {
  private readonly logger = new Logger(PrivacyService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * US-G2: Anonymise candidate PII for all orgs whose retention TTL has elapsed,
   * or for invites explicitly marked deleteRequestedAt.
   * Safe to call multiple times — idempotent via anonymizedAt IS NULL guard.
   * Scheduled externally at 02:00 UTC daily.
   */
  async runRetentionJob(): Promise<{ anonymized: number }> {
    const orgs = await this.prisma.organization.findMany({
      where: { isActive: true },
      select: { id: true, dataRetentionMonths: true },
    });

    let totalAnonymized = 0;

    for (const org of orgs) {
      const cutoff = new Date(
        Date.now() - org.dataRetentionMonths * DAYS_PER_MONTH * 86_400_000,
      );

      let cursor: string | undefined;
      let batch: any[];

      do {
        batch = await this.prisma.candidateInvite.findMany({
          where: {
            assessment: { orgId: org.id },
            anonymizedAt: null,
            OR: [
              { deleteRequestedAt: { not: null } },
              { createdAt: { lt: cutoff } },
            ],
          },
          select: { id: true },
          take: BATCH_SIZE,
          ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
          orderBy: { id: 'asc' },
        });

        if (batch.length === 0) break;
        cursor = batch[batch.length - 1].id;

        const ids = batch.map((r) => r.id);
        await this.prisma.$transaction([
          this.prisma.candidateInvite.updateMany({
            where: { id: { in: ids } },
            data: {
              candidateName: null,
              ipAddress: null,
              recruiterNote: null,
              anonymizedAt: new Date(),
            },
          }),
        ]);

        // Anonymise email per-row (needs unique anon address)
        for (const { id } of batch) {
          await this.prisma.candidateInvite.update({
            where: { id },
            data: { candidateEmail: `anon_${id}@deleted.invalid` },
          });
        }

        await this.prisma.auditLog.createMany({
          data: ids.map((id) => ({
            userId: 'system',
            action: 'candidate_data_anonymized',
            targetType: 'CandidateInvite',
            targetId: id,
            metadata: {
              trigger: 'retention_ttl_or_delete_request',
              orgId: org.id,
            },
          })),
        });

        totalAnonymized += batch.length;
      } while (batch.length === BATCH_SIZE);

      if (totalAnonymized > 0) {
        this.logger.log(
          `[privacy] Anonymized ${totalAnonymized} invites for org ${org.id}`,
        );
      }
    }

    return { anonymized: totalAnonymized };
  }
}
