import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { GenerationJobStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { IngestionService } from '../../ai-question-bank/ingestion/ingestion.service';
import { EncryptionService } from '../../ai-question-bank/crypto/encryption.service';
import { createLlmProvider } from '../../ai-question-bank/providers/llm-provider.factory';
import {
  buildGenerationSystemPrompt,
  buildGenerationUserPrompt,
} from '../../ai-question-bank/prompts/question-generation.prompt';
import {
  buildCriticSystemPrompt,
  buildCriticUserPrompt,
} from '../../ai-question-bank/prompts/quality-critic.prompt';
import { AI_GEN_QUEUE, AiGenJobData } from './ai-gen.job.interface';

@Processor(AI_GEN_QUEUE, { concurrency: 2 })
export class AiGenProcessor extends WorkerHost {
  private readonly logger = new Logger(AiGenProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ingestion: IngestionService,
    private readonly encryption: EncryptionService,
  ) {
    super();
  }

  async process(job: Job<AiGenJobData>): Promise<void> {
    const {
      jobId,
      encryptedApiKey,
      provider,
      modelId,
      certificationId,
      domainId,
      materialId,
      difficulty,
      questionCount,
      questionType,
    } = job.data;

    this.logger.log(`Processing AI gen job ${jobId}`);

    try {
      const apiKey = this.encryption.decrypt(encryptedApiKey);
      const llm = createLlmProvider(provider, apiKey, modelId);

      const [cert, domain, sourceChunks] = await Promise.all([
        this.prisma.certification.findFirstOrThrow({
          where: { id: certificationId },
        }),
        domainId
          ? this.prisma.domain.findUnique({ where: { id: domainId } })
          : Promise.resolve(null),
        materialId
          ? this.ingestion.getChunksForMaterial(materialId)
          : Promise.resolve([]),
      ]);

      const params = {
        certificationName: cert.name,
        certificationCode: cert.code,
        domainName: domain?.name,
        difficulty,
        questionCount,
        questionType,
        sourceChunks: sourceChunks.slice(0, 5),
      };

      // Pass 1: Generate
      const genResult = await llm.generateRaw(
        buildGenerationSystemPrompt(),
        buildGenerationUserPrompt(params),
      );

      const rawQuestions = this.parseGeneratorResponse(
        genResult.content,
        questionCount,
      );

      // Pass 2: Critic (non-fatal)
      let scores: number[];
      try {
        const criticResult = await llm.generateRaw(
          buildCriticSystemPrompt(),
          buildCriticUserPrompt(rawQuestions),
        );
        scores = this.parseCriticResponse(
          criticResult.content,
          rawQuestions.length,
        );
      } catch {
        scores = rawQuestions.map((q: Record<string, unknown>) =>
          q.confidence_hint === 'high'
            ? 0.87
            : q.confidence_hint === 'medium'
              ? 0.7
              : 0.5,
        );
      }

      const previews = rawQuestions.map(
        (q: Record<string, unknown>, i: number) =>
          this.mapToPreview(q, scores[i], questionType),
      );

      await this.prisma.questionGenerationJob.update({
        where: { id: jobId },
        data: {
          status: GenerationJobStatus.COMPLETED,
          promptTokens: genResult.promptTokens,
          completionTokens: genResult.completionTokens,
          qualityScores: scores,
          previewData: previews as unknown as object[],
          completedAt: new Date(),
        },
      });

      this.logger.log(
        `AI gen job ${jobId} completed — ${previews.length} questions`,
      );
    } catch (err) {
      this.logger.error(
        `AI gen job ${jobId} failed: ${(err as Error).message}`,
      );
      await this.prisma.questionGenerationJob.update({
        where: { id: jobId },
        data: {
          status: GenerationJobStatus.FAILED,
          errorMessage: (err as Error).message,
        },
      });
      throw err; // BullMQ will handle retry based on queue config
    }
  }

  private parseGeneratorResponse(content: string, expectedCount: number) {
    // Reuse the same parsing logic from AiQuestionBankService
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
    const raw = jsonMatch ? jsonMatch[1] : content;
    const parsed = JSON.parse(raw);
    const questions = Array.isArray(parsed) ? parsed : (parsed.questions ?? []);
    return questions.slice(0, expectedCount * 2);
  }

  private parseCriticResponse(
    content: string,
    expectedCount: number,
  ): number[] {
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
    const raw = jsonMatch ? jsonMatch[1] : content;
    const parsed = JSON.parse(raw);
    const scores: number[] = Array.isArray(parsed)
      ? parsed.map((s: unknown) => Number(s))
      : (parsed.scores ?? []).map((s: unknown) => Number(s));
    while (scores.length < expectedCount) scores.push(0.7);
    return scores.slice(0, expectedCount);
  }

  private mapToPreview(
    q: Record<string, unknown>,
    score: number,
    questionType?: string,
  ) {
    const HIGH = 0.85;
    const MEDIUM = 0.6;
    return {
      question: q.question,
      choices: q.choices,
      correctAnswer: q.correct_answer ?? q.correctAnswer,
      explanation: q.explanation,
      tags: q.tags ?? [],
      qualityScore: score,
      qualityTier: score >= HIGH ? 'HIGH' : score >= MEDIUM ? 'MEDIUM' : 'LOW',
      questionType: q.question_type ?? questionType ?? 'SINGLE_CHOICE',
      sourceChunkId: q.source_chunk_id ?? null,
      confidence_hint: q.confidence_hint,
    };
  }
}
