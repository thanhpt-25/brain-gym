import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { QuestionsService } from '../questions/questions.service';
import { EncryptionService } from './crypto/encryption.service';
import { IngestionService } from './ingestion/ingestion.service';
import { createLlmProvider } from './providers/llm-provider.factory';
import {
  buildGenerationSystemPrompt,
  buildGenerationUserPrompt,
} from './prompts/question-generation.prompt';
import {
  buildCriticSystemPrompt,
  buildCriticUserPrompt,
} from './prompts/quality-critic.prompt';
import { ConfigureLlmDto } from './dto/configure-llm.dto';
import { GenerateQuestionsDto } from './dto/generate-questions.dto';
import { SaveGeneratedQuestionsDto } from './dto/save-questions.dto';
import { McpIntakeDto } from './mcp/mcp-intake.dto';
import {
  GeneratedQuestion,
  RawGeneratedQuestion,
} from './providers/llm-provider.interface';
import {
  Difficulty,
  LlmProvider,
  GenerationJobStatus,
  QualityTier,
  QuestionStatus,
  QuestionType,
} from '@prisma/client';

const QUALITY_HIGH = 0.85;
const QUALITY_MEDIUM = 0.6;

@Injectable()
export class AiQuestionBankService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly questions: QuestionsService,
    private readonly encryption: EncryptionService,
    private readonly ingestion: IngestionService,
  ) {}

  // ─── LLM Config ─────────────────────────────────────────────────────────────

  async saveLlmConfig(userId: string, dto: ConfigureLlmDto) {
    const encrypted = this.encryption.encrypt(dto.apiKey);
    return this.prisma.userLlmConfig.upsert({
      where: { userId_provider: { userId, provider: dto.provider } },
      update: {
        encryptedKey: encrypted,
        modelId: dto.modelId || null,
        isActive: true,
      },
      create: {
        userId,
        provider: dto.provider,
        encryptedKey: encrypted,
        modelId: dto.modelId || null,
      },
      select: {
        id: true,
        provider: true,
        modelId: true,
        isActive: true,
        createdAt: true,
      },
    });
  }

  async getLlmConfigs(userId: string) {
    const configs = await this.prisma.userLlmConfig.findMany({
      where: { userId, isActive: true },
      select: {
        id: true,
        provider: true,
        modelId: true,
        isActive: true,
        encryptedKey: true,
        createdAt: true,
      },
    });
    return configs.map((c: (typeof configs)[number]) => ({
      ...c,
      maskedKey: this.encryption.maskKey(
        this.encryption.decrypt(c.encryptedKey),
      ),
      encryptedKey: undefined,
    }));
  }

  async deleteLlmConfig(userId: string, provider: LlmProvider) {
    const config = await this.prisma.userLlmConfig.findUnique({
      where: { userId_provider: { userId, provider } },
    });
    if (!config) throw new NotFoundException('LLM config not found');
    await this.prisma.userLlmConfig.delete({ where: { id: config.id } });
  }

  async validateLlmConfig(userId: string, provider: LlmProvider) {
    const config = await this.prisma.userLlmConfig.findUnique({
      where: { userId_provider: { userId, provider } },
    });
    if (!config) throw new NotFoundException('LLM config not found');
    const apiKey = this.encryption.decrypt(config.encryptedKey);
    const llm = createLlmProvider(
      provider,
      apiKey,
      config.modelId || undefined,
    );
    const valid = await llm.validateApiKey();
    return { valid };
  }

  // ─── Token Estimation ────────────────────────────────────────────────────────

  async estimateTokens(userId: string, dto: GenerateQuestionsDto) {
    const config = await this.requireLlmConfig(userId, dto.provider);
    const apiKey = this.encryption.decrypt(config.encryptedKey);
    const llm = createLlmProvider(
      dto.provider,
      apiKey,
      config.modelId || undefined,
    );

    const cert = await this.prisma.certification.findFirst({
      where: { id: dto.certificationId },
    });
    const domain = dto.domainId
      ? await this.prisma.domain.findUnique({ where: { id: dto.domainId } })
      : null;
    const sourceChunks = dto.materialId
      ? await this.ingestion.getChunksForMaterial(dto.materialId)
      : [];

    const estimate = llm.estimateTokens({
      certificationName: cert?.name || dto.certificationId,
      certificationCode: cert?.code || dto.certificationId,
      domainName: domain?.name,
      difficulty: dto.difficulty || Difficulty.MEDIUM,
      questionCount: dto.questionCount,
      questionType: dto.questionType,
      sourceChunks,
    });

    return {
      ...estimate,
      totalEstimatedTokens:
        estimate.estimatedPromptTokens + estimate.estimatedCompletionTokens,
    };
  }

  // ─── Generation Pipeline ─────────────────────────────────────────────────────

  async generateQuestions(userId: string, dto: GenerateQuestionsDto) {
    const config = await this.requireLlmConfig(userId, dto.provider);
    const apiKey = this.encryption.decrypt(config.encryptedKey);
    const llm = createLlmProvider(
      dto.provider,
      apiKey,
      config.modelId || undefined,
    );

    const cert = await this.prisma.certification.findFirst({
      where: { id: dto.certificationId },
    });
    if (!cert) throw new NotFoundException('Certification not found');

    const domain = dto.domainId
      ? await this.prisma.domain.findUnique({ where: { id: dto.domainId } })
      : null;
    const sourceChunks = dto.materialId
      ? await this.ingestion.getChunksForMaterial(dto.materialId)
      : [];

    // Create job record
    const job = await this.prisma.questionGenerationJob.create({
      data: {
        userId,
        certificationId: cert.id,
        domainId: dto.domainId || null,
        materialId: dto.materialId || null,
        provider: dto.provider,
        modelId: config.modelId || null,
        difficulty: dto.difficulty || Difficulty.MEDIUM,
        questionCount: dto.questionCount,
        status: GenerationJobStatus.PROCESSING,
      },
    });

    try {
      const params = {
        certificationName: cert.name,
        certificationCode: cert.code,
        domainName: domain?.name,
        difficulty: dto.difficulty || Difficulty.MEDIUM,
        questionCount: dto.questionCount,
        questionType: dto.questionType,
        sourceChunks: sourceChunks.slice(0, 5), // max 5 chunks per generation
      };

      // Pass 1: Generate
      const systemPrompt = buildGenerationSystemPrompt();
      const userPrompt = buildGenerationUserPrompt(params);
      const genResult = await llm.generateRaw(systemPrompt, userPrompt);

      const rawQuestions = this.parseGeneratorResponse(
        genResult.content,
        dto.questionCount,
      );

      // Pass 2: Critic
      let scores: number[] = rawQuestions.map(() => 0.7); // fallback
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
        // Critic pass failure is non-fatal — use confidence_hint fallback
        scores = rawQuestions.map((q) =>
          q.confidence_hint === 'high'
            ? 0.87
            : q.confidence_hint === 'medium'
              ? 0.7
              : 0.5,
        );
      }

      // Map to preview objects
      const previews = rawQuestions.map((q, i) =>
        this.mapToPreview(q, scores[i], dto),
      );

      // Update job with token usage and scores
      await this.prisma.questionGenerationJob.update({
        where: { id: job.id },
        data: {
          status: GenerationJobStatus.COMPLETED,
          promptTokens: genResult.promptTokens,
          completionTokens: genResult.completionTokens,
          qualityScores: scores,
          completedAt: new Date(),
        },
      });

      return {
        jobId: job.id,
        questions: previews,
        tokenUsage: {
          prompt: genResult.promptTokens,
          completion: genResult.completionTokens,
        },
      };
    } catch (err) {
      await this.prisma.questionGenerationJob.update({
        where: { id: job.id },
        data: {
          status: GenerationJobStatus.FAILED,
          errorMessage: (err as Error).message,
        },
      });
      throw new UnprocessableEntityException(
        `Generation failed: ${(err as Error).message}`,
      );
    }
  }

  // ─── Save Questions ──────────────────────────────────────────────────────────

  async saveGeneratedQuestions(userId: string, dto: SaveGeneratedQuestionsDto) {
    const saved: string[] = [];
    const discarded: number[] = [];

    for (const [index, q] of dto.questions.entries()) {
      const tier = this.scoreTotier(q.qualityScore);

      if (tier === null) {
        discarded.push(index);
        continue;
      }

      const status =
        tier === QualityTier.HIGH
          ? QuestionStatus.APPROVED
          : QuestionStatus.PENDING;

      const question = await this.questions.create(
        userId,
        {
          title: q.title,
          description: q.description,
          questionType: q.questionType,
          difficulty: q.difficulty,
          explanation: q.explanation,
          certificationId: dto.certificationId,
          domainId: dto.domainId,
          choices: q.choices.map((c, i) => ({
            label: String.fromCharCode(65 + i),
            content: c.content,
            isCorrect: c.isCorrect,
          })),
          tags: q.tags,
          isScenario: q.isScenario,
          isTrapQuestion: q.isTrapQuestion,
        },
        status,
        dto.jobId,
        tier,
        q.sourceChunkId,
      );

      saved.push(question.id);
    }

    return {
      saved: saved.length,
      discarded: discarded.length,
      questionIds: saved,
    };
  }

  // ─── MCP Intake ──────────────────────────────────────────────────────────────

  async mcpIntake(userId: string, dto: McpIntakeDto) {
    const saved: string[] = [];
    const discarded: number[] = [];

    for (const [index, q] of dto.questions.entries()) {
      const score = q.quality_score ?? 0.7;
      const tier = this.scoreTotier(score);

      if (tier === null) {
        discarded.push(index);
        continue;
      }

      const status =
        tier === QualityTier.HIGH
          ? QuestionStatus.APPROVED
          : QuestionStatus.PENDING;
      const qType = dto.questionType || QuestionType.SINGLE;

      const question = await this.questions.create(
        userId,
        {
          title: q.question,
          explanation: q.explanation,
          questionType: qType,
          difficulty: dto.difficulty || Difficulty.MEDIUM,
          certificationId: dto.certificationId,
          domainId: dto.domainId,
          choices: q.choices,
        },
        status,
        undefined,
        tier,
      );

      saved.push(question.id);
    }

    return {
      saved: saved.length,
      discarded: discarded.length,
      questionIds: saved,
    };
  }

  // ─── History ─────────────────────────────────────────────────────────────────

  async getHistory(userId: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    const [total, jobs] = await Promise.all([
      this.prisma.questionGenerationJob.count({ where: { userId } }),
      this.prisma.questionGenerationJob.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          certification: { select: { name: true, code: true } },
          domain: { select: { name: true } },
          _count: { select: { questions: true } },
        },
      }),
    ]);
    return {
      data: jobs,
      meta: { total, page, limit, lastPage: Math.ceil(total / limit) },
    };
  }

  // ─── Private Helpers ─────────────────────────────────────────────────────────

  private async requireLlmConfig(userId: string, provider: LlmProvider) {
    const config = await this.prisma.userLlmConfig.findUnique({
      where: { userId_provider: { userId, provider } },
    });
    if (!config)
      throw new BadRequestException(
        `No API key configured for ${provider}. Please add one in Settings.`,
      );
    if (!config.isActive)
      throw new BadRequestException(`${provider} API key is disabled.`);
    return config;
  }

  private parseGeneratorResponse(
    content: string,
    expectedCount: number,
  ): RawGeneratedQuestion[] {
    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch {
      // Try extracting JSON from markdown code fences
      const match = content.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
      if (match) {
        try {
          parsed = JSON.parse(match[1]);
        } catch {}
      }
    }
    if (!parsed?.questions || !Array.isArray(parsed.questions)) {
      throw new Error(
        'LLM returned an invalid response format (missing "questions" array)',
      );
    }
    return parsed.questions.slice(0, expectedCount);
  }

  private parseCriticResponse(content: string, count: number): number[] {
    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch {
      const match = content.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
      if (match)
        try {
          parsed = JSON.parse(match[1]);
        } catch {}
    }
    if (!parsed?.results || !Array.isArray(parsed.results)) {
      return Array(count).fill(0.7);
    }
    const scores = Array(count).fill(0.7);
    for (const r of parsed.results) {
      if (typeof r.index === 'number' && typeof r.score === 'number') {
        scores[r.index] = Math.max(0, Math.min(1, r.score));
      }
    }
    return scores;
  }

  private mapToPreview(
    raw: RawGeneratedQuestion,
    score: number,
    dto: GenerateQuestionsDto,
  ): GeneratedQuestion & {
    qualityScore: number;
    qualityTier: QualityTier | null;
  } {
    const tier = this.scoreTotier(score);
    const correctLetters = raw.correct_answer.split(',').map((s) => s.trim());
    const qType =
      dto.questionType ||
      (correctLetters.length > 1 ? QuestionType.MULTIPLE : QuestionType.SINGLE);

    const choices = raw.options.map((opt) => {
      const label = opt.charAt(0).toUpperCase();
      const content = opt.replace(/^[A-Z]\.\s*/, '').trim();
      return { label, content, isCorrect: correctLetters.includes(label) };
    });

    return {
      title: raw.question,
      questionType: qType,
      difficulty: dto.difficulty || Difficulty.MEDIUM,
      explanation: raw.explanation,
      choices,
      sourcePassage: raw.source_passage,
      qualityScore: score,
      qualityTier: tier,
    };
  }

  private scoreTotier(score: number): QualityTier | null {
    if (score >= QUALITY_HIGH) return QualityTier.HIGH;
    if (score >= QUALITY_MEDIUM) return QualityTier.MEDIUM;
    return null; // discard
  }
}
