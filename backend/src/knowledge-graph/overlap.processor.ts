import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { KnowledgeGraphService } from './knowledge-graph.service';

export const OVERLAP_QUEUE = 'knowledge-graph-overlap';

export interface OverlapJobData {
  certId: string;
}

@Processor(OVERLAP_QUEUE)
export class OverlapProcessor extends WorkerHost {
  private readonly logger = new Logger(OverlapProcessor.name);

  constructor(private readonly kg: KnowledgeGraphService) {
    super();
  }

  async process(job: Job<OverlapJobData>): Promise<void> {
    const { certId } = job.data;
    this.logger.log(`overlap_compute_start certId=${certId} jobId=${job.id}`);
    await this.kg.computeOverlaps(certId);
    this.logger.log(`overlap_compute_done certId=${certId} jobId=${job.id}`);
  }
}
