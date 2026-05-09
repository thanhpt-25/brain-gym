import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { QuestionsService } from '../questions/questions.service';
import { EncryptionService } from './crypto/encryption.service';
import { IngestionService } from './ingestion/ingestion.service';
import {
  AI_GEN_QUEUE,
  AiGenJobData,
} from '../queues/ai-gen/ai-gen.job.interface';
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
    @InjectQueue(AI_GEN_QUEUE) private readonly aiGenQueue: Queue<AiGenJobData>,
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

  async generateQuestions(
    userId: string,
    dto: GenerateQuestionsDto,
    orgId?: string,
  ) {
    const config = await this.requireLlmConfig(userId, dto.provider);

    const cert = await this.prisma.certification.findFirst({
      where: { id: dto.certificationId },
    });
    if (!cert) throw new NotFoundException('Certification not found');

    const job = await this.prisma.questionGenerationJob.create({
      data: {
        userId,
        orgId: orgId || null,
        certificationId: cert.id,
        domainId: dto.domainId || null,
        materialId: dto.materialId || null,
        provider: dto.provider,
        modelId: config.modelId || null,
        difficulty: dto.difficulty || Difficulty.MEDIUM,
        questionCount: dto.questionCount,
        status: GenerationJobStatus.PENDING,
      },
    });

    await this.aiGenQueue.add(
      'generate',
      {
        jobId: job.id,
        userId,
        certificationId: cert.id,
        domainId: dto.domainId,
        materialId: dto.materialId,
        provider: dto.provider,
        encryptedApiKey: config.encryptedKey,
        modelId: config.modelId || undefined,
        difficulty: dto.difficulty || Difficulty.MEDIUM,
        questionCount: dto.questionCount,
        questionType: dto.questionType,
      },
      { jobId: job.id },
    );

    return { jobId: job.id, status: GenerationJobStatus.PENDING };
  }

  async getJobStatus(userId: string, jobId: string) {
    const job = await this.prisma.questionGenerationJob.findUnique({
      where: { id: jobId },
    });

    if (!job) throw new NotFoundException('Job not found');
    if (job.userId !== userId) throw new ForbiddenException('Access denied');

    return {
      jobId: job.id,
      status: job.status,
      questions:
        job.status === GenerationJobStatus.COMPLETED
          ? (job.previewData as unknown[])
          : undefined,
      tokenUsage:
        job.promptTokens != null
          ? { prompt: job.promptTokens, completion: job.completionTokens }
          : undefined,
      errorMessage: job.errorMessage ?? undefined,
    };
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

  private extractJson(content: string): any {
    try {
      return JSON.parse(content);
    } catch {}
    const fence = content.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
    if (fence) {
      try {
        return JSON.parse(fence[1]);
      } catch {}
      const inner = this.extractBalancedJson(fence[1]);
      if (inner !== undefined) return inner;
    }
    const balanced = this.extractBalancedJson(content);
    if (balanced !== undefined) return balanced;
    return undefined;
  }

  private extractBalancedJson(content: string): any | undefined {
    for (const open of ['{', '[']) {
      const close = open === '{' ? '}' : ']';
      let start = content.indexOf(open);
      while (start !== -1) {
        let depth = 0;
        let inString = false;
        let escape = false;
        for (let i = start; i < content.length; i++) {
          const ch = content[i];
          if (escape) {
            escape = false;
            continue;
          }
          if (ch === '\\' && inString) {
            escape = true;
            continue;
          }
          if (ch === '"') {
            inString = !inString;
            continue;
          }
          if (inString) continue;
          if (ch === open) depth++;
          else if (ch === close) {
            depth--;
            if (depth === 0) {
              const candidate = content.slice(start, i + 1);
              try {
                return JSON.parse(candidate);
              } catch {
                break;
              }
            }
          }
        }
        start = content.indexOf(open, start + 1);
      }
    }
    return undefined;
  }

  private parseGeneratorResponse(
    content: string,
    expectedCount: number,
  ): RawGeneratedQuestion[] {
    const parsed = this.extractJson(content);
    if (!parsed?.questions || !Array.isArray(parsed.questions)) {
      throw new Error(
        'LLM returned an invalid response format (missing "questions" array)',
      );
    }
    return parsed.questions.slice(0, expectedCount);
  }

  private parseCriticResponse(content: string, count: number): number[] {
    const parsed = this.extractJson(content);
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
