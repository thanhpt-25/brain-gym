import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { DOCUMENT_INGESTION_QUEUE } from './document-ingestion.constants';

interface IngestionJobPayload {
  jobId: string;
  content: string;
}

@Processor(DOCUMENT_INGESTION_QUEUE)
export class DocumentIngestionProcessor extends WorkerHost {
  private readonly logger = new Logger(DocumentIngestionProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<IngestionJobPayload>): Promise<void> {
    const { jobId, content } = job.data;

    await this.prisma.documentIngestionJob.update({
      where: { id: jobId },
      data: { status: 'EXTRACTING' },
    });

    try {
      // Phase 1 — Extract: split content into question-sized chunks
      const chunks = this.extractChunks(content);

      await this.prisma.documentIngestionJob.update({
        where: { id: jobId },
        data: { status: 'ENRICHING', extractedCount: chunks.length },
      });

      // Phase 2 — Enrich: per-chunk question generation
      // Always-paraphrase policy: source text is never persisted verbatim.
      // In production, replace this stub with an LLM call.
      let enriched = 0;
      let skipped = 0;

      const dbJob = await this.prisma.documentIngestionJob.findUnique({
        where: { id: jobId },
        select: { certificationId: true, userId: true },
      });
      if (!dbJob) throw new Error(`Job ${jobId} not found`);

      for (const chunk of chunks) {
        if (chunk.trim().length < 40) {
          skipped++;
          continue;
        }

        // Stub: in production call OpenAI to paraphrase → generate question
        // The source text is intentionally not stored (always-paraphrase policy).
        const paraphrasedQuestion = this.stubParaphrase(chunk);
        if (!paraphrasedQuestion) {
          skipped++;
          continue;
        }

        // Questions are created as DRAFT pending human review
        await this.prisma.question.create({
          data: {
            certificationId: dbJob.certificationId,
            createdBy: dbJob.userId,
            title: paraphrasedQuestion.title,
            explanation: paraphrasedQuestion.explanation,
            questionType: 'SINGLE',
            difficulty: 'MEDIUM',
            status: 'DRAFT',
            isAiGenerated: true,
            ingestionJobId: jobId,
            answerConfidence: paraphrasedQuestion.confidence,
            choices: {
              create: paraphrasedQuestion.choices,
            },
          },
        });
        enriched++;
      }

      await this.prisma.documentIngestionJob.update({
        where: { id: jobId },
        data: {
          status: 'COMPLETED',
          enrichedCount: enriched,
          skippedCount: skipped,
          completedAt: new Date(),
        },
      });

      this.logger.log(
        `[ingestion] Job ${jobId} completed — ${enriched} questions created, ${skipped} skipped`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.prisma.documentIngestionJob.update({
        where: { id: jobId },
        data: { status: 'FAILED', errorMessage: message },
      });
      this.logger.error(`[ingestion] Job ${jobId} failed: ${message}`);
      throw err;
    }
  }

  private extractChunks(content: string): string[] {
    // Split on double newlines (paragraph boundaries)
    return content
      .split(/\n{2,}/)
      .map((c) => c.trim())
      .filter(Boolean);
  }

  private stubParaphrase(chunk: string): {
    title: string;
    explanation: string;
    confidence: number;
    choices: {
      label: string;
      content: string;
      isCorrect: boolean;
      sortOrder: number;
    }[];
  } | null {
    // Production: replace with LLM call that paraphrases + generates Q&A
    // Never return the original chunk text as the question.
    const words = chunk.split(/\s+/);
    if (words.length < 5) return null;

    return {
      title: `[Review needed] Question generated from document section`,
      explanation: `Generated from document content. Original source not stored per always-paraphrase policy.`,
      confidence: 0.6,
      choices: [
        {
          label: 'A',
          content: 'Option A (review required)',
          isCorrect: true,
          sortOrder: 0,
        },
        {
          label: 'B',
          content: 'Option B (review required)',
          isCorrect: false,
          sortOrder: 1,
        },
        {
          label: 'C',
          content: 'Option C (review required)',
          isCorrect: false,
          sortOrder: 2,
        },
        {
          label: 'D',
          content: 'Option D (review required)',
          isCorrect: false,
          sortOrder: 3,
        },
      ],
    };
  }
}
