import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateExamDto } from './dto/create-exam.dto';
import { UpdateExamDto } from './dto/update-exam.dto';
import { BlueprintDto } from './dto/blueprint.dto';
import { CreatePracticeExamDto } from './dto/create-practice-exam.dto';
import { QuestionHistory, selectPracticeQuestions } from './practice-selection';
import {
  ADAPTIVE_TARGET_P,
  estimateAbility,
  pCorrect,
  questionDifficulty,
} from './ability';
import {
  AttemptStatus,
  ExamVisibility,
  PracticeMode,
  QuestionStatus,
  TimerMode,
  UserRole,
  Difficulty,
  Prisma,
} from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class ExamsService {
  /** Upper bound on distinct domain buckets in a single blueprint (limits query fan-out). */
  private static readonly MAX_BLUEPRINT_BUCKETS = 50;
  /** Upper bound on questions requested per bucket (matches the 200-question exam cap). */
  private static readonly MAX_BLUEPRINT_BUCKET_COUNT = 200;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resolve a blueprint into a concrete list of question IDs.
   * Throws UnprocessableEntityException (422) with `shortages` detail if any
   * bucket cannot be filled from the approved question pool.
   */
  private async resolveBlueprint(
    certificationId: string,
    blueprint: BlueprintDto,
  ): Promise<string[]> {
    // A blueprint declares quotas along exactly one axis:
    //   - byDifficulty: each question has exactly one difficulty value.
    //   - byDomain:     each question belongs to at most one domain.
    // Either axis yields mutually-exclusive buckets, so bucket queries can run
    // in parallel with no risk of cross-bucket duplicates.
    const difficultyEntries = (
      Object.entries(blueprint.byDifficulty ?? {}) as [
        Difficulty,
        number | undefined,
      ][]
    ).filter(([, count]) => count && count > 0);

    const domainEntries = Object.entries(blueprint.byDomain ?? {}).filter(
      ([, count]) => typeof count === 'number' && count > 0,
    );

    const hasDifficulty = difficultyEntries.length > 0;
    const hasDomain = domainEntries.length > 0;

    if (hasDifficulty && hasDomain) {
      throw new BadRequestException(
        'Blueprint cannot mix difficulty and domain quotas — choose a single axis',
      );
    }
    if (!hasDifficulty && !hasDomain) {
      throw new BadRequestException(
        'Blueprint has no valid buckets (all counts are 0)',
      );
    }

    let buckets: { label: string; count: number; where: Prisma.QuestionWhereInput }[];

    if (hasDomain) {
      // byDomain is a free-form Record, so it needs explicit bounds the typed
      // byDifficulty axis gets for free. Cap the number of buckets to avoid
      // firing an unbounded fan-out of parallel queries, and bound each count
      // so a single quota can't request an absurd slice.
      if (domainEntries.length > ExamsService.MAX_BLUEPRINT_BUCKETS) {
        throw new BadRequestException(
          `Blueprint cannot declare more than ${ExamsService.MAX_BLUEPRINT_BUCKETS} domains`,
        );
      }
      for (const [, count] of domainEntries) {
        if (!Number.isInteger(count) || count < 0) {
          throw new BadRequestException(
            'Blueprint domain quotas must be non-negative integers',
          );
        }
        if (count > ExamsService.MAX_BLUEPRINT_BUCKET_COUNT) {
          throw new BadRequestException(
            `Blueprint domain quota cannot exceed ${ExamsService.MAX_BLUEPRINT_BUCKET_COUNT} questions`,
          );
        }
      }
      buckets = domainEntries.map(([domainId, count]) => ({
        label: `domain:${domainId}`,
        count,
        where: {
          certificationId,
          status: QuestionStatus.APPROVED,
          deletedAt: null,
          domainId,
        },
      }));
    } else {
      buckets = difficultyEntries.map(([difficulty, count]) => ({
        label: difficulty,
        count: count!,
        where: {
          certificationId,
          status: QuestionStatus.APPROVED,
          deletedAt: null,
          difficulty,
        },
      }));
    }

    return this.resolveBuckets(buckets);
  }

  /**
   * Fill a set of mutually-exclusive buckets from the approved question pool.
   * Each bucket is shuffled (Fisher-Yates) and sliced to its quota; picks are
   * then re-shuffled together. Throws 422 with per-bucket `shortages` detail if
   * any bucket cannot be filled.
   */
  private async resolveBuckets(
    buckets: { label: string; count: number; where: Prisma.QuestionWhereInput }[],
  ): Promise<string[]> {
    const bucketResults = await Promise.all(
      buckets.map(async (bucket) => {
        const candidates = await this.prisma.question.findMany({
          where: bucket.where,
          select: { id: true },
        });
        return { ...bucket, candidates };
      }),
    );

    const shortages: {
      bucket: string;
      required: number;
      available: number;
      missing: number;
    }[] = [];

    const pickedIds: string[] = [];

    for (const { label, count, candidates } of bucketResults) {
      if (candidates.length < count) {
        shortages.push({
          bucket: label,
          required: count,
          available: candidates.length,
          missing: count - candidates.length,
        });
      } else {
        // Fisher-Yates shuffle then slice.
        for (let i = candidates.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
        }
        pickedIds.push(...candidates.slice(0, count).map((q) => q.id));
      }
    }

    if (shortages.length > 0) {
      throw new UnprocessableEntityException({
        error: 'BLUEPRINT_INSUFFICIENT_QUESTIONS',
        message:
          'The question bank does not have enough questions to build an exam with the selected blueprint',
        shortages,
      });
    }

    // Final shuffle to mix buckets together.
    for (let i = pickedIds.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pickedIds[i], pickedIds[j]] = [pickedIds[j], pickedIds[i]];
    }

    return pickedIds;
  }

  async create(userId: string, dto: CreateExamDto) {
    let questionIds: string[];

    if (dto.selectionStrategy === 'BLUEPRINT' && dto.blueprint) {
      // Blueprint mode: resolve quota → concrete IDs.
      questionIds = await this.resolveBlueprint(
        dto.certificationId,
        dto.blueprint,
      );
    } else if (dto.questionIds && dto.questionIds.length > 0) {
      // Manual (pick) mode: use the provided list as-is.
      questionIds = dto.questionIds;
    } else {
      // Random mode: shuffle all approved, non-deleted questions and slice.
      // Fisher-Yates: sort(() => Math.random() - 0.5) is biased.
      const questions = await this.prisma.question.findMany({
        where: {
          certificationId: dto.certificationId,
          status: QuestionStatus.APPROVED,
          deletedAt: null,
        },
        select: { id: true },
      });
      for (let i = questions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [questions[i], questions[j]] = [questions[j], questions[i]];
      }
      questionIds = questions.slice(0, dto.questionCount).map((q) => q.id);
    }

    const shareCode =
      dto.visibility === ExamVisibility.LINK
        ? uuidv4().replace(/-/g, '').slice(0, 12)
        : undefined;

    return this.prisma.exam.create({
      data: {
        title: dto.title,
        description: dto.description,
        certificationId: dto.certificationId,
        createdBy: userId,
        questionCount: questionIds.length,
        timeLimit: dto.timeLimit,
        visibility: dto.visibility ?? ExamVisibility.PUBLIC,
        timerMode: dto.timerMode,
        shareCode,
        examQuestions: {
          create: questionIds.map((qId, index) => ({
            questionId: qId,
            sortOrder: index,
          })),
        },
      },
      include: {
        certification: true,
        examQuestions: { include: { question: true } },
      },
    });
  }

  /**
   * A fresh practice draw for one learner: follows the certification's domain
   * weights and favours questions they haven't seen or got wrong (see
   * practice-selection.ts). The exam is PRIVATE and flagged isPractice so it
   * never shows up in the public library or "My exams".
   *
   * Modes: QUICK_DRILL narrows the pool to domains/difficulties, REVIEW only
   * uses questions the learner missed or flagged (optionally from one
   * attempt), ADAPTIVE picks questions near their estimated level, FULL_MOCK
   * is a standard draw taken under real-exam conditions (see start()).
   */
  async createPractice(userId: string, dto: CreatePracticeExamDto) {
    const mode = dto.mode ?? PracticeMode.STANDARD;
    const certification = await this.prisma.certification.findUnique({
      where: { id: dto.certificationId },
      include: { domains: { select: { id: true, weight: true } } },
    });
    if (!certification) throw new NotFoundException('Certification not found');

    const narrowToDomains =
      (mode === PracticeMode.QUICK_DRILL || mode === PracticeMode.REVIEW) &&
      dto.domainIds?.length;
    const [pool, history] = await Promise.all([
      this.prisma.question.findMany({
        where: {
          certificationId: dto.certificationId,
          status: QuestionStatus.APPROVED,
          deletedAt: null,
          ...(narrowToDomains ? { domainId: { in: dto.domainIds } } : {}),
          ...(mode === PracticeMode.QUICK_DRILL && dto.difficulties?.length
            ? { difficulty: { in: dto.difficulties } }
            : {}),
        },
        select: { id: true, domainId: true, difficulty: true },
      }),
      this.questionHistory(userId, dto.certificationId),
    ]);

    let candidates = pool;
    let selectionHistory = history;
    let adaptiveRank: Map<string, number> | undefined;

    if (mode === PracticeMode.REVIEW) {
      const toReview = dto.sourceAttemptId
        ? await this.missedInAttempt(userId, dto.sourceAttemptId)
        : new Set(
            [...history.entries()]
              .filter(([, h]) => !h.lastCorrect || h.flagged)
              .map(([id]) => id),
          );
      candidates = pool.filter((q) => toReview.has(q.id));
      if (candidates.length === 0) {
        throw new UnprocessableEntityException(
          'Nothing to review yet: no missed or flagged questions',
        );
      }
      // Recent mistakes are exactly what a review is for.
      selectionHistory = new Map();
    } else if (mode === PracticeMode.ADAPTIVE) {
      const { theta } = await this.abilityFor(userId, dto.certificationId);
      const difficulty = await this.questionDifficulties(pool);
      adaptiveRank = new Map(
        pool.map((q) => [
          q.id,
          Math.abs(pCorrect(theta, difficulty.get(q.id)!) - ADAPTIVE_TARGET_P),
        ]),
      );
    }

    if (candidates.length === 0) {
      throw new UnprocessableEntityException(
        'No approved questions match this practice setup',
      );
    }

    const questionIds = selectPracticeQuestions(
      candidates,
      certification.domains.map((d) => ({
        id: d.id,
        weight: d.weight === null ? null : Number(d.weight),
      })),
      selectionHistory,
      dto.questionCount,
      Math.random,
      adaptiveRank,
    );

    return this.prisma.exam.create({
      data: {
        title: `${certification.code} ${ExamsService.PRACTICE_TITLES[mode](dto.timerMode)}`,
        certificationId: dto.certificationId,
        createdBy: userId,
        questionCount: questionIds.length,
        timeLimit: dto.timeLimit,
        visibility: ExamVisibility.PRIVATE,
        isPractice: true,
        practiceMode: mode,
        timerMode: dto.timerMode,
        examQuestions: {
          create: questionIds.map((questionId, index) => ({
            questionId,
            sortOrder: index,
          })),
        },
      },
      select: {
        id: true,
        questionCount: true,
        timeLimit: true,
        practiceMode: true,
      },
    });
  }

  private static readonly PRACTICE_TITLES: Record<
    PracticeMode,
    (timerMode?: TimerMode) => string
  > = {
    STANDARD: (t) =>
      t === TimerMode.TIME_PRESSURE ? 'Time Pressure Exam' : 'Practice Exam',
    QUICK_DRILL: () => 'Quick Drill',
    FULL_MOCK: () => 'Full Mock Exam',
    REVIEW: () => 'Mistake Review',
    ADAPTIVE: () => 'Adaptive Practice',
  };

  /** Wrong, skipped and flagged questions of one of the learner's submitted attempts. */
  private async missedInAttempt(
    userId: string,
    attemptId: string,
  ): Promise<Set<string>> {
    const attempt = await this.prisma.examAttempt.findUnique({
      where: { id: attemptId },
      select: {
        userId: true,
        status: true,
        answers: {
          select: { questionId: true, isCorrect: true, isMarked: true },
        },
      },
    });
    if (
      !attempt ||
      attempt.userId !== userId ||
      attempt.status !== AttemptStatus.SUBMITTED
    ) {
      throw new NotFoundException('Attempt not found');
    }
    return new Set(
      attempt.answers
        .filter((a) => a.isCorrect !== true || a.isMarked)
        .map((a) => a.questionId),
    );
  }

  /**
   * Difficulty (logit scale) of each question from its label and how all
   * learners did on it in submitted attempts.
   */
  async questionDifficulties(
    questions: { id: string; difficulty: Difficulty | null }[],
  ): Promise<Map<string, number>> {
    const stats = questions.length
      ? await this.prisma.answer.groupBy({
          by: ['questionId', 'isCorrect'],
          where: {
            questionId: { in: questions.map((q) => q.id) },
            attempt: { status: AttemptStatus.SUBMITTED },
          },
          _count: { _all: true },
        })
      : [];
    const counts = new Map<string, { attempts: number; correct: number }>();
    for (const row of stats) {
      const c = counts.get(row.questionId) ?? { attempts: 0, correct: 0 };
      c.attempts += row._count._all;
      if (row.isCorrect) c.correct += row._count._all;
      counts.set(row.questionId, c);
    }
    return new Map(
      questions.map((q) => {
        const c = counts.get(q.id);
        return [
          q.id,
          questionDifficulty(q.difficulty, c?.attempts, c?.correct),
        ];
      }),
    );
  }

  /**
   * The learner's ability on this certification from their latest answer to
   * each question (Rasch MAP estimate with standard error).
   */
  async abilityFor(
    userId: string,
    certificationId: string,
  ): Promise<{ theta: number; se: number; answered: number }> {
    const history = await this.questionHistory(userId, certificationId);
    if (history.size === 0) return { theta: 0, se: 1, answered: 0 };
    const questions = await this.prisma.question.findMany({
      where: { id: { in: [...history.keys()] } },
      select: { id: true, difficulty: true },
    });
    const difficulty = await this.questionDifficulties(questions);
    const { theta, se } = estimateAbility(
      questions.map((q) => ({
        b: difficulty.get(q.id)!,
        correct: history.get(q.id)!.lastCorrect,
      })),
    );
    return { theta, se, answered: questions.length };
  }

  /** Number of the learner's latest attempts whose questions count as "recent". */
  static readonly RECENT_ATTEMPTS = 2;

  /**
   * The learner's last result per question of this certification, from
   * submitted attempts, which questions came up in their latest attempts, and
   * which they flagged last time they saw them.
   */
  private async questionHistory(
    userId: string,
    certificationId: string,
  ): Promise<Map<string, QuestionHistory & { flagged: boolean }>> {
    const attempts = await this.prisma.examAttempt.findMany({
      where: {
        userId,
        status: AttemptStatus.SUBMITTED,
        exam: { certificationId },
      },
      orderBy: { submittedAt: 'desc' },
      select: {
        id: true,
        answers: {
          select: { questionId: true, isCorrect: true, isMarked: true },
        },
      },
    });

    const history = new Map<string, QuestionHistory & { flagged: boolean }>();
    attempts.forEach((attempt, index) => {
      const recent = index < ExamsService.RECENT_ATTEMPTS;
      for (const a of attempt.answers) {
        // Attempts are newest first: the first result seen is the latest.
        const known = history.get(a.questionId);
        if (known) {
          known.recent ||= recent;
        } else {
          history.set(a.questionId, {
            lastCorrect: a.isCorrect === true,
            recent,
            flagged: a.isMarked === true,
          });
        }
      }
    });
    return history;
  }

  async findAll(
    certificationId?: string,
    page = 1,
    limit = 10,
    sort: 'latest' | 'popular' = 'latest',
  ) {
    const skip = (page - 1) * limit;
    const where: any = { visibility: ExamVisibility.PUBLIC, deletedAt: null };
    if (certificationId) where.certificationId = certificationId;

    const orderBy =
      sort === 'popular'
        ? { attemptCount: 'desc' as const }
        : { createdAt: 'desc' as const };

    const [total, exams] = await Promise.all([
      this.prisma.exam.count({ where }),
      this.prisma.exam.findMany({
        where,
        include: {
          certification: {
            select: { id: true, name: true, code: true, provider: true },
          },
          author: { select: { id: true, displayName: true } },
        },
        orderBy,
        skip,
        take: limit,
      }),
    ]);

    return {
      data: exams,
      meta: { total, page, lastPage: Math.ceil(total / limit) },
    };
  }

  async findMyExams(userId: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    const where = { createdBy: userId, deletedAt: null, isPractice: false };

    const [total, exams] = await Promise.all([
      this.prisma.exam.count({ where }),
      this.prisma.exam.findMany({
        where,
        include: {
          certification: {
            select: { id: true, name: true, code: true, provider: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return {
      data: exams,
      meta: { total, page, lastPage: Math.ceil(total / limit) },
    };
  }

  async updateAvgScore(examId: string) {
    const result = await this.prisma.examAttempt.aggregate({
      where: { examId, status: 'SUBMITTED' },
      _avg: { score: true },
    });
    await this.prisma.exam.update({
      where: { id: examId },
      data: { avgScore: result._avg.score ?? 0 },
    });
  }

  /**
   * Strips answer-revealing fields (`choice.isCorrect`, `question.explanation`)
   * from an exam before returning it over public, unauthenticated endpoints so
   * that anyone with a link cannot read the answer key without taking the exam.
   * The grading flow lives in AttemptsService and reads `isCorrect` directly, so
   * it is unaffected by this sanitization.
   */
  private stripAnswerKey<
    C extends { isCorrect: boolean },
    Q extends { explanation: string | null; choices: C[] },
    EQ extends { question: Q },
    E extends { examQuestions: EQ[] },
  >(exam: E) {
    return {
      ...exam,
      examQuestions: exam.examQuestions.map((eq) => {
        const { explanation: _explanation, choices, ...question } = eq.question;
        return {
          ...eq,
          question: {
            ...question,
            choices: choices.map(
              ({ isCorrect: _isCorrect, ...choice }) => choice,
            ),
          },
        };
      }),
    };
  }

  async findOne(id: string) {
    const exam = await this.prisma.exam.findUnique({
      where: { id },
      include: {
        certification: { include: { domains: true } },
        author: { select: { id: true, displayName: true } },
        examQuestions: {
          orderBy: { sortOrder: 'asc' },
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

    if (!exam || exam.deletedAt)
      throw new NotFoundException(`Exam with ID ${id} not found`);
    return this.stripAnswerKey(exam);
  }

  async findByShareCode(shareCode: string) {
    const exam = await this.prisma.exam.findUnique({
      where: { shareCode },
      include: {
        certification: { include: { domains: true } },
        examQuestions: {
          orderBy: { sortOrder: 'asc' },
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

    if (!exam || exam.deletedAt) throw new NotFoundException('Exam not found');
    return this.stripAnswerKey(exam);
  }

  async update(userId: string, id: string, dto: UpdateExamDto) {
    const exam = await this.prisma.exam.findUnique({ where: { id } });
    if (!exam || exam.deletedAt)
      throw new NotFoundException(`Exam with ID ${id} not found`);
    if (exam.createdBy !== userId)
      throw new ForbiddenException('You can only update your own exams');

    const { questionIds: rawQuestionIds, selectionStrategy, blueprint, ...scalarData } = dto;

    let questionIds = rawQuestionIds;

    // Blueprint mode on update: resolve quota into IDs for this exam's cert.
    if (selectionStrategy === 'BLUEPRINT' && blueprint) {
      questionIds = await this.resolveBlueprint(exam.certificationId, blueprint);
    }

    // Metadata-only update: no question set change.
    if (!questionIds) {
      return this.prisma.exam.update({
        where: { id },
        data: scalarData,
        include: { certification: true },
      });
    }

    // Every question must exist and belong to this exam's certification so the
    // exam cannot be stuffed with questions from an unrelated certification.
    // (Blueprint-resolved IDs are already scoped to certificationId, but we
    //  still validate MANUAL/PICK questionIds for safety.)
    if (selectionStrategy !== 'BLUEPRINT') {
      const validQuestions = await this.prisma.question.findMany({
        where: { id: { in: questionIds }, certificationId: exam.certificationId },
        select: { id: true },
      });
      if (validQuestions.length !== questionIds.length) {
        throw new BadRequestException(
          "One or more questions are invalid or do not belong to this exam's certification",
        );
      }
    }

    // Replace the full ordered question set and recompute questionCount.
    return this.prisma.$transaction(async (tx) => {
      await tx.examQuestion.deleteMany({ where: { examId: id } });
      await tx.examQuestion.createMany({
        data: questionIds.map((questionId, index) => ({
          examId: id,
          questionId,
          sortOrder: index,
        })),
      });
      return tx.exam.update({
        where: { id },
        data: { ...scalarData, questionCount: questionIds.length },
        include: { certification: true },
      });
    });
  }

  async remove(userId: string, userRole: UserRole, id: string) {
    const exam = await this.prisma.exam.findUnique({ where: { id } });
    if (!exam || exam.deletedAt)
      throw new NotFoundException(`Exam with ID ${id} not found`);
    if (exam.createdBy !== userId && userRole !== UserRole.ADMIN) {
      throw new ForbiddenException('You can only delete your own exams');
    }

    // ExamAttempt -> Exam is ON DELETE RESTRICT, and attempts feed other
    // users' history and analytics, so exams that have been taken are
    // soft-deleted. Only never-attempted exams are removed outright.
    const attemptCount = await this.prisma.examAttempt.count({
      where: { examId: id },
    });
    if (attemptCount > 0) {
      await this.prisma.exam.update({
        where: { id },
        data: { deletedAt: new Date(), shareCode: null },
      });
    } else {
      await this.prisma.exam.delete({ where: { id } });
    }
    return { deleted: true };
  }
}
