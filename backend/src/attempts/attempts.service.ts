import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SubmitAnswerDto } from './dto/submit-answer.dto';
import { SubmitAttemptDto } from './dto/submit-attempt.dto';
import {
  AttemptStatus,
  FeedbackMode,
  MistakeType,
  PracticeMode,
  Prisma,
  TimerMode,
} from '@prisma/client';
import {
  GamificationService,
  POINTS,
} from '../gamification/gamification.service';
import { ExamsService } from '../exams/exams.service';
import {
  AttemptResultResponse,
  QuestionResultResponse,
} from './dto/attempt-result.dto';
import { CheckAnswerResponse } from './dto/check-answer.dto';
import { isAnswerCorrect } from './grading';
import {
  ActiveAttemptSummary,
  AttemptStateResponse,
} from './dto/attempt-state.dto';
import { AttemptInsightsResponse } from './dto/attempt-insights.dto';
import { passProbability } from '../exams/ability';
import {
  catConfig,
  CatState,
  domainShares,
  estimate,
  nextItem,
  stopReason,
} from '../exams/cat';
import { CatAnswerResponse, CatProgress } from './dto/cat.dto';

/** Length of the exam the pass likelihood is computed for. */
export const READINESS_EXAM_LENGTH = 65;

interface QuestionWithChoices extends Prisma.QuestionGetPayload<{
  include: { choices: true; domain: true };
}> {}

/**
 * Per-attempt presentation order, stored on ExamAttempt.presentation so a
 * resumed attempt shows the same order and the review reuses the same labels.
 */
interface Presentation {
  questionIds: string[];
  choiceIds: Record<string, string[]>;
  /** CAT attempts only: adaptive state; questionIds grows as items are given. */
  cat?: CatState;
}

/**
 * Answers and submits are still accepted this long after the deadline, so a
 * submit fired by the client's timer at 00:00 isn't lost to network latency.
 */
export const DEADLINE_GRACE_MS = 30_000;
/** ACCELERATED mode shrinks the exam's time budget (see ExamIntro). */
export const ACCELERATED_TIME_FACTOR = 0.75;

/** Time budget in minutes the learner actually gets for this exam. */
export function effectiveTimeLimit(exam: {
  timeLimit: number;
  timerMode?: TimerMode | null;
}): number {
  if (exam.timerMode === TimerMode.ACCELERATED) {
    return Math.max(1, Math.round(exam.timeLimit * ACCELERATED_TIME_FACTOR));
  }
  return exam.timeLimit;
}

/** Answering a wrong question faster than this (seconds) looks careless. */
export const CARELESS_MAX_SECONDS = 10;
/** Spending more than this multiple of the target pace looks like time pressure. */
export const SLOW_PACE_FACTOR = 2;

/**
 * A hint for the mistake type of a wrong answer from the time spent on it:
 * very quick → CARELESS, far over the target pace → TIME_PRESSURE. Only a
 * suggestion; the learner's own tag (Answer.mistakeType) always wins.
 */
export function suggestMistakeType(
  correct: boolean,
  answered: boolean,
  timeSpent: number | null | undefined,
  targetSecondsPerQuestion: number | null,
): MistakeType | undefined {
  if (correct || !answered || timeSpent === null || timeSpent === undefined) {
    return undefined;
  }
  if (timeSpent < CARELESS_MAX_SECONDS) return MistakeType.CARELESS;
  if (
    targetSecondsPerQuestion &&
    timeSpent > targetSecondsPerQuestion * SLOW_PACE_FACTOR
  ) {
    return MistakeType.TIME_PRESSURE;
  }
  return undefined;
}

function readPresentation(value: Prisma.JsonValue | null | undefined) {
  const p = value as unknown as Presentation | null | undefined;
  return p && Array.isArray(p.questionIds) ? p : null;
}

/** Sort `items` by the id order in `order`; unknown ids keep their relative order at the end. */
function orderByIds<T extends { id: string }>(items: T[], order?: string[]) {
  if (!order) return items;
  const rank = new Map(order.map((id, i) => [id, i]));
  return [...items].sort(
    (a, b) =>
      (rank.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
      (rank.get(b.id) ?? Number.MAX_SAFE_INTEGER),
  );
}

/** An answer already revealed in INTERACTIVE mode; it can no longer change. */
interface LockedAnswer {
  selectedChoices: string[];
  isCorrect: boolean | null;
  checkedAt: Date | null;
}

@Injectable()
export class AttemptsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gamification: GamificationService,
    private readonly examsService: ExamsService,
  ) {}

  async start(
    userId: string,
    examId: string,
    feedbackMode: FeedbackMode = FeedbackMode.END_OF_EXAM,
  ) {
    const exam = await this.prisma.exam.findUnique({
      where: { id: examId },
      include: {
        certification: {
          include: {
            domains: true,
            provider: {
              select: { id: true, name: true, slug: true },
            },
          },
        },
        examQuestions: {
          orderBy: { sortOrder: 'asc' },
          include: {
            question: {
              include: {
                choices: { orderBy: { sortOrder: 'asc' } },
                domain: true,
                tags: { include: { tag: true } },
              },
            },
          },
        },
      },
    });

    if (!exam || exam.deletedAt) throw new NotFoundException('Exam not found');
    // A practice draw is personal (it is built from the learner's history).
    if (exam.isPractice && exam.createdBy !== userId) {
      throw new NotFoundException('Exam not found');
    }

    // Time Pressure simulates the real exam, so answers stay hidden until the end.
    if (
      feedbackMode === FeedbackMode.INTERACTIVE &&
      exam.timerMode === TimerMode.TIME_PRESSURE
    ) {
      throw new BadRequestException(
        'Interactive mode is not available for Time Pressure exams',
      );
    }
    // So does a full mock exam.
    if (
      feedbackMode === FeedbackMode.INTERACTIVE &&
      exam.practiceMode === PracticeMode.FULL_MOCK
    ) {
      throw new BadRequestException(
        'Interactive mode is not available for full mock exams',
      );
    }

    if (exam.practiceMode === PracticeMode.CAT) {
      if (feedbackMode === FeedbackMode.INTERACTIVE) {
        throw new BadRequestException(
          'Interactive mode is not available for adaptive tests',
        );
      }
      return this.startCat(userId, exam);
    }

    // Randomize question order, and choice order within each question. The
    // order is stored so a resumed attempt looks the same and the result
    // review shows the labels the learner actually saw.
    const shuffledQuestions = this.shuffle(exam.examQuestions).map((eq) => ({
      ...eq.question,
      choices: this.shuffle(eq.question.choices),
    }));
    const presentation: Presentation = {
      questionIds: shuffledQuestions.map((q) => q.id),
      choiceIds: Object.fromEntries(
        shuffledQuestions.map((q) => [q.id, q.choices.map((c) => c.id)]),
      ),
    };

    const timeLimit = effectiveTimeLimit(exam);
    const startedAt = new Date();
    const expiresAt = new Date(startedAt.getTime() + timeLimit * 60_000);

    const attempt = await this.prisma.examAttempt.create({
      data: {
        userId,
        examId,
        startedAt,
        expiresAt,
        totalQuestions: exam.examQuestions.length,
        feedbackMode,
        presentation: presentation as unknown as Prisma.InputJsonValue,
      },
    });

    // Real exams don't say how hard a question is or which domain it tests.
    const hideLabels = exam.practiceMode === PracticeMode.FULL_MOCK;

    // Return questions WITHOUT isCorrect
    const questions = shuffledQuestions.map((q, index) =>
      this.toAttemptQuestion(q, index, hideLabels),
    );

    return {
      attemptId: attempt.id,
      examId: exam.id,
      title: exam.title,
      certification: exam.certification,
      timeLimit,
      timerMode: exam.timerMode,
      practiceMode: exam.practiceMode,
      feedbackMode: attempt.feedbackMode ?? feedbackMode,
      totalQuestions: questions.length,
      expiresAt,
      serverNow: new Date(),
      questions,
    };
  }

  /**
   * Public shape of a question during an attempt — never includes isCorrect
   * or the explanation. Choices are relabelled positionally (a, b, c, d...)
   * so letters always read in order top-to-bottom regardless of shuffling;
   * grading is keyed on choice.id, never on label.
   */
  private toAttemptQuestion(
    q: Prisma.QuestionGetPayload<{
      include: {
        choices: true;
        domain: true;
        tags: { include: { tag: true } };
      };
    }>,
    index: number,
    hideLabels = false,
  ) {
    const correctCount = q.choices.filter((c) => c.isCorrect).length;
    return {
      id: q.id,
      title: q.title,
      description: q.description,
      questionType: q.questionType,
      difficulty: hideLabels ? null : q.difficulty,
      isScenario: q.isScenario,
      codeSnippet: q.codeSnippet,
      imageUrl: q.imageUrl,
      // "Choose N" — real exams state how many answers a multi-select needs.
      ...(q.questionType === 'MULTIPLE' ? { selectCount: correctCount } : {}),
      domain: hideLabels ? null : q.domain,
      tags: hideLabels ? [] : q.tags.map((t) => t.tag.name),
      choices: q.choices.map((c, i) => ({
        id: c.id,
        label: String.fromCharCode(97 + i),
        content: c.content,
      })),
      sortOrder: index,
    };
  }

  /**
   * Deadline of an attempt. Attempts created before expiresAt existed fall
   * back to startedAt + the exam's time limit; null when neither is known.
   */
  private deadlineOf(attempt: {
    startedAt?: Date;
    expiresAt?: Date | null;
    exam?: { timeLimit: number; timerMode?: TimerMode | null } | null;
  }): Date | null {
    if (attempt.expiresAt) return attempt.expiresAt;
    if (attempt.startedAt && attempt.exam?.timeLimit) {
      return new Date(
        attempt.startedAt.getTime() + effectiveTimeLimit(attempt.exam) * 60_000,
      );
    }
    return null;
  }

  private isPastDeadline(
    attempt: Parameters<AttemptsService['deadlineOf']>[0],
    now = Date.now(),
  ): boolean {
    const deadline = this.deadlineOf(attempt);
    return !!deadline && now > deadline.getTime() + DEADLINE_GRACE_MS;
  }

  /** Seconds spent, capped at the time limit when the attempt has a deadline. */
  private elapsedSeconds(
    attempt: Parameters<AttemptsService['deadlineOf']>[0] & { startedAt: Date },
  ): number {
    const deadline = this.deadlineOf(attempt);
    const end = deadline
      ? Math.min(Date.now(), deadline.getTime())
      : Date.now();
    return Math.max(0, Math.floor((end - attempt.startedAt.getTime()) / 1000));
  }

  /**
   * Start a computerized adaptive test: freeze the pool's difficulties, take
   * the learner's earlier ability as the prior and give the first question.
   */
  private async startCat(
    userId: string,
    exam: Prisma.ExamGetPayload<{
      include: {
        certification: { include: { domains: true } };
        examQuestions: {
          include: {
            question: {
              include: {
                choices: true;
                domain: true;
                tags: { include: { tag: true } };
              };
            };
          };
        };
      };
    }>,
  ) {
    const questions = exam.examQuestions.map((eq) => eq.question);
    const [difficulty, prior] = await Promise.all([
      this.examsService.questionDifficulties(questions),
      this.examsService.abilityFor(userId, exam.certificationId),
    ]);
    const pool = questions.map((q) => ({
      id: q.id,
      b: difficulty.get(q.id) ?? 0,
      domainId: q.domainId ?? null,
    }));
    const state: CatState = {
      ...catConfig(Math.max(1, Math.min(exam.questionCount, pool.length))),
      pool,
      priorTheta: prior.theta,
      domainShares: domainShares(
        pool,
        new Map(
          (exam.certification.domains ?? []).map((d) => [
            d.id,
            d.weight === null ? null : Number(d.weight),
          ]),
        ),
      ),
      theta: prior.theta,
      se: 1,
      done: false,
    };
    const first = nextItem(state, []);
    if (!first) throw new BadRequestException('This test has no questions');
    const question = questions.find((q) => q.id === first.id)!;
    const choices = this.shuffle(question.choices);
    const presentation: Presentation = {
      questionIds: [first.id],
      choiceIds: { [first.id]: choices.map((c) => c.id) },
      cat: state,
    };

    const timeLimit = effectiveTimeLimit(exam);
    const startedAt = new Date();
    const expiresAt = new Date(startedAt.getTime() + timeLimit * 60_000);
    const attempt = await this.prisma.examAttempt.create({
      data: {
        userId,
        examId: exam.id,
        startedAt,
        expiresAt,
        totalQuestions: state.maxItems,
        feedbackMode: FeedbackMode.END_OF_EXAM,
        presentation: presentation as unknown as Prisma.InputJsonValue,
      },
    });

    return {
      attemptId: attempt.id,
      examId: exam.id,
      title: exam.title,
      certification: exam.certification,
      timeLimit,
      timerMode: exam.timerMode,
      practiceMode: exam.practiceMode,
      feedbackMode: FeedbackMode.END_OF_EXAM,
      totalQuestions: state.maxItems,
      expiresAt,
      serverNow: new Date(),
      // A CAT hides labels: the difficulty would reveal how it is going.
      questions: [this.toAttemptQuestion({ ...question, choices }, 0, true)],
      cat: this.catProgress(state, 0),
    };
  }

  private catProgress(state: CatState, answered: number): CatProgress {
    return {
      answered,
      minItems: state.minItems,
      maxItems: state.maxItems,
      standardError: Math.round(state.se * 100) / 100,
      targetStandardError: state.targetSe,
      done: state.done,
      stoppedBy: state.stoppedBy ?? null,
    };
  }

  /**
   * CAT: answer the current question (it is locked, there is no going back),
   * re-estimate the ability and either give the next question or end the
   * test and grade it.
   */
  async answerCat(
    userId: string,
    attemptId: string,
    dto: SubmitAnswerDto,
  ): Promise<CatAnswerResponse> {
    const attempt = await this.prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: { exam: { select: { timeLimit: true, timerMode: true } } },
    });
    if (!attempt) throw new NotFoundException('Attempt not found');
    if (attempt.userId !== userId)
      throw new ForbiddenException('Not your attempt');
    if (attempt.status !== AttemptStatus.IN_PROGRESS) {
      throw new BadRequestException('Attempt already submitted');
    }
    const presentation = readPresentation(attempt.presentation);
    if (!presentation?.cat) {
      throw new BadRequestException('Not an adaptive test');
    }
    if (this.isPastDeadline(attempt)) {
      await this.closeFromStoredAnswers(attemptId, { expired: true });
      return { done: true, result: await this.findResult(attemptId, userId) };
    }
    const current =
      presentation.questionIds[presentation.questionIds.length - 1];
    if (dto.questionId !== current || presentation.cat.done) {
      throw new ConflictException('This is not the current question');
    }

    const examQuestion = await this.prisma.examQuestion.findFirst({
      where: { examId: attempt.examId, questionId: dto.questionId },
      include: { question: { include: { choices: true } } },
    });
    if (!examQuestion) {
      throw new BadRequestException('Question is not part of this exam');
    }
    const choiceIds = new Set(examQuestion.question.choices.map((c) => c.id));
    if (
      dto.selectedChoices.length === 0 ||
      new Set(dto.selectedChoices).size !== dto.selectedChoices.length ||
      dto.selectedChoices.some((id) => !choiceIds.has(id))
    ) {
      throw new BadRequestException('Invalid selected choices');
    }
    const isCorrect = isAnswerCorrect(
      examQuestion.question.choices.filter((c) => c.isCorrect).map((c) => c.id),
      dto.selectedChoices,
    );
    const timeSpent = this.clampTimeSpent(dto.timeSpent, attempt);
    const loadQuestion = (db: Prisma.TransactionClient, id: string) =>
      db.question.findUniqueOrThrow({
        where: { id },
        include: {
          choices: { orderBy: { sortOrder: 'asc' } },
          domain: true,
          tags: { include: { tag: true } },
        },
      });

    const outcome = await this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<{ status: AttemptStatus }[]>`
        SELECT status FROM exam_attempts WHERE id = ${attemptId} FOR UPDATE`;
      if (locked[0]?.status !== AttemptStatus.IN_PROGRESS) {
        throw new BadRequestException('Attempt already submitted');
      }
      // Re-read under the lock: a concurrent answer may have moved on.
      const fresh = await tx.examAttempt.findUnique({
        where: { id: attemptId },
        select: { presentation: true },
      });
      const p = readPresentation(fresh?.presentation)!;
      const state = p.cat!;
      if (
        state.done ||
        p.questionIds[p.questionIds.length - 1] !== dto.questionId
      ) {
        throw new ConflictException('This is not the current question');
      }

      await tx.answer.create({
        data: {
          attemptId,
          questionId: dto.questionId,
          selectedChoices: dto.selectedChoices,
          isCorrect,
          isMarked: dto.isMarked ?? false,
          questionOrder: p.questionIds.length - 1,
          ...(timeSpent !== undefined ? { timeSpent } : {}),
        },
      });
      const responses = await tx.answer.findMany({
        where: { attemptId },
        select: { questionId: true, isCorrect: true },
      });
      const { theta, se } = estimate(
        state.pool,
        responses.map((r) => ({
          questionId: r.questionId,
          correct: r.isCorrect === true,
        })),
        state.priorTheta,
      );
      state.theta = theta;
      state.se = se;

      const reason = stopReason(
        state,
        responses.length,
        state.pool.length - p.questionIds.length,
      );
      let next: Awaited<ReturnType<typeof loadQuestion>> | null = null;
      if (reason) {
        state.done = true;
        state.stoppedBy = reason;
      } else {
        const item = nextItem(state, p.questionIds);
        if (item) {
          next = await loadQuestion(tx, item.id);
          next!.choices = this.shuffle(next!.choices);
          p.questionIds.push(item.id);
          p.choiceIds[item.id] = next!.choices.map((c) => c.id);
        } else {
          state.done = true;
          state.stoppedBy = 'POOL_EXHAUSTED';
        }
      }
      await tx.examAttempt.update({
        where: { id: attemptId },
        data: { presentation: p as unknown as Prisma.InputJsonValue },
      });
      return { state, next, answered: responses.length };
    });

    if (!outcome.next) {
      await this.closeFromStoredAnswers(attemptId);
      return {
        done: true,
        progress: this.catProgress(outcome.state, outcome.answered),
        result: await this.findResult(attemptId, userId),
      };
    }

    return {
      done: false,
      progress: this.catProgress(outcome.state, outcome.answered),
      question: this.toAttemptQuestion(outcome.next, outcome.answered, true),
    };
  }

  // Fisher-Yates: array.sort(() => Math.random() - 0.5) is statistically
  // biased and was leaving some orderings far more likely than others.
  private shuffle<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  /**
   * Per-question time reported by the client, capped at how long the attempt
   * has been running so a crafted value can't skew the pace analysis.
   */
  private clampTimeSpent(
    value: number | undefined,
    attempt: Parameters<AttemptsService['elapsedSeconds']>[0],
  ): number | undefined {
    if (value === undefined || value === null) return undefined;
    return Math.max(
      0,
      Math.min(Math.floor(value), this.elapsedSeconds(attempt)),
    );
  }

  /** Position of a question in the attempt's presentation order. */
  private async questionOrderFor(
    attempt: { id: string; presentation?: Prisma.JsonValue | null },
    questionId: string,
    db: Pick<Prisma.TransactionClient, 'answer'>,
  ): Promise<number> {
    const index =
      readPresentation(attempt.presentation)?.questionIds.indexOf(questionId) ??
      -1;
    if (index >= 0) return index;
    return db.answer.count({ where: { attemptId: attempt.id } });
  }

  async saveAnswer(userId: string, attemptId: string, dto: SubmitAnswerDto) {
    const attempt = await this.prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: { exam: { select: { timeLimit: true, timerMode: true } } },
    });
    if (!attempt) throw new NotFoundException('Attempt not found');
    if (attempt.userId !== userId)
      throw new ForbiddenException('Not your attempt');
    if (attempt.status !== AttemptStatus.IN_PROGRESS) {
      throw new BadRequestException('Attempt already submitted');
    }
    if (this.isPastDeadline(attempt)) {
      throw new BadRequestException('Time is up for this attempt');
    }
    if (readPresentation(attempt.presentation)?.cat) {
      throw new BadRequestException(
        'Adaptive tests are answered via /attempts/:id/cat/answer',
      );
    }
    // Interactive answers go through checkAnswer(), which locks them under a
    // row lock; this unlocked upsert must never race with it.
    if (attempt.feedbackMode === FeedbackMode.INTERACTIVE) {
      throw new BadRequestException(
        'Interactive attempts are answered via /attempts/:id/check',
      );
    }

    const examQuestion = await this.prisma.examQuestion.findFirst({
      where: { examId: attempt.examId, questionId: dto.questionId },
      include: { question: { include: { choices: true } } },
    });
    if (!examQuestion) {
      throw new BadRequestException('Question is not part of this exam');
    }
    const question = examQuestion.question;
    const choiceIds = new Set(question.choices.map((c) => c.id));
    if (dto.selectedChoices.some((id) => !choiceIds.has(id))) {
      throw new BadRequestException('Invalid selected choices');
    }

    const correctChoices = question.choices
      .filter((c) => c.isCorrect)
      .map((c) => c.id);
    const isCorrect = isAnswerCorrect(correctChoices, dto.selectedChoices);

    const existing = await this.prisma.answer.findFirst({
      where: { attemptId, questionId: dto.questionId },
      select: { id: true, checkedAt: true },
    });
    if (existing?.checkedAt) {
      throw new ConflictException('Answer already checked');
    }

    // Stamp new answers with their position in the order the learner was
    // shown the questions. Attempts without a stored presentation fall back to
    // the save sequence. Existing answers keep their original order on update.
    const questionOrder = existing
      ? undefined
      : await this.questionOrderFor(attempt, dto.questionId, this.prisma);

    const timeSpent = this.clampTimeSpent(dto.timeSpent, attempt);

    return this.prisma.answer.upsert({
      where: { id: existing?.id ?? '' },
      create: {
        attemptId,
        questionId: dto.questionId,
        selectedChoices: dto.selectedChoices,
        isCorrect,
        isMarked: dto.isMarked ?? false,
        questionOrder: questionOrder ?? 0,
        ...(timeSpent !== undefined ? { timeSpent } : {}),
      },
      update: {
        selectedChoices: dto.selectedChoices,
        isCorrect,
        isMarked: dto.isMarked ?? false,
        ...(timeSpent !== undefined ? { timeSpent } : {}),
      },
      // Never echo isCorrect back mid-exam: in end-of-exam mode the client
      // must not learn whether an answer is right until the attempt is graded.
      select: {
        id: true,
        questionId: true,
        selectedChoices: true,
        isMarked: true,
      },
    });
  }

  /**
   * INTERACTIVE mode: grade one question, lock it and reveal the correct
   * choices + explanation. Each question can be checked exactly once.
   */
  async checkAnswer(
    userId: string,
    attemptId: string,
    dto: SubmitAnswerDto,
  ): Promise<CheckAnswerResponse> {
    const attempt = await this.prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: { exam: { select: { timeLimit: true, timerMode: true } } },
    });
    if (!attempt) throw new NotFoundException('Attempt not found');
    if (attempt.userId !== userId)
      throw new ForbiddenException('Not your attempt');
    if (attempt.status !== AttemptStatus.IN_PROGRESS) {
      throw new BadRequestException('Attempt already submitted');
    }
    if (this.isPastDeadline(attempt)) {
      throw new BadRequestException('Time is up for this attempt');
    }
    if (attempt.feedbackMode !== FeedbackMode.INTERACTIVE) {
      throw new ForbiddenException(
        'Interactive feedback is not enabled for this attempt',
      );
    }

    const examQuestion = await this.prisma.examQuestion.findFirst({
      where: { examId: attempt.examId, questionId: dto.questionId },
      include: { question: { include: { choices: true } } },
    });
    if (!examQuestion) {
      throw new BadRequestException('Question is not part of this exam');
    }
    const question = examQuestion.question;

    const choiceIds = new Set(question.choices.map((c) => c.id));
    const selectedChoices = dto.selectedChoices;
    if (
      selectedChoices.length === 0 ||
      new Set(selectedChoices).size !== selectedChoices.length ||
      selectedChoices.some((id) => !choiceIds.has(id))
    ) {
      throw new BadRequestException('Invalid selected choices');
    }

    const correctChoiceIds = question.choices
      .filter((c) => c.isCorrect)
      .map((c) => c.id);
    const isCorrect = isAnswerCorrect(correctChoiceIds, selectedChoices);
    const checkedAt = new Date();
    const timeSpent = this.clampTimeSpent(dto.timeSpent, attempt);
    const timeData = timeSpent !== undefined ? { timeSpent } : {};

    await this.prisma.$transaction(async (tx) => {
      // Serialize checks within one attempt so two concurrent requests for
      // the same question can't both pass the "not yet checked" test.
      const locked = await tx.$queryRaw<{ status: AttemptStatus }[]>`
        SELECT status FROM exam_attempts WHERE id = ${attemptId} FOR UPDATE`;
      if (locked[0]?.status !== AttemptStatus.IN_PROGRESS) {
        throw new BadRequestException('Attempt already submitted');
      }

      const existing = await tx.answer.findFirst({
        where: { attemptId, questionId: dto.questionId },
        select: {
          id: true,
          checkedAt: true,
          selectedChoices: true,
          isCorrect: true,
        },
      });
      if (existing?.checkedAt) {
        // Hand back what was revealed so a client that lost its state (e.g.
        // after a reload) can show the verdict again instead of getting stuck.
        const result: CheckAnswerResponse = {
          questionId: question.id,
          isCorrect: existing.isCorrect === true,
          selectedChoiceIds: existing.selectedChoices,
          correctChoiceIds,
          explanation: question.explanation ?? null,
          checkedAt: existing.checkedAt,
        };
        throw new ConflictException({
          statusCode: 409,
          error: 'Conflict',
          message: 'Answer already checked',
          result,
        });
      }

      if (existing) {
        await tx.answer.update({
          where: { id: existing.id },
          data: {
            selectedChoices,
            isCorrect,
            isMarked: dto.isMarked ?? false,
            checkedAt,
            ...timeData,
          },
        });
      } else {
        const questionOrder = await this.questionOrderFor(
          attempt,
          dto.questionId,
          tx,
        );
        await tx.answer.create({
          data: {
            attemptId,
            questionId: dto.questionId,
            selectedChoices,
            isCorrect,
            isMarked: dto.isMarked ?? false,
            questionOrder,
            checkedAt,
            ...timeData,
          },
        });
      }
    });

    return {
      questionId: question.id,
      isCorrect,
      selectedChoiceIds: selectedChoices,
      correctChoiceIds,
      explanation: question.explanation ?? null,
      checkedAt,
    };
  }

  async submit(
    userId: string,
    attemptId: string,
    dto: SubmitAttemptDto,
  ): Promise<AttemptResultResponse> {
    const attempt = await this.prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: { exam: true },
    });
    if (!attempt) throw new NotFoundException('Attempt not found');
    if (attempt.userId !== userId)
      throw new ForbiddenException('Not your attempt');
    if (attempt.status !== AttemptStatus.IN_PROGRESS) {
      throw new BadRequestException('Attempt already submitted');
    }

    // An adaptive test is graded from the answers it recorded one by one;
    // submitting just ends it early.
    if (readPresentation(attempt.presentation)?.cat) {
      await this.closeFromStoredAnswers(attemptId, {
        expired: this.isPastDeadline(attempt),
      });
      return this.findResult(attemptId, userId);
    }

    // Past the deadline the payload can't be trusted (it may carry answers
    // picked after time ran out): grade what was autosaved before it instead.
    if (this.isPastDeadline(attempt)) {
      await this.closeFromStoredAnswers(attemptId, { expired: true });
      return this.findResult(attemptId, userId);
    }

    // Fetch all questions with correct answers
    const examQuestions = await this.prisma.examQuestion.findMany({
      where: { examId: attempt.examId },
      include: {
        question: {
          include: {
            choices: true,
            domain: true,
          },
        },
      },
    });

    const totalQuestions = examQuestions.length;
    const timeSpent = this.elapsedSeconds(attempt);

    // Transaction: save answers + update attempt + update exam stats
    await this.prisma.$transaction(async (tx) => {
      // Same row lock as checkAnswer(): a check can't slip in between reading
      // the locked answers and rewriting them, and a double submit can't
      // grade (and count) the attempt twice.
      const locked = await tx.$queryRaw<{ status: AttemptStatus }[]>`
        SELECT status FROM exam_attempts WHERE id = ${attemptId} FOR UPDATE`;
      if (locked[0]?.status !== AttemptStatus.IN_PROGRESS) {
        throw new BadRequestException('Attempt already submitted');
      }

      // Answers revealed in INTERACTIVE mode are final: grade them from what
      // was stored at check time, never from the submit payload.
      const lockedAnswers = new Map<string, LockedAnswer>();
      if (attempt.feedbackMode === FeedbackMode.INTERACTIVE) {
        const checked = await tx.answer.findMany({
          where: { attemptId, checkedAt: { not: null } },
          select: {
            questionId: true,
            selectedChoices: true,
            isCorrect: true,
            checkedAt: true,
          },
        });
        for (const a of checked) lockedAnswers.set(a.questionId, a);
      }

      const { totalCorrect, domainScores, answerRecords } =
        this.evaluateAnswers(
          attemptId,
          {
            answers: dto.answers.map((a) => ({
              ...a,
              timeSpent: this.clampTimeSpent(a.timeSpent, attempt),
            })),
          },
          examQuestions,
          lockedAnswers,
        );
      const score =
        totalQuestions > 0 ? (totalCorrect / totalQuestions) * 100 : 0;

      // Delete any previously saved answers for this attempt
      await tx.answer.deleteMany({ where: { attemptId } });
      // Create all answer records
      await tx.answer.createMany({ data: answerRecords });
      // Update attempt
      await tx.examAttempt.update({
        where: { id: attemptId },
        data: {
          status: AttemptStatus.SUBMITTED,
          submittedAt: new Date(),
          score,
          totalCorrect,
          totalQuestions,
          domainScores,
          timeSpent,
        },
      });
      // Increment exam attempt count
      await tx.exam.update({
        where: { id: attempt.examId },
        data: { attemptCount: { increment: 1 } },
      });
    });

    await this.gamification.awardPoints(userId, POINTS.COMPLETE_EXAM);
    await this.examsService.updateAvgScore(attempt.examId);

    return this.findResult(attemptId, userId);
  }

  async finish(
    userId: string,
    attemptId: string,
  ): Promise<AttemptResultResponse> {
    const attempt = await this.prisma.examAttempt.findUnique({
      where: { id: attemptId },
      select: { userId: true, status: true },
    });

    if (!attempt) throw new NotFoundException('Attempt not found');
    if (attempt.userId !== userId)
      throw new ForbiddenException('Not your attempt');
    if (attempt.status !== AttemptStatus.IN_PROGRESS) {
      throw new BadRequestException('Attempt already submitted');
    }

    const closed = await this.closeFromStoredAnswers(attemptId);
    if (!closed) throw new BadRequestException('Attempt already submitted');

    return this.findResult(attemptId, userId);
  }

  /**
   * Grade an attempt from the answers already stored on the server (autosave
   * or interactive checks) and close it. Unanswered questions get an empty
   * answer row so the review lists them as skipped.
   *
   * With `expired`, an attempt nobody answered anything in is marked
   * ABANDONED instead of graded, so walking away doesn't record a 0% score.
   * Returns the new status, or null if the attempt was no longer in progress.
   */
  private async closeFromStoredAnswers(
    attemptId: string,
    opts: { expired?: boolean } = {},
  ): Promise<AttemptStatus | null> {
    const attempt = await this.prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: {
        exam: {
          include: {
            examQuestions: {
              orderBy: { sortOrder: 'asc' },
              include: { question: { include: { domain: true } } },
            },
          },
        },
      },
    });
    if (!attempt) return null;

    const examQuestions = attempt.exam.examQuestions;
    const presentation = readPresentation(attempt.presentation);
    const orderedQuestions = orderByIds(
      examQuestions.map((eq) => eq.question),
      presentation?.questionIds,
    );
    const timeSpent = this.elapsedSeconds(attempt);

    const status = await this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<{ status: AttemptStatus }[]>`
        SELECT status FROM exam_attempts WHERE id = ${attemptId} FOR UPDATE`;
      if (locked[0]?.status !== AttemptStatus.IN_PROGRESS) return null;

      const answers = await tx.answer.findMany({ where: { attemptId } });

      if (opts.expired && answers.length === 0) {
        await tx.examAttempt.update({
          where: { id: attemptId },
          data: { status: AttemptStatus.ABANDONED, timeSpent },
        });
        return AttemptStatus.ABANDONED;
      }

      const answered = new Map(answers.map((a) => [a.questionId, a]));
      let totalCorrect = 0;
      const domainScores: Record<string, { correct: number; total: number }> =
        {};
      const missing: Prisma.AnswerCreateManyInput[] = [];

      // An adaptive test is scored on the questions it actually gave and
      // got answers to; the rest of its pool was never part of the test.
      const fresh = presentation?.cat
        ? readPresentation(
            (
              await tx.examAttempt.findUnique({
                where: { id: attemptId },
                select: { presentation: true },
              })
            )?.presentation,
          )
        : null;
      const graded = fresh?.cat
        ? orderedQuestions.filter((q) => answered.has(q.id))
        : orderedQuestions;
      const catUpdate =
        fresh?.cat && !fresh.cat.done
          ? {
              presentation: {
                ...fresh,
                cat: {
                  ...fresh.cat,
                  done: true,
                  stoppedBy: opts.expired ? 'TIME' : 'ENDED_EARLY',
                },
              } as unknown as Prisma.InputJsonValue,
            }
          : {};

      graded.forEach((q, index) => {
        const answer = answered.get(q.id);
        const isCorrect = answer?.isCorrect ?? false;
        if (isCorrect) totalCorrect++;

        const domainName = q.domain?.name ?? 'Unknown';
        if (!domainScores[domainName])
          domainScores[domainName] = { correct: 0, total: 0 };
        domainScores[domainName].total++;
        if (isCorrect) domainScores[domainName].correct++;

        if (!answer) {
          missing.push({
            attemptId,
            questionId: q.id,
            selectedChoices: [],
            isCorrect: false,
            questionOrder: index,
          });
        }
      });

      if (missing.length > 0) await tx.answer.createMany({ data: missing });

      const totalQuestions = graded.length;
      await tx.examAttempt.update({
        where: { id: attemptId },
        data: {
          ...catUpdate,
          status: AttemptStatus.SUBMITTED,
          submittedAt: new Date(),
          score: totalQuestions > 0 ? (totalCorrect / totalQuestions) * 100 : 0,
          totalCorrect,
          totalQuestions,
          domainScores,
          timeSpent,
        },
      });
      await tx.exam.update({
        where: { id: attempt.examId },
        data: { attemptCount: { increment: 1 } },
      });
      return AttemptStatus.SUBMITTED;
    });

    if (status === AttemptStatus.SUBMITTED) {
      await this.gamification.awardPoints(attempt.userId, POINTS.COMPLETE_EXAM);
      await this.examsService.updateAvgScore(attempt.examId);
    }
    return status;
  }

  /**
   * Close every IN_PROGRESS attempt of this user whose deadline has passed:
   * graded from autosaved answers, or ABANDONED when nothing was answered.
   */
  async closeExpiredAttempts(userId: string): Promise<void> {
    const open = await this.prisma.examAttempt.findMany({
      where: { userId, status: AttemptStatus.IN_PROGRESS },
      select: {
        id: true,
        startedAt: true,
        expiresAt: true,
        exam: { select: { timeLimit: true, timerMode: true } },
      },
    });
    for (const attempt of open) {
      if (this.isPastDeadline(attempt)) {
        await this.closeFromStoredAnswers(attempt.id, { expired: true });
      }
    }
  }

  /**
   * The learner's most recent attempt that can still be resumed, optionally
   * limited to one certification. Expired attempts are closed first.
   */
  async findActive(
    userId: string,
    certificationId?: string,
  ): Promise<{ active: ActiveAttemptSummary | null }> {
    await this.closeExpiredAttempts(userId);

    const attempt = await this.prisma.examAttempt.findFirst({
      where: {
        userId,
        status: AttemptStatus.IN_PROGRESS,
        exam: {
          deletedAt: null,
          ...(certificationId ? { certificationId } : {}),
        },
      },
      orderBy: { startedAt: 'desc' },
      include: {
        exam: {
          select: {
            title: true,
            timeLimit: true,
            timerMode: true,
            certificationId: true,
          },
        },
        _count: { select: { answers: true } },
      },
    });
    if (!attempt) return { active: null };

    return {
      active: {
        attemptId: attempt.id,
        examId: attempt.examId,
        certificationId: attempt.exam.certificationId,
        title: attempt.exam.title,
        timerMode: attempt.exam.timerMode,
        feedbackMode: attempt.feedbackMode,
        answeredCount: attempt._count.answers,
        totalQuestions: attempt.totalQuestions ?? 0,
        startedAt: attempt.startedAt,
        expiresAt: this.deadlineOf(attempt),
      },
    };
  }

  /**
   * Everything a client needs to pick an attempt back up after a reload:
   * the questions in the order originally shown, saved answers and flags,
   * revealed INTERACTIVE verdicts and the server deadline. An attempt that is
   * no longer in progress (or just expired and was closed) only reports its
   * status.
   */
  async getState(
    userId: string,
    attemptId: string,
  ): Promise<AttemptStateResponse> {
    const owner = await this.prisma.examAttempt.findUnique({
      where: { id: attemptId },
      select: {
        userId: true,
        status: true,
        startedAt: true,
        expiresAt: true,
        exam: { select: { timeLimit: true, timerMode: true } },
      },
    });
    if (!owner) throw new NotFoundException('Attempt not found');
    if (owner.userId !== userId)
      throw new ForbiddenException('Not your attempt');

    if (
      owner.status === AttemptStatus.IN_PROGRESS &&
      this.isPastDeadline(owner)
    ) {
      await this.closeFromStoredAnswers(attemptId, { expired: true });
    }

    const attempt = await this.prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: {
        exam: {
          include: {
            certification: {
              include: {
                domains: true,
                provider: { select: { id: true, name: true, slug: true } },
              },
            },
            examQuestions: {
              orderBy: { sortOrder: 'asc' },
              include: {
                question: {
                  include: {
                    choices: { orderBy: { sortOrder: 'asc' } },
                    domain: true,
                    tags: { include: { tag: true } },
                  },
                },
              },
            },
          },
        },
        answers: true,
      },
    });
    if (!attempt) throw new NotFoundException('Attempt not found');

    if (attempt.status !== AttemptStatus.IN_PROGRESS) {
      return { attemptId, status: attempt.status };
    }

    const presentation = readPresentation(attempt.presentation);
    const cat = presentation?.cat;
    // An adaptive test only shows what it has given so far; the last one is
    // the current question.
    const shown = new Set(presentation?.questionIds ?? []);
    const questions = orderByIds(
      attempt.exam.examQuestions
        .map((eq) => eq.question)
        .filter((q) => !cat || shown.has(q.id)),
      presentation?.questionIds,
    ).map((q, index) =>
      this.toAttemptQuestion(
        {
          ...q,
          choices: orderByIds(q.choices, presentation?.choiceIds[q.id]),
        },
        index,
        attempt.exam.practiceMode === PracticeMode.FULL_MOCK || !!cat,
      ),
    );
    const questionsById = new Map(
      attempt.exam.examQuestions.map((eq) => [eq.question.id, eq.question]),
    );

    const checked: CheckAnswerResponse[] = attempt.answers
      .filter((a) => a.checkedAt && questionsById.has(a.questionId))
      .map((a) => {
        const q = questionsById.get(a.questionId)!;
        return {
          questionId: a.questionId,
          isCorrect: a.isCorrect === true,
          selectedChoiceIds: a.selectedChoices,
          correctChoiceIds: q.choices
            .filter((c) => c.isCorrect)
            .map((c) => c.id),
          explanation: q.explanation ?? null,
          checkedAt: a.checkedAt as Date,
        };
      });

    return {
      attemptId: attempt.id,
      status: attempt.status,
      examId: attempt.examId,
      title: attempt.exam.title,
      certification: attempt.exam.certification,
      timeLimit: effectiveTimeLimit(attempt.exam),
      timerMode: attempt.exam.timerMode,
      practiceMode: attempt.exam.practiceMode,
      feedbackMode: attempt.feedbackMode,
      totalQuestions: cat ? cat.maxItems : questions.length,
      startedAt: attempt.startedAt,
      expiresAt: this.deadlineOf(attempt),
      serverNow: new Date(),
      questions,
      ...(cat ? { cat: this.catProgress(cat, attempt.answers.length) } : {}),
      answers: attempt.answers.map((a) => ({
        questionId: a.questionId,
        selectedChoices: a.selectedChoices,
        isMarked: a.isMarked,
        timeSpent: a.timeSpent ?? 0,
      })),
      checked,
    };
  }

  /** Discard an in-progress attempt (the learner chose to start over). */
  async abandon(userId: string, attemptId: string) {
    const attempt = await this.prisma.examAttempt.findUnique({
      where: { id: attemptId },
      select: { userId: true, status: true },
    });
    if (!attempt) throw new NotFoundException('Attempt not found');
    if (attempt.userId !== userId)
      throw new ForbiddenException('Not your attempt');
    if (attempt.status !== AttemptStatus.IN_PROGRESS) {
      throw new BadRequestException('Attempt already submitted');
    }
    const { count } = await this.prisma.examAttempt.updateMany({
      where: { id: attemptId, status: AttemptStatus.IN_PROGRESS },
      data: { status: AttemptStatus.ABANDONED },
    });
    if (count === 0) throw new BadRequestException('Attempt already submitted');
    return { attemptId, status: AttemptStatus.ABANDONED };
  }

  private evaluateAnswers(
    attemptId: string,
    dto: SubmitAttemptDto,
    examQuestions: { question: QuestionWithChoices }[],
    lockedAnswers: Map<string, LockedAnswer> = new Map(),
  ) {
    const domainScores: Record<string, { correct: number; total: number }> = {};
    let totalCorrect = 0;
    const answerRecords: Prisma.AnswerCreateManyInput[] = [];
    const questionsById = new Map(
      examQuestions.map((eq) => [eq.question.id, eq.question]),
    );
    const gradedQuestionIds = new Set<string>();

    const gradeQuestion = (
      q: QuestionWithChoices,
      submitted: SubmitAnswerDto | undefined,
      questionOrder: number,
    ) => {
      const locked = lockedAnswers.get(q.id);
      const selectedChoices =
        locked?.selectedChoices ?? submitted?.selectedChoices ?? [];
      const correctChoiceIds = q.choices
        .filter((c) => c.isCorrect)
        .map((c) => c.id);

      const isCorrect = locked
        ? locked.isCorrect === true
        : isAnswerCorrect(correctChoiceIds, selectedChoices);

      if (isCorrect) totalCorrect++;

      const domainName = q.domain?.name ?? 'Unknown';
      if (!domainScores[domainName])
        domainScores[domainName] = { correct: 0, total: 0 };
      domainScores[domainName].total++;
      if (isCorrect) domainScores[domainName].correct++;

      answerRecords.push({
        attemptId,
        questionId: q.id,
        selectedChoices,
        isCorrect,
        isMarked: submitted?.isMarked ?? false,
        questionOrder,
        timeSpent: submitted?.timeSpent ?? null,
        ...(locked ? { checkedAt: locked.checkedAt } : {}),
      });
    };

    // Grade in the order the client submitted answers, which mirrors the
    // per-attempt randomized question order the user was actually shown
    // (see start()). This keeps the result review in the same order.
    // Duplicate questionIds in the payload are ignored (first one wins) so a
    // crafted request can't double-count a question toward totalCorrect.
    dto.answers.forEach((submitted, index) => {
      const q = questionsById.get(submitted.questionId);
      if (!q || gradedQuestionIds.has(q.id)) return;
      gradedQuestionIds.add(q.id);
      gradeQuestion(q, submitted, index);
    });

    // Defensively grade any exam question the client didn't submit an
    // answer for, so a partial payload can't silently drop questions.
    let nextOrder = dto.answers.length;
    for (const eq of examQuestions) {
      if (gradedQuestionIds.has(eq.question.id)) continue;
      gradeQuestion(eq.question, undefined, nextOrder++);
    }

    return { totalCorrect, domainScores, answerRecords };
  }

  async findResult(
    attemptId: string,
    userId: string,
  ): Promise<AttemptResultResponse> {
    const attempt = await this.prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: {
        exam: {
          include: {
            certification: {
              include: {
                provider: {
                  select: { id: true, name: true, slug: true },
                },
              },
            },
          },
        },
        answers: {
          orderBy: { questionOrder: 'asc' },
          include: {
            question: {
              include: {
                choices: { orderBy: { sortOrder: 'asc' } },
                domain: true,
              },
            },
          },
        },
      },
    });

    if (!attempt) throw new NotFoundException('Attempt not found');
    if (attempt.userId !== userId)
      throw new ForbiddenException('Not your attempt');

    // Show choices in the order and with the letters the learner saw during
    // the attempt (see start()); older attempts keep the stored labels.
    const presentation = readPresentation(attempt.presentation);
    const reviewChoices = (
      questionId: string,
      choices: {
        id: string;
        label: string;
        content: string;
        isCorrect: boolean;
      }[],
    ) => {
      const order = presentation?.choiceIds[questionId];
      if (!order) return choices;
      return orderByIds(choices, order).map((c, i) => ({
        ...c,
        label: String.fromCharCode(97 + i),
      }));
    };

    // Pace the learner needed to finish on time, for the time analysis.
    const totalQuestions =
      presentation?.cat?.maxItems ??
      attempt.totalQuestions ??
      attempt.answers.length;
    const targetSecondsPerQuestion =
      attempt.exam.timeLimit && totalQuestions > 0
        ? Math.round((effectiveTimeLimit(attempt.exam) * 60) / totalQuestions)
        : null;

    const questionResults: QuestionResultResponse[] = attempt.answers.map(
      (a) => ({
        answerId: a.id,
        questionId: a.questionId,
        title: a.question.title,
        description: a.question.description ?? undefined,
        codeSnippet: a.question.codeSnippet ?? undefined,
        imageUrl: a.question.imageUrl ?? undefined,
        explanation: a.question.explanation ?? undefined,
        domain: a.question.domain?.name ?? 'Unknown',
        correct: a.isCorrect ?? false,
        checkedAt: a.checkedAt ?? undefined,
        mistakeType: a.mistakeType ?? undefined,
        timeSpent: a.timeSpent ?? undefined,
        suggestedMistakeType: suggestMistakeType(
          a.isCorrect === true,
          a.selectedChoices.length > 0,
          a.timeSpent,
          targetSecondsPerQuestion,
        ),
        selectedAnswers: a.selectedChoices,
        correctAnswers: a.question.choices
          .filter((c) => c.isCorrect)
          .map((c) => c.id),
        choices: reviewChoices(
          a.questionId,
          a.question.choices.map((c) => ({
            id: c.id,
            label: c.label,
            content: c.content,
            isCorrect: c.isCorrect,
          })),
        ),
      }),
    );

    const passingScore = attempt.exam.certification?.passingScore ?? 70;

    // An adaptive test is judged by the ability it measured, not by its
    // percentage (it aims every question at the learner's level).
    const cat = presentation?.cat;
    const catResult = cat
      ? {
          ability: Math.round(cat.theta * 100) / 100,
          standardError: Math.round(cat.se * 100) / 100,
          itemsAdministered: attempt.answers.length,
          maxItems: cat.maxItems,
          stoppedBy: cat.stoppedBy ?? null,
          passLikelihood: Math.round(
            passProbability(
              cat.theta,
              cat.se,
              cat.pool.map((i) => i.b),
              Math.min(cat.pool.length, READINESS_EXAM_LENGTH),
              passingScore,
            ) * 100,
          ),
        }
      : null;

    return {
      attemptId: attempt.id,
      examId: attempt.examId,
      examTitle: attempt.exam.title,
      certification: attempt.exam.certification,
      status: attempt.status,
      feedbackMode: attempt.feedbackMode,
      score: Number(attempt.score ?? 0),
      totalCorrect: attempt.totalCorrect ?? 0,
      totalQuestions: attempt.totalQuestions ?? 0,
      percentage: Math.round(Number(attempt.score ?? 0)),
      targetSecondsPerQuestion,
      passingScore,
      passed: catResult
        ? catResult.passLikelihood >= 50
        : Number(attempt.score ?? 0) >= passingScore,
      ...(catResult ? { cat: catResult } : {}),
      domainScores: attempt.domainScores as Record<
        string,
        { correct: number; total: number }
      >,
      timeSpent: attempt.timeSpent ?? 0,
      startedAt: attempt.startedAt,
      submittedAt: attempt.submittedAt ?? undefined,
      questionResults,
    };
  }

  /**
   * What to do after an attempt: missed/flagged counts, the weakest domain,
   * the learner's recent per-domain trend on this certification and an
   * estimate of their chance to pass (see exams/ability.ts).
   */
  async insights(
    userId: string,
    attemptId: string,
  ): Promise<AttemptInsightsResponse> {
    const attempt = await this.prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: {
        exam: {
          select: {
            certificationId: true,
            certification: { select: { passingScore: true } },
          },
        },
        answers: {
          select: {
            isCorrect: true,
            isMarked: true,
            selectedChoices: true,
            question: {
              select: { domain: { select: { id: true, name: true } } },
            },
          },
        },
      },
    });
    if (!attempt) throw new NotFoundException('Attempt not found');
    if (attempt.userId !== userId)
      throw new ForbiddenException('Not your attempt');
    if (attempt.status !== AttemptStatus.SUBMITTED) {
      throw new BadRequestException('Attempt is not submitted');
    }
    const certificationId = attempt.exam.certificationId;

    const domains = new Map<
      string,
      { domainId: string; name: string; correct: number; total: number }
    >();
    for (const a of attempt.answers) {
      const d = a.question.domain;
      if (!d) continue;
      const entry = domains.get(d.id) ?? {
        domainId: d.id,
        name: d.name,
        correct: 0,
        total: 0,
      };
      entry.total++;
      if (a.isCorrect) entry.correct++;
      domains.set(d.id, entry);
    }
    const domainResults = [...domains.values()].map((d) => ({
      ...d,
      percentage: Math.round((d.correct / d.total) * 100),
    }));
    const weakest =
      [...domainResults].sort(
        (a, b) => a.percentage - b.percentage || b.total - a.total,
      )[0] ?? null;

    const [recent, ability, pool] = await Promise.all([
      this.prisma.examAttempt.findMany({
        where: {
          userId,
          status: AttemptStatus.SUBMITTED,
          exam: { certificationId },
        },
        orderBy: { submittedAt: 'desc' },
        take: AttemptsService.TREND_ATTEMPTS,
        select: {
          id: true,
          submittedAt: true,
          score: true,
          domainScores: true,
        },
      }),
      this.examsService.abilityFor(userId, certificationId),
      this.prisma.question.findMany({
        where: {
          certificationId,
          status: 'APPROVED',
          deletedAt: null,
        },
        select: { id: true, difficulty: true },
      }),
    ]);

    const passingScore = attempt.exam.certification?.passingScore ?? 70;
    const difficulty = await this.examsService.questionDifficulties(pool);
    const examLength = Math.min(pool.length, READINESS_EXAM_LENGTH);
    const passLikelihood =
      ability.answered > 0
        ? passProbability(
            ability.theta,
            ability.se,
            [...difficulty.values()],
            examLength,
            passingScore,
          )
        : null;

    return {
      attemptId,
      certificationId,
      missedCount: attempt.answers.filter((a) => a.isCorrect !== true).length,
      skippedCount: attempt.answers.filter(
        (a) => a.selectedChoices.length === 0,
      ).length,
      flaggedCount: attempt.answers.filter((a) => a.isMarked).length,
      domains: domainResults,
      weakestDomain: weakest && weakest.percentage < 100 ? weakest : null,
      trend: recent.reverse().map((r) => ({
        attemptId: r.id,
        submittedAt: r.submittedAt,
        score: Math.round(Number(r.score ?? 0)),
        domainScores: (r.domainScores ?? {}) as Record<
          string,
          { correct: number; total: number }
        >,
      })),
      readiness: {
        ability: Math.round(ability.theta * 100) / 100,
        standardError: Math.round(ability.se * 100) / 100,
        basedOnQuestions: ability.answered,
        passLikelihood:
          passLikelihood === null ? null : Math.round(passLikelihood * 100),
        passingScore,
        examLength,
      },
    };
  }

  /** Submitted attempts shown in the per-domain trend. */
  static readonly TREND_ATTEMPTS = 5;

  /**
   * Put the wrong and skipped questions of an attempt into the learner's
   * spaced-repetition queue (due now). Existing schedules are reset as a
   * lapse instead of being duplicated.
   */
  async addMissedToReview(userId: string, attemptId: string) {
    const attempt = await this.prisma.examAttempt.findUnique({
      where: { id: attemptId },
      select: {
        userId: true,
        status: true,
        answers: { select: { questionId: true, isCorrect: true } },
      },
    });
    if (!attempt) throw new NotFoundException('Attempt not found');
    if (attempt.userId !== userId)
      throw new ForbiddenException('Not your attempt');
    if (attempt.status !== AttemptStatus.SUBMITTED) {
      throw new BadRequestException('Attempt is not submitted');
    }

    const missed = attempt.answers
      .filter((a) => a.isCorrect !== true)
      .map((a) => a.questionId);
    const now = new Date();
    await this.prisma.$transaction(
      missed.map((questionId) =>
        this.prisma.reviewSchedule.upsert({
          where: { userId_questionId: { userId, questionId } },
          create: { userId, questionId, nextReviewDate: now },
          update: {
            nextReviewDate: now,
            intervalDays: 0,
            repetitions: 0,
            lapses: { increment: 1 },
          },
        }),
      ),
    );
    return { added: missed.length };
  }

  async findMyAttempts(userId: string, page = 1, limit = 10) {
    await this.closeExpiredAttempts(userId);
    const skip = (page - 1) * limit;
    const where = { userId };

    const [total, attempts] = await Promise.all([
      this.prisma.examAttempt.count({ where }),
      this.prisma.examAttempt.findMany({
        where,
        include: {
          exam: {
            include: {
              certification: {
                include: {
                  provider: {
                    select: { id: true, name: true, slug: true },
                  },
                },
              },
            },
          },
        },
        orderBy: { startedAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return {
      data: attempts.map((a) => ({
        id: a.id,
        examId: a.examId,
        examTitle: a.exam.title,
        certification: a.exam.certification,
        score: Number(a.score ?? 0),
        totalCorrect: a.totalCorrect,
        totalQuestions: a.totalQuestions,
        status: a.status,
        feedbackMode: a.feedbackMode,
        timeSpent: a.timeSpent,
        startedAt: a.startedAt,
        submittedAt: a.submittedAt,
      })),
      meta: { total, page, limit, lastPage: Math.ceil(total / limit) },
    };
  }
}
