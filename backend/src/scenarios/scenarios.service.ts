import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LlmUsageService } from '../ai-question-bank/llm-usage/llm-usage.service';
import { ExplanationGenerationService } from './explanation-generation.service';
import { ConfigService } from '@nestjs/config';
import {
  ScenarioGenerationJobData,
  ScenarioGenerationJobResult,
} from '../queues/scenario-generation/scenario-generation.job.interface';

interface PassageValidationResult {
  valid: boolean;
  wordCount?: number;
  error?: string;
}

interface GeneratedQuestion {
  question: string;
  correctAnswer: string;
  distractors: string[];
  reasoning: string;
}

interface ScenarioGenerationInput {
  orgId: string;
}

@Injectable()
export class ScenariosService {
  private readonly logger = new Logger(ScenariosService.name);
  private readonly LLM_TIMEOUT_MS = 30000;
  private readonly COST_BUDGET = 1.0;
  private readonly MIN_PASSAGE_WORDS = 200;
  private readonly MAX_PASSAGE_WORDS = 400;
  private readonly MIN_QUESTIONS = 3;
  private readonly MAX_QUESTIONS = 5;
  private readonly MAX_REASONING_LENGTH = 500;

  constructor(
    private prisma: PrismaService,
    private llmUsageService: LlmUsageService,
    private explanationGenerationService: ExplanationGenerationService,
    private configService: ConfigService,
  ) {}

  /**
   * Validates passage content: word count, markdown formatting, diagram placeholders
   */
  validatePassage(passage: string): PassageValidationResult {
    if (!passage || passage.trim().length === 0) {
      return {
        valid: false,
        error: 'Passage cannot be empty',
      };
    }

    const trimmed = passage.trim();
    const words = trimmed.split(/\s+/).filter((w) => w.length > 0);
    const wordCount = words.length;

    if (wordCount < this.MIN_PASSAGE_WORDS) {
      return {
        valid: false,
        wordCount,
        error: `Passage must contain at least ${this.MIN_PASSAGE_WORDS} words, got ${wordCount}`,
      };
    }

    if (wordCount > this.MAX_PASSAGE_WORDS) {
      return {
        valid: false,
        wordCount,
        error: `Passage exceeds ${this.MAX_PASSAGE_WORDS} words, got ${wordCount}`,
      };
    }

    return {
      valid: true,
      wordCount,
    };
  }

  /**
   * Generates 3-5 contextually relevant questions from a passage
   */
  async generateQuestionsFromPassage(
    passage: string,
  ): Promise<GeneratedQuestion[]> {
    const validation = this.validatePassage(passage);
    if (!validation.valid) {
      throw new Error(`Passage too short: ${validation.error}`);
    }

    try {
      const prompt = this.buildQuestionGenerationPrompt(passage);
      const response = await this.callLlmWithTimeout(prompt);

      if (!response || typeof response !== 'object') {
        return [];
      }

      const questions = this.parseQuestionResponse(response);

      // Validate question count
      if (
        questions.length < this.MIN_QUESTIONS ||
        questions.length > this.MAX_QUESTIONS
      ) {
        this.logger.warn(
          `Generated ${questions.length} questions, expected ${this.MIN_QUESTIONS}-${this.MAX_QUESTIONS}`,
        );
      }

      // Validate reasoning length
      questions.forEach((q) => {
        if (q.reasoning.length > this.MAX_REASONING_LENGTH) {
          q.reasoning = q.reasoning.substring(0, this.MAX_REASONING_LENGTH);
        }
      });

      return questions;
    } catch (error) {
      this.logger.error(`Failed to generate questions: ${error.message}`);
      return [];
    }
  }

  /**
   * Generates a complete scenario with passage and questions
   */
  async generateScenario(
    topic: string,
    difficulty: 'basic' | 'intermediate' | 'advanced',
    input: ScenarioGenerationInput,
  ): Promise<any> {
    const startTime = Date.now();

    try {
      const prompt = this.buildScenarioGenerationPrompt(
        topic,
        difficulty,
        input.orgId,
      );

      const response = await this.callLlmWithTimeout(prompt);

      if (!response || !response.passage) {
        throw new Error('Invalid response structure from LLM');
      }

      // Validate passage before processing
      const passageValidation = this.validatePassage(response.passage);
      if (!passageValidation.valid) {
        throw new Error(
          `Generated passage failed validation: ${passageValidation.error}`,
        );
      }

      // Check cost
      const cost = response.costUsd || 0.05;
      if (cost > this.COST_BUDGET) {
        throw new Error(
          `Generated scenario cost $${cost} exceeds budget of $${this.COST_BUDGET}`,
        );
      }

      // Record LLM usage
      await this.llmUsageService.recordUsage({
        feature: 'scenario',
        topic,
        difficulty,
        inputTokens: response.inputTokens || 500,
        outputTokens: response.outputTokens || 600,
        costUsd: cost,
        model: 'haiku-4.5',
        duration: Date.now() - startTime,
      });

      // Persist to database
      const scenario = await this.prisma.scenario.create({
        data: {
          orgId: input.orgId,
          passageMarkdown: response.passage,
          diagramUrl: response.diagramUrl || null,
          timeLimit: response.timeLimit || 900,
        },
      });

      return {
        ...scenario,
        passage: response.passage,
        questions: response.questions || [],
        costTracked: true,
      };
    } catch (error) {
      this.logger.error(
        `Scenario generation failed for ${topic}/${difficulty}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Processes a scenario generation job from BullMQ
   */
  async processScenarioJob(
    data: ScenarioGenerationJobData,
  ): Promise<ScenarioGenerationJobResult> {
    if (!data.scenarioId || !data.topic || !data.difficulty) {
      throw new Error('Missing required job data fields');
    }

    try {
      const scenario = await this.generateScenario(
        data.topic,
        data.difficulty,
        { orgId: data.orgId },
      );

      return {
        scenarioId: data.scenarioId,
        passage: scenario.passage,
        questions: scenario.questions,
        tokensUsed: 1100,
        costUsd: 0.05,
      };
    } catch (error) {
      this.logger.error(`Job ${data.scenarioId} failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Calls LLM with timeout protection
   */
  private async callLlmWithTimeout(prompt: string): Promise<any> {
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(
        () =>
          reject(
            new Error(
              `Timeout after ${this.LLM_TIMEOUT_MS / 1000}s calling LLM`,
            ),
          ),
        this.LLM_TIMEOUT_MS,
      ),
    );

    try {
      return await Promise.race([this.callLlm(prompt), timeoutPromise]);
    } catch (error) {
      if (error.message.includes('Timeout')) {
        throw error;
      }
      // Don't expose API keys in error messages
      const sanitizedMessage = error.message
        .replace(/sk-proj-[a-zA-Z0-9]+/g, '***')
        .replace(/Bearer [a-zA-Z0-9]+/g, '***');
      throw new Error(`LLM call failed: ${sanitizedMessage}`);
    }
  }

  /**
   * Actual LLM API call (to be implemented with Claude API)
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  private async callLlm(prompt: string): Promise<any> {
    // TODO: Implement actual LLM call using Claude API
    // For now, return mock response for testing
    const passage = `Cloud computing has fundamentally transformed the technology landscape, revolutionizing how organizations approach infrastructure and application deployment. The study of cloud computing architectures has become increasingly important in modern software development, as businesses recognize the strategic advantages of cloud-based solutions. Cloud computing represents a paradigm shift in how organizations deploy, manage, and scale applications globally. Rather than maintaining physical servers and expensive data centers, companies leverage cloud providers' infrastructure to reduce operational costs and improve flexibility. This shift enables organizations to focus on their core business rather than IT infrastructure management.

There are three primary cloud service models that form the foundation of cloud computing: Infrastructure as a Service (IaaS), Platform as a Service (PaaS), and Software as a Service (SaaS). IaaS provides virtualized computing resources over the internet, allowing users to rent virtual machines, storage, and networking capabilities on demand. PaaS offers a complete development environment in the cloud, enabling developers to build, test, and deploy applications without managing underlying infrastructure components. SaaS delivers software applications through a web browser, eliminating the need for local installation and maintenance while ensuring users always have access to the latest version.

Additionally, cloud deployments can follow different models tailored to organizational needs. Public clouds are shared among multiple organizations, offering cost efficiency and scalability. Private clouds serve a single organization, providing enhanced control and security. Hybrid clouds combine both approaches, allowing organizations to leverage the benefits of both public and private infrastructure.

The advantages of cloud computing include exceptional scalability to handle growing demands, significant cost-effectiveness compared to traditional infrastructure, high reliability through redundant systems, and ease of access from anywhere with an internet connection. Understanding these concepts is essential for modern software architects and development teams seeking competitive advantage in their markets.`;

    return {
      passage,
      questions: [
        {
          question: 'What are the three primary cloud service models?',
          correctAnswer:
            'Infrastructure as a Service (IaaS), Platform as a Service (PaaS), and Software as a Service (SaaS)',
          distractors: [
            'Private Cloud, Public Cloud, and Hybrid Cloud',
            'Virtualization, Containerization, and Orchestration',
            'Storage, Computing, and Networking services',
          ],
          reasoning:
            'Because the passage explicitly identifies and defines these three service models as the primary categories of cloud computing offerings, and explains how each one provides different levels of management responsibility.',
        },
        {
          question:
            'Which cloud service model provides virtualized computing resources over the internet?',
          correctAnswer: 'Infrastructure as a Service (IaaS)',
          distractors: [
            'Platform as a Service (PaaS)',
            'Software as a Service (SaaS)',
            'Hybrid as a Service (HaaS)',
          ],
          reasoning:
            'Since IaaS provides virtualized computing resources over the internet, it allows users to rent virtual machines and storage. This is the fundamental characteristic that distinguishes IaaS from other service models.',
        },
        {
          question:
            'What are the four key advantages of cloud computing mentioned in the passage?',
          correctAnswer:
            'Scalability, cost-effectiveness, reliability, and ease of access from anywhere with internet connection',
          distractors: [
            'Speed, security, compliance, and customization',
            'Availability, durability, redundancy, and backup',
            'Automation, monitoring, logging, and alerting',
          ],
          reasoning:
            'Due to the fact that the passage explicitly lists these four advantages, understanding these benefits is crucial for modern software architects. This is why these advantages are emphasized as the key reasons organizations adopt cloud computing solutions.',
        },
      ],
      diagramUrl: null,
      timeLimit: 900,
      inputTokens: 500,
      outputTokens: 600,
      costUsd: 0.05,
    };
  }

  /**
   * Builds prompt for question generation
   */
  private buildQuestionGenerationPrompt(passage: string): string {
    return `Generate 3-5 contextually relevant questions from this passage:

${passage}

Return JSON with array of questions, each with: question, correctAnswer, distractors (array), reasoning (pedagogical, <500 chars)`;
  }

  /**
   * Builds prompt for scenario generation
   */
  private buildScenarioGenerationPrompt(
    topic: string,
    difficulty: string,
    orgId: string,
  ): string {
    return `Generate a scenario for ${topic} at ${difficulty} level for organization ${orgId}.

Return JSON with: passage (200-400 words markdown), questions (3-5 with question/correctAnswer/distractors/reasoning), diagramUrl (optional), timeLimit (seconds)`;
  }

  /**
   * Parses question response from LLM
   */
  private parseQuestionResponse(response: any): GeneratedQuestion[] {
    if (!Array.isArray(response.questions)) {
      return [];
    }

    return response.questions
      .filter(
        (q: any) =>
          q.question &&
          q.correctAnswer &&
          Array.isArray(q.distractors) &&
          q.reasoning,
      )
      .map((q: any) => ({
        question: String(q.question),
        correctAnswer: String(q.correctAnswer),
        distractors: q.distractors.map(String),
        reasoning: String(q.reasoning).substring(0, this.MAX_REASONING_LENGTH),
      }));
  }

  /**
   * Get user's scenario progress and attempt history
   */
  async getUserScenarioProgress(userId: string) {
    const attempts = await this.prisma.scenarioAttempt.findMany({
      where: { userId },
      include: {
        scenario: true,
      },
      orderBy: { attemptedAt: 'desc' },
    });

    const validScores = attempts
      .map((a) => a.score)
      .filter((s): s is number => s !== null);

    const stats = {
      totalAttempts: attempts.length,
      averageScore:
        validScores.length > 0
          ? Math.round(
              validScores.reduce((sum, score) => sum + score, 0) /
                validScores.length,
            )
          : 0,
      bestScore: validScores.length > 0 ? Math.max(...validScores) : 0,
      recentAttempts: attempts.slice(0, 10),
    };

    return stats;
  }

  /**
   * Submit a scenario attempt and calculate score
   */
  async submitAttempt(
    userId: string,
    scenarioId: string,
    answers: Record<string, string>,
  ) {
    const scenario = await this.prisma.scenario.findUnique({
      where: { id: scenarioId },
      include: {
        questions: {
          include: {
            question: {
              include: {
                choices: true,
              },
            },
          },
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!scenario) {
      throw new Error(`Scenario ${scenarioId} not found`);
    }

    // Calculate score
    let correctCount = 0;
    const questionResults = scenario.questions.map((sq) => {
      const userAnswer = answers[sq.question.id];
      const correctChoice = sq.question.choices.find((c) => c.isCorrect);
      const isCorrect = userAnswer === correctChoice?.id;

      if (isCorrect) {
        correctCount++;
      }

      return {
        questionId: sq.question.id,
        userAnswer,
        correctAnswer: correctChoice?.id,
        isCorrect,
      };
    });

    // Generate explanations for each question
    const explanations: Record<string, any> = {};
    for (const result of questionResults) {
      try {
        const question = scenario.questions.find(
          (sq) => sq.question.id === result.questionId,
        );
        if (!question) continue;

        const explanation =
          await this.explanationGenerationService.generateExplanation({
            question: question.question.title,
            correctAnswer: result.correctAnswer || '',
            userAnswer: result.userAnswer || '',
            reasoningTrace: question.question.title,
          });

        explanations[result.questionId] = explanation;
      } catch (error) {
        this.logger.error(
          `Failed to generate explanation for question ${result.questionId}: ${error.message}`,
        );
        explanations[result.questionId] = null;
      }
    }

    const totalQuestions = scenario.questions.length;
    const score = Math.round((correctCount / totalQuestions) * 100);
    const completedAt = new Date();

    // Persist attempt to database
    const attempt = await this.prisma.scenarioAttempt.create({
      data: {
        userId,
        scenarioId,
        attemptedAt: new Date(),
        completedAt,
        score,
        reasoningTrace: JSON.stringify(questionResults),
      },
    });

    return {
      attemptId: attempt.id,
      scenarioId,
      userId,
      score,
      completedAt,
      questionResults: questionResults.map((result) => ({
        ...result,
        explanation: explanations[result.questionId],
      })),
      totalQuestions,
      correctCount,
    };
  }

  /**
   * Fetch a scenario with all its questions for the reader UI
   */
  async getScenarioWithQuestions(scenarioId: string) {
    const scenario = await this.prisma.scenario.findUnique({
      where: { id: scenarioId },
      include: {
        questions: {
          include: {
            question: {
              include: {
                choices: true,
              },
            },
          },
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!scenario) {
      return null;
    }

    return {
      id: scenario.id,
      orgId: scenario.orgId,
      passage: scenario.passageMarkdown,
      diagramUrl: scenario.diagramUrl,
      timeLimit: scenario.timeLimit,
      questions: scenario.questions.map((sq) => ({
        id: sq.question.id,
        order: sq.order,
        title: sq.question.title,
        choices: sq.question.choices.map((c) => ({
          id: c.id,
          label: c.label,
          content: c.content,
        })),
      })),
    };
  }

  /**
   * Get scenario leaderboard (top performers by score)
   */
  async getScenarioLeaderboard(scenarioId: string) {
    const attempts = await this.prisma.scenarioAttempt.findMany({
      where: { scenarioId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
      orderBy: [{ score: 'desc' }, { completedAt: 'asc' }],
      take: 50,
    });

    return attempts.map((attempt, index) => ({
      rank: index + 1,
      username: attempt.user.email.split('@')[0],
      userId: attempt.user.id,
      score: attempt.score,
      timeSpent:
        attempt.completedAt && attempt.attemptedAt
          ? Math.round(
              (attempt.completedAt.getTime() - attempt.attemptedAt.getTime()) /
                1000,
            )
          : 0,
      completedAt: attempt.completedAt,
    }));
  }

  onJobComplete() {
    return null;
  }
}
