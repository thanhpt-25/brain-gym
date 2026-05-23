import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { EmbeddingService } from './embedding.service';
import { EMBEDDING_QUEUE, EmbeddingJobData } from './embedding.job.interface';

@Processor(EMBEDDING_QUEUE)
export class EmbeddingProcessor extends WorkerHost {
  private readonly logger = new Logger(EmbeddingProcessor.name);

  constructor(private readonly embeddingService: EmbeddingService) {
    super();
  }

  async process(job: Job<EmbeddingJobData>): Promise<void> {
    const { questionId, text, modelId } = job.data;
    this.logger.debug(`Embedding question ${questionId}`);

    const vector = await this.embeddingService.generateEmbedding(text);
    if (!vector) {
      this.logger.warn(
        `No embedding returned for question ${questionId}; skipping`,
      );
      return;
    }

    await this.embeddingService.saveEmbedding(questionId, vector, modelId);
    this.logger.debug(`Saved embedding for question ${questionId}`);
  }
}
