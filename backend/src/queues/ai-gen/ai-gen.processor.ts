import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { Difficulty, GenerationJobStatus, QuestionType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { IngestionService } from '../../ai-question-bank/ingestion/ingestion.service';
import { EncryptionService } from '../../ai-question-bank/crypto/encryption.service';
import { LlmUsageService } from '../../ai-question-bank/llm-usage/llm-usage.service';
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
    private readonly llmUsage: LlmUsageService,
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

      const [cert, domain, sourceChunks, exampleQuestion] = await Promise.all([
        this.prisma.certification.findFirstOrThrow({
          where: { id: certificationId },
          select: { name: true, code: true, examStyle: true },
        }),
        domainId
          ? this.prisma.domain.findUnique({ where: { id: domainId } })
          : Promise.resolve(null),
        materialId
          ? this.ingestion.getChunksForMaterial(materialId)
          : Promise.resolve([]),
        this.prisma.question.findFirst({
          where: {
            certificationId,
            difficulty,
            status: 'APPROVED',
            qualityTier: 'HIGH',
            deletedAt: null,
          },
          select: {
            title: true,
            description: true,
            explanation: true,
            isScenario: true,
            choices: {
              select: { label: true, content: true, isCorrect: true },
              orderBy: { sortOrder: 'asc' },
            },
            tags: { select: { tag: { select: { name: true } } } },
          },
        }),
      ]);

      const fewShotExample = exampleQuestion
        ? buildFewShotExample(exampleQuestion)
        : undefined;

      const params = {
        certificationName: cert.name,
        certificationCode: cert.code,
        domainName: domain?.name,
        difficulty,
        questionCount,
        questionType,
        sourceChunks: sourceChunks.slice(0, 5),
        certStyle: cert.examStyle ?? undefined,
        fewShotExample,
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
          buildCriticSystemPrompt(difficulty),
          buildCriticUserPrompt(rawQuestions),
        );
        scores = this.parseCriticResponse(
          criticResult.content,
          rawQuestions.length,
        );
      } catch {
        // Critic failed — default all questions to MEDIUM tier (0.70) for human review
        scores = Array(rawQuestions.length).fill(0.7);
      }

      const previews = rawQuestions.map(
        (q: Record<string, unknown>, i: number) =>
          this.mapToPreview(q, scores[i], questionType, difficulty),
      );

      const updatedJob = await this.prisma.questionGenerationJob.update({
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

      // RFC-012: Record LLM usage event for cost attribution
      // Non-fatal: errors in recording don't block the job completion
      await this.llmUsage.recordQuestionGeneration(
        job.data.userId,
        updatedJob.orgId,
        job.data.modelId || 'unknown',
        genResult.promptTokens,
        genResult.completionTokens,
      );

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
    const scores: number[] = Array(expectedCount).fill(0.7);
    if (parsed?.results && Array.isArray(parsed.results)) {
      for (const r of parsed.results) {
        if (typeof r.index === 'number' && typeof r.score === 'number') {
          scores[r.index] = Math.max(0, Math.min(1, r.score));
        }
      }
    }
    return scores;
  }

  private mapToPreview(
    q: Record<string, unknown>,
    score: number,
    questionType: QuestionType | undefined,
    difficulty: Difficulty,
  ) {
    const HIGH = 0.85;
    const MEDIUM = 0.6;
    const tier = score >= HIGH ? 'HIGH' : score >= MEDIUM ? 'MEDIUM' : null;

    const correctRaw = String(
      typeof q.correct_answer === 'string'
        ? q.correct_answer
        : typeof q.correctAnswer === 'string'
          ? q.correctAnswer
          : '',
    );
    const correctLetters = correctRaw
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);

    const rawOptions = Array.isArray(q.options)
      ? (q.options as unknown[])
      : Array.isArray(q.choices)
        ? (q.choices as unknown[])
        : [];

    const choices = rawOptions.map((opt, idx) => {
      if (typeof opt === 'string') {
        const label =
          opt.match(/^\s*([A-Z])\b/)?.[1] ?? String.fromCharCode(65 + idx);
        const content = opt.replace(/^\s*[A-Z][.)]\s*/, '').trim();
        return {
          label,
          content,
          isCorrect: correctLetters.includes(label),
        };
      }
      const o = opt as Record<string, unknown>;
      const label =
        (typeof o.label === 'string' && o.label) ||
        String.fromCharCode(65 + idx);
      const content =
        (typeof o.content === 'string' && o.content) ||
        (typeof o.text === 'string' && o.text) ||
        '';
      const isCorrect =
        typeof o.isCorrect === 'boolean'
          ? o.isCorrect
          : correctLetters.includes(String(label).toUpperCase());
      return { label: String(label).toUpperCase(), content, isCorrect };
    });

    const qType: QuestionType =
      questionType ??
      (correctLetters.length > 1 ? QuestionType.MULTIPLE : QuestionType.SINGLE);

    return {
      title: q.question ?? q.title ?? '',
      questionType: qType,
      difficulty,
      explanation: q.explanation ?? '',
      choices,
      tags: Array.isArray(q.tags) ? q.tags : [],
      isScenario: q.is_scenario === true,
      sourcePassage: q.source_passage ?? null,
      qualityScore: score,
      qualityTier: tier,
      sourceChunkId: q.source_chunk_id ?? null,
    };
  }
}

type ExampleQuestion = {
  title: string;
  description: string | null;
  explanation: string | null;
  isScenario: boolean;
  choices: { label: string; content: string; isCorrect: boolean }[];
  tags: { tag: { name: string } }[];
};

function buildFewShotExample(q: ExampleQuestion): string {
  const correctLabels = q.choices
    .filter((c) => c.isCorrect)
    .map((c) => c.label.toUpperCase());
  const correctAnswer = correctLabels.join(',');
  const options = q.choices.map(
    (c) => `${c.label.toUpperCase()}. ${c.content}`,
  );
  const tags = q.tags.map((t) => t.tag.name);

  const example: Record<string, unknown> = {
    question: q.title,
    options,
    correct_answer: correctAnswer,
    explanation: q.explanation ?? '',
    is_scenario: q.isScenario,
    tags,
  };
  if (q.isScenario && q.description) {
    example.scenario = q.description;
  }
  return JSON.stringify(example, null, 2);
}
