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
import {
  ExamVisibility,
  QuestionStatus,
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
      // Random mode: shuffle all approved questions and slice.
      const questions = await this.prisma.question.findMany({
        where: {
          certificationId: dto.certificationId,
          status: QuestionStatus.APPROVED,
        },
        select: { id: true },
        orderBy: { createdAt: 'desc' },
      });

      const shuffled = questions.sort(() => Math.random() - 0.5);
      questionIds = shuffled.slice(0, dto.questionCount).map((q) => q.id);
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

  async findAll(
    certificationId?: string,
    page = 1,
    limit = 10,
    sort: 'latest' | 'popular' = 'latest',
  ) {
    const skip = (page - 1) * limit;
    const where: any = { visibility: ExamVisibility.PUBLIC };
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
    const where = { createdBy: userId };

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

    if (!exam) throw new NotFoundException(`Exam with ID ${id} not found`);
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

    if (!exam) throw new NotFoundException('Exam not found');
    return this.stripAnswerKey(exam);
  }

  async update(userId: string, id: string, dto: UpdateExamDto) {
    const exam = await this.prisma.exam.findUnique({ where: { id } });
    if (!exam) throw new NotFoundException(`Exam with ID ${id} not found`);
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
    if (!exam) throw new NotFoundException(`Exam with ID ${id} not found`);
    if (exam.createdBy !== userId && userRole !== UserRole.ADMIN) {
      throw new ForbiddenException('You can only delete your own exams');
    }

    await this.prisma.exam.delete({ where: { id } });
    return { deleted: true };
  }
}
