import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, Optional } from '@nestjs/common';
import { Job } from 'bullmq';
import { KnowledgeGraphService } from './knowledge-graph.service';
import { OVERLAP_QUEUE, OverlapJobData } from './overlap.constants';

// Re-exported for existing importers (knowledge-graph.module.ts, specs).
// `OverlapJobData` is a type-only interface (no runtime value), so it needs
// `export type` -- isolatedModules can't otherwise tell it apart from a value
// re-export, which fails at runtime under ESM (no such named export exists).
export { OVERLAP_QUEUE };
export type { OverlapJobData };

@Processor(OVERLAP_QUEUE)
export class OverlapProcessor extends WorkerHost {
  private readonly logger = new Logger(OverlapProcessor.name);

  constructor(@Optional() private readonly kg?: KnowledgeGraphService) {
    super();
  }

  async process(job: Job<OverlapJobData>): Promise<void> {
    const { certId } = job.data;
    this.logger.log(`overlap_compute_start certId=${certId} jobId=${job.id}`);
    if (this.kg) {
      await this.kg.computeOverlaps(certId);
    }
    this.logger.log(`overlap_compute_done certId=${certId} jobId=${job.id}`);
  }
}
