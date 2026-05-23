import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { LlmUsageService } from '../llm-usage/llm-usage.service';
import { EMBEDDING_QUEUE, EmbeddingJobData } from './embedding.job.interface';

const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIM = 1536;
const DEDUP_COSINE_THRESHOLD = 0.92;
const BACKFILL_BATCH_SIZE = 50;

export interface DuplicateCandidate {
  questionId: string;
  cosineSimilarity: number;
  title: string;
}

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly llmUsage: LlmUsageService,
    @InjectQueue(EMBEDDING_QUEUE)
    private readonly embeddingQueue: Queue<EmbeddingJobData>,
  ) {}

  /**
   * Enqueue a single question for embedding.
   */
  async enqueueQuestion(questionId: string, text: string): Promise<void> {
    await this.embeddingQueue.add(
      'embed-question',
      { questionId, text, modelId: EMBEDDING_MODEL },
      { jobId: `embed-${questionId}`, removeOnComplete: true },
    );
  }

  /**
   * Enqueue full backfill of active questions without embeddings.
   */
  async enqueueBackfill(): Promise<{ enqueued: number }> {
    const questions = await this.prisma.question.findMany({
      where: {
        deletedAt: null,
        status: 'APPROVED',
        embedding: null,
      },
      select: {
        id: true,
        title: true,
        description: true,
        choices: { select: { content: true, isCorrect: true } },
      },
      take: 1000, // safety cap per backfill trigger
    });

    let enqueued = 0;
    for (const q of questions) {
      const choicesText = q.choices
        .map((c) => `${c.isCorrect ? '[correct]' : '[wrong]'} ${c.content}`)
        .join(' | ');
      const text = [q.title, q.description, choicesText]
        .filter(Boolean)
        .join('\n');
      await this.enqueueQuestion(q.id, text);
      enqueued++;
    }

    this.logger.log(`Backfill enqueued ${enqueued} questions`);
    return { enqueued };
  }

  /**
   * Persist embedding vector for a question via raw SQL (pgvector column).
   */
  async saveEmbedding(
    questionId: string,
    embedding: number[],
    modelId: string,
    userId?: string,
  ): Promise<void> {
    const vectorStr = `[${embedding.join(',')}]`;
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO question_embeddings (question_id, model_id, embedding, updated_at)
       VALUES ($1, $2, $3::vector, NOW())
       ON CONFLICT (question_id)
       DO UPDATE SET embedding = EXCLUDED.embedding,
                     model_id  = EXCLUDED.model_id,
                     updated_at = NOW()`,
      questionId,
      modelId,
      vectorStr,
    );

    // Record LLM cost (~$0.0001 per 1k tokens; embeddings ~500 input tokens avg)
    await this.llmUsage.recordUsageEvent({
      userId: userId ?? 'system',
      orgId: null,
      feature: 'embedding',
      modelId,
      inputTokens: 500,
      outputTokens: 0,
    });
  }

  /**
   * Semantic dedup: find top-k near-duplicate questions for a candidate text.
   * Returns questions with cosine similarity ≥ DEDUP_COSINE_THRESHOLD.
   */
  async findDuplicates(
    embedding: number[],
    certificationId: string,
    excludeQuestionId?: string,
  ): Promise<DuplicateCandidate[]> {
    const vectorStr = `[${embedding.join(',')}]`;

    type RawRow = { question_id: string; similarity: number; title: string };
    let rows: RawRow[];

    try {
      rows = await this.prisma.$queryRawUnsafe<RawRow[]>(
        `SELECT
           qe.question_id,
           1 - (qe.embedding <=> $1::vector) AS similarity,
           q.title
         FROM question_embeddings qe
         JOIN questions q ON q.id = qe.question_id
         WHERE q.certification_id = $2
           AND q.deleted_at IS NULL
           AND ($3::text IS NULL OR qe.question_id != $3)
           AND 1 - (qe.embedding <=> $1::vector) >= $4
         ORDER BY similarity DESC
         LIMIT 5`,
        vectorStr,
        certificationId,
        excludeQuestionId ?? null,
        DEDUP_COSINE_THRESHOLD,
      );
    } catch (err) {
      this.logger.warn(`Dedup query failed (pgvector unavailable?): ${err}`);
      return [];
    }

    return rows.map((r) => ({
      questionId: r.question_id,
      cosineSimilarity: Number(r.similarity),
      title: r.title,
    }));
  }

  /**
   * Generate embedding vector via OpenAI-compatible API.
   * Falls back gracefully if API key is not configured.
   */
  async generateEmbedding(text: string): Promise<number[] | null> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      this.logger.warn('OPENAI_API_KEY not set; skipping embedding generation');
      return null;
    }

    try {
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ model: EMBEDDING_MODEL, input: text }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI embeddings API error: ${response.status}`);
      }

      const data = (await response.json()) as {
        data: Array<{ embedding: number[] }>;
      };
      return data.data[0].embedding;
    } catch (err) {
      this.logger.error(`Embedding generation failed: ${err}`);
      return null;
    }
  }

  getEmbeddingDim(): number {
    return EMBEDDING_DIM;
  }

  getDedupThreshold(): number {
    return DEDUP_COSINE_THRESHOLD;
  }

  getBackfillBatchSize(): number {
    return BACKFILL_BATCH_SIZE;
  }
}
