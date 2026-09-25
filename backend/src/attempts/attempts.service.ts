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

interface QuestionWithChoices extends Prisma.QuestionGetPayload<{
  include: { choices: true; domain: true };
}> {}

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

    // Time Pressure simulates the real exam, so answers stay hidden until the end.
    if (
      feedbackMode === FeedbackMode.INTERACTIVE &&
      exam.timerMode === TimerMode.TIME_PRESSURE
    ) {
      throw new BadRequestException(
        'Interactive mode is not available for Time Pressure exams',
      );
    }

    const attempt = await this.prisma.examAttempt.create({
      data: {
        userId,
        examId,
        totalQuestions: exam.examQuestions.length,
        feedbackMode,
      },
    });

    // Randomize question order
    const shuffledQuestions = this.shuffle(exam.examQuestions);

    // Return questions WITHOUT isCorrect
    const questions = shuffledQuestions.map((eq, index) => {
      const q = eq.question;
      // Randomize choice order, then relabel positionally (a, b, c, d...) so
      // the displayed letters always read in order top-to-bottom regardless
      // of how the underlying choices were shuffled. Grading is keyed on
      // choice.id, never on label, so this is purely cosmetic.
      const shuffledChoices = this.shuffle(q.choices).map((c, i) => ({
        id: c.id,
        label: String.fromCharCode(97 + i),
        content: c.content,
      }));

      return {
        id: q.id,
        title: q.title,
        description: q.description,
        questionType: q.questionType,
        difficulty: q.difficulty,
        domain: q.domain,
        tags: q.tags.map((t) => t.tag.name),
        choices: shuffledChoices,
        sortOrder: index,
      };
    });

    return {
      attemptId: attempt.id,
      examId: exam.id,
      title: exam.title,
      certification: exam.certification,
      timeLimit: exam.timeLimit,
      timerMode: exam.timerMode,
      feedbackMode: attempt.feedbackMode ?? feedbackMode,
      totalQuestions: questions.length,
      questions,
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

  async saveAnswer(userId: string, attemptId: string, dto: SubmitAnswerDto) {
    const attempt = await this.prisma.examAttempt.findUnique({
      where: { id: attemptId },
    });
    if (!attempt) throw new NotFoundException('Attempt not found');
    if (attempt.userId !== userId)
      throw new ForbiddenException('Not your attempt');
    if (attempt.status !== AttemptStatus.IN_PROGRESS) {
      throw new BadRequestException('Attempt already submitted');
    }

    const question = await this.prisma.question.findUnique({
      where: { id: dto.questionId },
      include: { choices: true },
    });

    if (!question) throw new NotFoundException('Question not found');

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

    // Stamp new answers with their position in the save sequence, which
    // mirrors presentation order in the practice-mode flow (saveAnswer is
    // called once per question, in the order the user was shown them).
    // Existing answers keep their original order on update.
    const questionOrder = existing
      ? undefined
      : await this.prisma.answer.count({ where: { attemptId } });

    return this.prisma.answer.upsert({
      where: { id: existing?.id ?? '' },
      create: {
        attemptId,
        questionId: dto.questionId,
        selectedChoices: dto.selectedChoices,
        isCorrect,
        isMarked: dto.isMarked ?? false,
        questionOrder: questionOrder ?? 0,
      },
      update: {
        selectedChoices: dto.selectedChoices,
        isCorrect,
        isMarked: dto.isMarked ?? false,
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
    });
    if (!attempt) throw new NotFoundException('Attempt not found');
    if (attempt.userId !== userId)
      throw new ForbiddenException('Not your attempt');
    if (attempt.status !== AttemptStatus.IN_PROGRESS) {
      throw new BadRequestException('Attempt already submitted');
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
        select: { id: true, checkedAt: true },
      });
      if (existing?.checkedAt) {
        throw new ConflictException('Answer already checked');
      }

      if (existing) {
        await tx.answer.update({
          where: { id: existing.id },
          data: {
            selectedChoices,
            isCorrect,
            isMarked: dto.isMarked ?? false,
            checkedAt,
          },
        });
      } else {
        const questionOrder = await tx.answer.count({ where: { attemptId } });
        await tx.answer.create({
          data: {
            attemptId,
            questionId: dto.questionId,
            selectedChoices,
            isCorrect,
            isMarked: dto.isMarked ?? false,
            questionOrder,
            checkedAt,
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

    // Answers revealed in INTERACTIVE mode are final: grade them from what
    // was stored at check time, never from the submit payload.
    const lockedAnswers = new Map<string, LockedAnswer>();
    if (attempt.feedbackMode === FeedbackMode.INTERACTIVE) {
      const checked = await this.prisma.answer.findMany({
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

    const { totalCorrect, domainScores, answerRecords } = this.evaluateAnswers(
      attemptId,
      dto,
      examQuestions,
      lockedAnswers,
    );

    const totalQuestions = examQuestions.length;
    const score =
      totalQuestions > 0 ? (totalCorrect / totalQuestions) * 100 : 0;
    const timeSpent = Math.floor(
      (Date.now() - attempt.startedAt.getTime()) / 1000,
    );

    // Transaction: save answers + update attempt + update exam stats
    await this.prisma.$transaction([
      // Delete any previously saved answers for this attempt
      this.prisma.answer.deleteMany({ where: { attemptId } }),
      // Create all answer records
      this.prisma.answer.createMany({ data: answerRecords }),
      // Update attempt
      this.prisma.examAttempt.update({
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
      }),
      // Increment exam attempt count
      this.prisma.exam.update({
        where: { id: attempt.examId },
        data: { attemptCount: { increment: 1 } },
      }),
    ]);

    await this.gamification.awardPoints(userId, POINTS.COMPLETE_EXAM);
    await this.examsService.updateAvgScore(attempt.examId);

    return this.findResult(attemptId);
  }

  async finish(
    userId: string,
    attemptId: string,
  ): Promise<AttemptResultResponse> {
    const attempt = await this.prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: {
        exam: {
          include: {
            examQuestions: {
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
        },
        answers: true,
      },
    });

    if (!attempt) throw new NotFoundException('Attempt not found');
    if (attempt.userId !== userId)
      throw new ForbiddenException('Not your attempt');
    if (attempt.status !== AttemptStatus.IN_PROGRESS) {
      throw new BadRequestException('Attempt already submitted');
    }

    const examQuestions = attempt.exam.examQuestions;
    let totalCorrect = 0;
    const domainScores: Record<string, { correct: number; total: number }> = {};

    for (const eq of examQuestions) {
      const q = eq.question;
      const answer = attempt.answers.find((a) => a.questionId === q.id);
      const isCorrect = answer?.isCorrect ?? false;

      if (isCorrect) totalCorrect++;

      const domainName = q.domain?.name ?? 'Unknown';
      if (!domainScores[domainName])
        domainScores[domainName] = { correct: 0, total: 0 };
      domainScores[domainName].total++;
      if (isCorrect) domainScores[domainName].correct++;
    }

    const totalQuestions = examQuestions.length;
    const score =
      totalQuestions > 0 ? (totalCorrect / totalQuestions) * 100 : 0;
    const timeSpent = Math.floor(
      (Date.now() - attempt.startedAt.getTime()) / 1000,
    );

    await this.prisma.$transaction([
      this.prisma.examAttempt.update({
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
      }),
      this.prisma.exam.update({
        where: { id: attempt.examId },
        data: { attemptCount: { increment: 1 } },
      }),
    ]);

    await this.gamification.awardPoints(userId, POINTS.COMPLETE_EXAM);
    await this.examsService.updateAvgScore(attempt.examId);

    return this.findResult(attemptId);
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

  async findResult(attemptId: string): Promise<AttemptResultResponse> {
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

    const questionResults: QuestionResultResponse[] = attempt.answers.map(
      (a) => ({
        answerId: a.id,
        questionId: a.questionId,
        title: a.question.title,
        description: a.question.description ?? undefined,
        explanation: a.question.explanation ?? undefined,
        domain: a.question.domain?.name ?? 'Unknown',
        correct: a.isCorrect ?? false,
        checkedAt: a.checkedAt ?? undefined,
        mistakeType: a.mistakeType ?? undefined,
        selectedAnswers: a.selectedChoices,
        correctAnswers: a.question.choices
          .filter((c) => c.isCorrect)
          .map((c) => c.id),
        choices: a.question.choices.map((c) => ({
          id: c.id,
          label: c.label,
          content: c.content,
          isCorrect: c.isCorrect,
        })),
      }),
    );

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

  async findMyAttempts(userId: string, page = 1, limit = 10) {
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
