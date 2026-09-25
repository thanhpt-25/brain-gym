import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateQuestionDto } from './dto/create-question.dto';
import { AdminUpdateQuestionDto } from './dto/admin-update-question.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';
import {
  QuestionStatus,
  VoteTargetType,
  UserRole,
  AttemptStatus,
  ReportStatus,
  QuestionType,
} from '@prisma/client';
import {
  GamificationService,
  POINTS,
} from '../gamification/gamification.service';
import { KnowledgeGraphService } from '../knowledge-graph/knowledge-graph.service';

// US-1103: debounce window before enqueuing overlap recompute (ms)
const RECOMPUTE_DEBOUNCE_MS = parseInt(
  process.env.KG_RECOMPUTE_DEBOUNCE_MS ?? '5000',
  10,
);

/** Roles allowed to edit questions authored by someone else. */
const EDIT_ANY_ROLES: UserRole[] = [
  UserRole.ADMIN,
  UserRole.REVIEWER,
  UserRole.CONTRIBUTOR,
];

export function canEditAnyQuestion(role?: UserRole): boolean {
  return !!role && EDIT_ANY_ROLES.includes(role);
}

@Injectable()
export class QuestionsService {
  private readonly logger = new Logger(QuestionsService.name);
  private readonly recomputeDebounce = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly gamification: GamificationService,
    private readonly kg: KnowledgeGraphService,
  ) {}

  async findAll(
    certificationId?: string,
    status?: string,
    page: number = 1,
    limit: number = 10,
    userId?: string,
    isTrapQuestion?: boolean,
  ) {
    const skip = (page - 1) * limit;

    const where: any = { deletedAt: null };
    if (certificationId) where.certificationId = certificationId;
    if (isTrapQuestion !== undefined) where.isTrapQuestion = isTrapQuestion;
    where.status = (status as QuestionStatus) || QuestionStatus.APPROVED;

    const [total, questions] = await Promise.all([
      this.prisma.question.count({ where }),
      this.prisma.question.findMany({
        where,
        include: {
          author: {
            select: { id: true, displayName: true, avatarUrl: true },
          },
          certification: {
            select: {
              id: true,
              name: true,
              code: true,
              provider: { select: { id: true, name: true, slug: true } },
            },
          },
          domain: true,
          choices: { orderBy: { sortOrder: 'asc' } },
          tags: { include: { tag: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    if (!userId) {
      questions.forEach((q) => {
        if (q.explanation) {
          (q as any).explanation = 'Log in to view the detailed explanation.';
        }
      });
    }

    return {
      data: questions,
      meta: {
        total,
        page,
        limit,
        lastPage: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, userId?: string) {
    const question = await this.prisma.question.findUnique({
      where: { id },
      include: {
        author: { select: { id: true, displayName: true, avatarUrl: true } },
        certification: {
          select: {
            id: true,
            name: true,
            code: true,
            provider: { select: { id: true, name: true, slug: true } },
          },
        },
        domain: true,
        choices: { orderBy: { sortOrder: 'asc' } },
        tags: { include: { tag: true } },
        _count: { select: { comments: true, reports: true } },
      },
    });

    if (!question) {
      throw new NotFoundException(`Question with ID ${id} not found`);
    }

    let userVote: number | null = null;
    if (userId) {
      const vote = await this.prisma.vote.findUnique({
        where: {
          userId_targetType_targetId: {
            userId,
            targetType: VoteTargetType.QUESTION,
            targetId: id,
          },
        },
      });
      userVote = vote?.value ?? null;
    }

    if (!userId && question.explanation) {
      (question as any).explanation =
        'Log in to view the detailed explanation.';
    }

    return { ...question, userVote };
  }

  async create(
    userId: string,
    dto: CreateQuestionDto,
    initialStatus?: QuestionStatus,
    generationJobId?: string,
    qualityTier?: import('@prisma/client').QualityTier,
    sourceChunkId?: string,
  ) {
    const { choices, tags, ...questionData } = dto;

    // Upsert tags if provided
    const tagRecords =
      tags && tags.length > 0
        ? await Promise.all(
            tags.map((tagName) =>
              this.prisma.tag.upsert({
                where: {
                  name_certificationId: {
                    name: tagName.toLowerCase().trim(),
                    certificationId: dto.certificationId,
                  },
                },
                update: {},
                create: {
                  name: tagName.toLowerCase().trim(),
                  certificationId: dto.certificationId,
                },
              }),
            ),
          )
        : [];

    const isAiGenerated = !!generationJobId;

    const question = await this.prisma.question.create({
      data: {
        ...questionData,
        createdBy: userId,
        status: initialStatus ?? QuestionStatus.DRAFT,
        isAiGenerated,
        generationJobId: generationJobId || null,
        qualityTier: qualityTier || null,
        sourceChunkId: sourceChunkId || null,
        choices: {
          create: choices.map((c, index) => ({
            label: c.label,
            content: c.content,
            isCorrect: c.isCorrect ?? false,
            sortOrder: index,
          })),
        },
        tags: {
          create: tagRecords.map((tag) => ({
            tagId: tag.id,
          })),
        },
      },
      include: {
        choices: true,
        tags: { include: { tag: true } },
      },
    });

    await this.gamification.awardPoints(userId, POINTS.CREATE_QUESTION);
    return question;
  }

  async vote(userId: string, questionId: string, value: number) {
    if (value !== 1 && value !== -1 && value !== 0) {
      throw new BadRequestException('Vote value must be 1, -1, or 0');
    }

    const question = await this.prisma.question.findUnique({
      where: { id: questionId },
    });
    if (!question) throw new NotFoundException('Question not found');

    const existingVote = await this.prisma.vote.findUnique({
      where: {
        userId_targetType_targetId: {
          userId,
          targetType: VoteTargetType.QUESTION,
          targetId: questionId,
        },
      },
    });

    if (value === 0) {
      // Remove vote
      if (!existingVote) return question; // nothing to do

      await this.prisma.$transaction([
        this.prisma.vote.delete({ where: { id: existingVote.id } }),
        this.prisma.question.update({
          where: { id: questionId },
          data: {
            upvotes: existingVote.value === 1 ? { decrement: 1 } : undefined,
            downvotes: existingVote.value === -1 ? { decrement: 1 } : undefined,
          },
        }),
      ]);
    } else {
      // Upsert vote
      await this.prisma.$transaction(async (tx) => {
        if (existingVote) {
          if (existingVote.value === value) return; // same vote

          await tx.vote.update({
            where: { id: existingVote.id },
            data: { value },
          });

          // Switching from upvote to downvote (or vice versa)
          await tx.question.update({
            where: { id: questionId },
            data: {
              upvotes: value === 1 ? { increment: 1 } : { decrement: 1 },
              downvotes: value === -1 ? { increment: 1 } : { decrement: 1 },
            },
          });
        } else {
          await tx.vote.create({
            data: {
              userId,
              targetType: VoteTargetType.QUESTION,
              targetId: questionId,
              value,
            },
          });

          await tx.question.update({
            where: { id: questionId },
            data: {
              upvotes: value === 1 ? { increment: 1 } : undefined,
              downvotes: value === -1 ? { increment: 1 } : undefined,
            },
          });
        }
      });
    }

    await this.gamification.awardPoints(userId, POINTS.VOTE_QUESTION);
    return this.prisma.question.findUnique({ where: { id: questionId } });
  }

  async updateStatus(
    userId: string,
    userRole: UserRole,
    questionId: string,
    newStatus: QuestionStatus,
  ) {
    const question = await this.prisma.question.findUnique({
      where: { id: questionId },
    });
    if (!question) throw new NotFoundException('Question not found');

    // Contributors can only submit DRAFT → PENDING
    if (userRole === UserRole.CONTRIBUTOR) {
      if (
        question.status !== QuestionStatus.DRAFT ||
        newStatus !== QuestionStatus.PENDING
      ) {
        throw new ForbiddenException(
          'Contributors can only submit drafts for review',
        );
      }
    }

    // Only REVIEWER or ADMIN can approve/reject
    if (
      newStatus === QuestionStatus.APPROVED ||
      newStatus === QuestionStatus.REJECTED
    ) {
      if (userRole !== UserRole.REVIEWER && userRole !== UserRole.ADMIN) {
        throw new ForbiddenException(
          'Only reviewers or admins can approve/reject',
        );
      }
    }

    const updated = await this.prisma.question.update({
      where: { id: questionId },
      data: { status: newStatus },
      include: { author: { select: { id: true, displayName: true } } },
    });

    // Award points to author when question is approved
    if (
      newStatus === QuestionStatus.APPROVED &&
      question.status !== QuestionStatus.APPROVED
    ) {
      await this.gamification.awardPoints(
        question.createdBy,
        POINTS.QUESTION_APPROVED,
      );
    }

    return updated;
  }

  async findPending(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const where = { status: QuestionStatus.PENDING, deletedAt: null };

    const [total, questions] = await Promise.all([
      this.prisma.question.count({ where }),
      this.prisma.question.findMany({
        where,
        include: {
          author: { select: { id: true, displayName: true, avatarUrl: true } },
          certification: { select: { id: true, name: true, code: true } },
          domain: true,
          choices: { orderBy: { sortOrder: 'asc' } },
          tags: { include: { tag: true } },
        },
        orderBy: { createdAt: 'asc' },
        skip,
        take: limit,
      }),
    ]);

    return {
      data: questions,
      meta: { total, page, limit, lastPage: Math.ceil(total / limit) },
    };
  }

  /**
   * Edit a question's content. Allowed for the author (any role) and for
   * ADMIN / REVIEWER / CONTRIBUTOR on any question (see
   * docs/specs/question-edit-srs.md).
   *
   * Choices are synced by id rather than delete+recreate: Answer.selectedChoices
   * stores choice ids, so keeping ids stable keeps past results and in-progress
   * attempts valid.
   *
   * Returns the updated question plus a `previous` snapshot of the edited
   * fields for the audit log (the controller strips it from the response).
   */
  async updateByOwnerOrEditor(
    userId: string,
    userRole: UserRole,
    questionId: string,
    dto: UpdateQuestionDto,
  ) {
    const question = await this.prisma.question.findUnique({
      where: { id: questionId },
      include: {
        choices: { orderBy: { sortOrder: 'asc' } },
        tags: { include: { tag: true } },
      },
    });
    if (!question || question.deletedAt) {
      throw new NotFoundException('Question not found');
    }

    const isOwner = question.createdBy === userId;
    if (!isOwner && !canEditAnyQuestion(userRole)) {
      throw new ForbiddenException(
        'Only the author, a contributor, a reviewer or an admin can edit this question',
      );
    }

    const { choices, tags, ...fields } = dto;

    if (fields.domainId && fields.domainId !== question.domainId) {
      const domain = await this.prisma.domain.findUnique({
        where: { id: fields.domainId },
      });
      if (!domain || domain.certificationId !== question.certificationId) {
        throw new BadRequestException(
          'Domain does not belong to the question certification',
        );
      }
    }

    const effectiveType = fields.questionType ?? question.questionType;
    const effectiveChoices = choices ?? question.choices;
    const correctCount = effectiveChoices.filter((c) => c.isCorrect).length;
    if (correctCount === 0) {
      throw new BadRequestException('At least one choice must be correct');
    }
    if (effectiveType === QuestionType.SINGLE && correctCount !== 1) {
      throw new BadRequestException(
        'Single-answer questions must have exactly one correct choice',
      );
    }

    if (choices) {
      const existingIds = new Set(question.choices.map((c) => c.id));
      const sentIds = choices.filter((c) => c.id).map((c) => c.id as string);
      if (new Set(sentIds).size !== sentIds.length) {
        throw new BadRequestException('Duplicate choice id');
      }
      if (sentIds.some((id) => !existingIds.has(id))) {
        throw new BadRequestException(
          'Choice id does not belong to this question',
        );
      }
    }

    // A REJECTED question edited by its author goes back to DRAFT so it can be
    // resubmitted (contributors may only move DRAFT → PENDING).
    const resetToDraft = isOwner && question.status === QuestionStatus.REJECTED;

    const updated = await this.prisma.$transaction(async (tx) => {
      if (choices) {
        const keepIds = choices.filter((c) => c.id).map((c) => c.id as string);
        await tx.choice.deleteMany({
          where: { questionId, id: { notIn: keepIds } },
        });
        for (const [index, c] of choices.entries()) {
          const data = {
            label: String.fromCharCode(97 + index),
            content: c.content,
            isCorrect: c.isCorrect ?? false,
            sortOrder: index,
          };
          if (c.id) {
            await tx.choice.update({ where: { id: c.id }, data });
          } else {
            await tx.choice.create({ data: { ...data, questionId } });
          }
        }
      }

      if (tags) {
        await tx.questionTag.deleteMany({ where: { questionId } });
        const names = [
          ...new Set(tags.map((t) => t.toLowerCase().trim()).filter(Boolean)),
        ];
        if (names.length > 0) {
          const tagRecords = await Promise.all(
            names.map((name) =>
              tx.tag.upsert({
                where: {
                  name_certificationId: {
                    name,
                    certificationId: question.certificationId,
                  },
                },
                update: {},
                create: { name, certificationId: question.certificationId },
              }),
            ),
          );
          await tx.questionTag.createMany({
            data: tagRecords.map((t) => ({ questionId, tagId: t.id })),
          });
        }
      }

      return tx.question.update({
        where: { id: questionId },
        data: {
          ...fields,
          ...(resetToDraft ? { status: QuestionStatus.DRAFT } : {}),
        },
        include: {
          author: { select: { id: true, displayName: true, avatarUrl: true } },
          certification: {
            select: {
              id: true,
              name: true,
              code: true,
              provider: { select: { id: true, name: true, slug: true } },
            },
          },
          domain: true,
          choices: { orderBy: { sortOrder: 'asc' } },
          tags: { include: { tag: true } },
        },
      });
    });

    if (
      fields.domainId !== undefined &&
      fields.domainId !== question.domainId &&
      updated.certificationId
    ) {
      this.scheduleOverlapRecompute(updated.certificationId);
    }

    const previous: Record<string, unknown> = {};
    for (const key of Object.keys(fields)) {
      previous[key] = (question as Record<string, unknown>)[key];
    }
    if (choices) {
      previous.choices = question.choices.map((c) => ({
        id: c.id,
        label: c.label,
        content: c.content,
        isCorrect: c.isCorrect,
      }));
    }
    if (tags) previous.tags = question.tags.map((t) => t.tag.name);
    if (resetToDraft) previous.status = question.status;

    return { question: updated, previous, isOwner };
  }

  async adminUpdate(questionId: string, dto: AdminUpdateQuestionDto) {
    const question = await this.prisma.question.findUnique({
      where: { id: questionId },
    });
    if (!question) throw new NotFoundException('Question not found');
    if (question.deletedAt)
      throw new NotFoundException('Question has been deleted');

    const { choices, tags, ...questionData } = dto;

    // Replace choices if provided
    if (choices) {
      await this.prisma.choice.deleteMany({ where: { questionId } });
      await this.prisma.choice.createMany({
        data: choices.map((c, index) => ({
          questionId,
          label: c.label,
          content: c.content,
          isCorrect: c.isCorrect ?? false,
          sortOrder: index,
        })),
      });
    }

    // Replace tags if provided
    if (tags) {
      await this.prisma.questionTag.deleteMany({ where: { questionId } });
      if (tags.length > 0) {
        const certId = dto.certificationId || question.certificationId;
        const tagRecords = await Promise.all(
          tags.map((tagName) =>
            this.prisma.tag.upsert({
              where: {
                name_certificationId: {
                  name: tagName.toLowerCase().trim(),
                  certificationId: certId,
                },
              },
              update: {},
              create: {
                name: tagName.toLowerCase().trim(),
                certificationId: certId,
              },
            }),
          ),
        );
        await this.prisma.questionTag.createMany({
          data: tagRecords.map((t) => ({ questionId, tagId: t.id })),
        });
      }
    }

    const domainChanged =
      dto.domainId !== undefined && dto.domainId !== question.domainId;

    const updated = await this.prisma.question.update({
      where: { id: questionId },
      data: questionData,
      include: {
        author: { select: { id: true, displayName: true, avatarUrl: true } },
        certification: { select: { id: true, name: true, code: true } },
        domain: true,
        choices: { orderBy: { sortOrder: 'asc' } },
        tags: { include: { tag: true } },
      },
    });

    // US-1103: debounced overlap recompute when domain changes
    if (domainChanged && updated.certificationId) {
      this.scheduleOverlapRecompute(updated.certificationId);
    }

    return updated;
  }

  /**
   * US-1103: Debounce overlap recompute — collapses burst edits into one job.
   * Uses in-process timer; safe for single-instance deployment.
   */
  private scheduleOverlapRecompute(certId: string): void {
    const existing = this.recomputeDebounce.get(certId);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      this.recomputeDebounce.delete(certId);
      this.kg
        .enqueueOverlapCompute(certId)
        .then(({ jobId }) =>
          this.logger.log(
            `kg_recompute_triggered certId=${certId} jobId=${jobId}`,
          ),
        )
        .catch((err: unknown) =>
          this.logger.error(
            `kg_recompute_enqueue_failed certId=${certId}`,
            err,
          ),
        );
    }, RECOMPUTE_DEBOUNCE_MS);

    this.recomputeDebounce.set(certId, timer);
  }

  /**
   * Return a statistical summary of the APPROVED question pool for a given
   * certification. Used by the frontend BlueprintEditor to show real-time
   * availability counts while the user sets quotas.
   */
  async getStats(certificationId: string) {
    const where = {
      certificationId,
      status: QuestionStatus.APPROVED,
      deletedAt: null,
    };

    const [total, byDifficultyRaw, byDomainRaw] = await Promise.all([
      this.prisma.question.count({ where }),
      this.prisma.question.groupBy({
        by: ['difficulty'],
        where,
        _count: { id: true },
      }),
      this.prisma.question.groupBy({
        by: ['domainId'],
        where,
        _count: { id: true },
      }),
    ]);

    const byDifficulty: Record<string, number> = {
      EASY: 0,
      MEDIUM: 0,
      HARD: 0,
    };
    for (const row of byDifficultyRaw) {
      byDifficulty[row.difficulty] = row._count.id;
    }

    // Fetch domain names for non-null domainIds.
    const domainIds = byDomainRaw
      .map((r) => r.domainId)
      .filter((id): id is string => !!id);

    const domains =
      domainIds.length > 0
        ? await this.prisma.domain.findMany({
            where: { id: { in: domainIds } },
            select: { id: true, name: true },
          })
        : [];

    const domainMap = new Map(domains.map((d) => [d.id, d.name]));

    const byDomain = byDomainRaw.map((row) => ({
      domainId: row.domainId,
      name: row.domainId ? (domainMap.get(row.domainId) ?? 'Unknown') : null,
      count: row._count.id,
    }));

    return { total, byDifficulty, byDomain };
  }

  async removeByOwnerOrAdmin(
    userId: string,
    userRole: UserRole,
    questionId: string,
  ) {
    const question = await this.prisma.question.findUnique({
      where: { id: questionId },
    });

    if (!question || question.deletedAt) {
      throw new NotFoundException('Question not found');
    }

    const isAdmin = userRole === UserRole.ADMIN;
    const isOwner = question.createdBy === userId;

    if (!isAdmin && !isOwner) {
      throw new ForbiddenException(
        'Only the author or an admin can delete this question',
      );
    }

    const examUsageCount = await this.prisma.examAttempt.count({
      where: {
        status: AttemptStatus.IN_PROGRESS,
        exam: { examQuestions: { some: { questionId } } },
      },
    });

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.report.updateMany({
        where: { questionId, status: ReportStatus.PENDING },
        data: { status: ReportStatus.RESOLVED },
      });

      return tx.question.update({
        where: { id: questionId },
        data: { deletedAt: new Date(), status: QuestionStatus.REMOVED },
      });
    });

    return { ...updated, examUsageCount };
  }

  async findAllAdmin(params: {
    certificationId?: string;
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
    includeDeleted?: boolean;
  }) {
    const {
      certificationId,
      status,
      search,
      page = 1,
      limit = 20,
      includeDeleted = false,
    } = params;
    const where: any = {};
    if (!includeDeleted) where.deletedAt = null;
    if (certificationId) where.certificationId = certificationId;
    if (status) where.status = status as QuestionStatus;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.question.findMany({
        where,
        include: {
          author: { select: { id: true, displayName: true } },
          certification: { select: { id: true, name: true, code: true } },
          domain: { select: { id: true, name: true } },
          _count: { select: { choices: true, comments: true, reports: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.question.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, lastPage: Math.ceil(total / limit) },
    };
  }
}
