import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { ExamCatalogItemType, TimerMode } from '@prisma/client';
import { CreateCatalogItemDto } from './dto/create-catalog-item.dto';
import { UpdateCatalogItemDto } from './dto/update-catalog-item.dto';
import { AssignExamDto } from './dto/assign-exam.dto';
import { CreateTrackDto } from './dto/create-track.dto';
import { UpdateTrackDto } from './dto/update-track.dto';
import { ListCatalogDto } from './dto/list-catalog.dto';

@Injectable()
export class ExamCatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orgsService: OrganizationsService,
  ) {}

  // ─── Catalog Items ────────────────────────────────────────────────────────

  async listCatalog(
    slugOrId: string,
    adminView: boolean,
    query: ListCatalogDto,
  ) {
    const orgId = await this.orgsService.resolveOrgId(slugOrId);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: any = { orgId };
    if (!adminView) {
      const now = new Date();
      where.isActive = true;
      where.OR = [{ availableFrom: null }, { availableFrom: { lte: now } }];
      where.AND = [
        {
          OR: [{ availableUntil: null }, { availableUntil: { gte: now } }],
        },
      ];
    }
    if (query.search) {
      where.title = { contains: query.search, mode: 'insensitive' };
    }
    if (query.trackId) {
      where.trackId = query.trackId;
    }

    const [items, total] = await Promise.all([
      this.prisma.examCatalogItem.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
        include: {
          certification: { select: { id: true, name: true, code: true } },
          track: { select: { id: true, name: true } },
          prerequisite: { select: { id: true, title: true } },
          _count: { select: { questions: true, assignments: true } },
        },
      }),
      this.prisma.examCatalogItem.count({ where }),
    ]);

    return {
      data: items,
      meta: { total, page, limit, lastPage: Math.ceil(total / limit) },
    };
  }

  async getCatalogItem(slugOrId: string, cid: string) {
    const orgId = await this.orgsService.resolveOrgId(slugOrId);
    const item = await this.prisma.examCatalogItem.findFirst({
      where: { id: cid, orgId },
      include: {
        certification: { select: { id: true, name: true, code: true } },
        track: { select: { id: true, name: true } },
        prerequisite: { select: { id: true, title: true } },
        questions: {
          orderBy: { sortOrder: 'asc' },
          include: {
            orgQuestion: {
              include: { choices: { orderBy: { sortOrder: 'asc' } } },
            },
            publicQuestion: {
              include: { choices: { orderBy: { sortOrder: 'asc' } } },
            },
          },
        },
        _count: { select: { assignments: true } },
      },
    });
    if (!item) throw new NotFoundException('Catalog item not found');
    return item;
  }

  async createCatalogItem(
    slugOrId: string,
    userId: string,
    dto: CreateCatalogItemDto,
  ) {
    const orgId = await this.orgsService.resolveOrgId(slugOrId);

    return this.prisma.$transaction(async (tx) => {
      const item = await tx.examCatalogItem.create({
        data: {
          orgId,
          title: dto.title,
          description: dto.description,
          type: dto.type ?? ExamCatalogItemType.FIXED,
          certificationId: dto.certificationId,
          questionCount: dto.questionCount,
          timeLimit: dto.timeLimit,
          passingScore: dto.passingScore,
          timerMode: dto.timerMode ?? TimerMode.STRICT,
          maxAttempts: dto.maxAttempts,
          availableFrom: dto.availableFrom
            ? new Date(dto.availableFrom)
            : undefined,
          availableUntil: dto.availableUntil
            ? new Date(dto.availableUntil)
            : undefined,
          isMandatory: dto.isMandatory ?? false,
          isActive: dto.isActive ?? true,
          sortOrder: dto.sortOrder ?? 0,
          trackId: dto.trackId,
          prerequisiteId: dto.prerequisiteId,
          createdBy: userId,
          questions: dto.questions?.length
            ? {
                create: dto.questions.map((q, i) => ({
                  orgQuestionId: q.orgQuestionId ?? null,
                  publicQuestionId: q.publicQuestionId ?? null,
                  sortOrder: q.sortOrder ?? i,
                })),
              }
            : undefined,
        },
        include: {
          certification: { select: { id: true, name: true, code: true } },
          track: { select: { id: true, name: true } },
          _count: { select: { questions: true } },
        },
      });
      return item;
    });
  }

  async updateCatalogItem(
    slugOrId: string,
    cid: string,
    userId: string,
    dto: UpdateCatalogItemDto,
  ) {
    const orgId = await this.orgsService.resolveOrgId(slugOrId);
    const item = await this.prisma.examCatalogItem.findFirst({
      where: { id: cid, orgId },
    });
    if (!item) throw new NotFoundException('Catalog item not found');

    return this.prisma.$transaction(async (tx) => {
      if (dto.questions !== undefined) {
        await tx.examCatalogQuestion.deleteMany({
          where: { catalogItemId: cid },
        });
        if (dto.questions.length > 0) {
          await tx.examCatalogQuestion.createMany({
            data: dto.questions.map((q, i) => ({
              catalogItemId: cid,
              orgQuestionId: q.orgQuestionId ?? null,
              publicQuestionId: q.publicQuestionId ?? null,
              sortOrder: q.sortOrder ?? i,
            })),
          });
        }
      }

      return tx.examCatalogItem.update({
        where: { id: cid },
        data: {
          ...(dto.title !== undefined && { title: dto.title }),
          ...(dto.description !== undefined && {
            description: dto.description,
          }),
          ...(dto.type !== undefined && { type: dto.type }),
          ...(dto.certificationId !== undefined && {
            certificationId: dto.certificationId,
          }),
          ...(dto.questionCount !== undefined && {
            questionCount: dto.questionCount,
          }),
          ...(dto.timeLimit !== undefined && { timeLimit: dto.timeLimit }),
          ...(dto.passingScore !== undefined && {
            passingScore: dto.passingScore,
          }),
          ...(dto.timerMode !== undefined && { timerMode: dto.timerMode }),
          ...(dto.maxAttempts !== undefined && {
            maxAttempts: dto.maxAttempts,
          }),
          ...(dto.availableFrom !== undefined && {
            availableFrom: dto.availableFrom
              ? new Date(dto.availableFrom)
              : null,
          }),
          ...(dto.availableUntil !== undefined && {
            availableUntil: dto.availableUntil
              ? new Date(dto.availableUntil)
              : null,
          }),
          ...(dto.isMandatory !== undefined && {
            isMandatory: dto.isMandatory,
          }),
          ...(dto.isActive !== undefined && { isActive: dto.isActive }),
          ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
          ...(dto.trackId !== undefined && { trackId: dto.trackId }),
          ...(dto.prerequisiteId !== undefined && {
            prerequisiteId: dto.prerequisiteId,
          }),
        },
        include: {
          certification: { select: { id: true, name: true, code: true } },
          track: { select: { id: true, name: true } },
          _count: { select: { questions: true } },
        },
      });
    });
  }

  async deleteCatalogItem(
    slugOrId: string,
    cid: string,
    userId: string,
    role: string,
  ) {
    const orgId = await this.orgsService.resolveOrgId(slugOrId);
    const item = await this.prisma.examCatalogItem.findFirst({
      where: { id: cid, orgId },
    });
    if (!item) throw new NotFoundException('Catalog item not found');

    const canDelete = ['OWNER', 'ADMIN'].includes(role);
    const isCreator = item.createdBy === userId;
    if (!canDelete && !isCreator) {
      throw new ForbiddenException('Insufficient permissions');
    }

    await this.prisma.examCatalogItem.delete({ where: { id: cid } });
  }

  // ─── Assign ───────────────────────────────────────────────────────────────

  async assignExam(slugOrId: string, cid: string, dto: AssignExamDto) {
    const orgId = await this.orgsService.resolveOrgId(slugOrId);
    const item = await this.prisma.examCatalogItem.findFirst({
      where: { id: cid, orgId },
    });
    if (!item) throw new NotFoundException('Catalog item not found');

    if (!dto.groupId && !dto.memberId) {
      throw new BadRequestException('Must specify groupId or memberId');
    }

    // Validate group/member belong to org
    if (dto.groupId) {
      const group = await this.prisma.orgGroup.findFirst({
        where: { id: dto.groupId, orgId },
      });
      if (!group) throw new NotFoundException('Group not found in this org');
    }
    if (dto.memberId) {
      const member = await this.prisma.orgMember.findFirst({
        where: { id: dto.memberId, orgId },
      });
      if (!member) throw new NotFoundException('Member not found in this org');
    }

    return this.prisma.orgExamAssignment.create({
      data: {
        catalogItemId: cid,
        groupId: dto.groupId ?? null,
        memberId: dto.memberId ?? null,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
      },
    });
  }

  // ─── Start Exam ───────────────────────────────────────────────────────────

  async startCatalogExam(slugOrId: string, cid: string, userId: string) {
    const orgId = await this.orgsService.resolveOrgId(slugOrId);

    const item = await this.prisma.examCatalogItem.findFirst({
      where: { id: cid, orgId, isActive: true },
      include: {
        certification: { include: { domains: true, provider: true } },
        questions: {
          orderBy: { sortOrder: 'asc' },
          include: {
            publicQuestion: {
              include: {
                choices: { orderBy: { sortOrder: 'asc' } },
                domain: true,
                tags: { include: { tag: true } },
              },
            },
            orgQuestion: {
              include: {
                choices: { orderBy: { sortOrder: 'asc' } },
                certification: true,
              },
            },
          },
        },
      },
    });

    if (!item)
      throw new NotFoundException('Catalog item not found or inactive');

    // Validate availability window
    const now = new Date();
    if (item.availableFrom && item.availableFrom > now) {
      throw new BadRequestException('Exam is not yet available');
    }
    if (item.availableUntil && item.availableUntil < now) {
      throw new BadRequestException('Exam availability has ended');
    }

    // Check certification required for Exam creation
    // If item doesn't have one, try to pick one from the questions
    let effectiveCertId = item.certificationId;
    if (!effectiveCertId) {
      const firstQWithCert = item.questions.find(
        (q) =>
          q.orgQuestion?.certificationId || q.publicQuestion?.certificationId,
      );
      effectiveCertId =
        firstQWithCert?.orgQuestion?.certificationId ||
        firstQWithCert?.publicQuestion?.certificationId ||
        null;
    }

    if (!effectiveCertId) {
      throw new BadRequestException(
        'Catalog item must have a certification association to start an exam',
      );
    }

    // Check max attempts
    if (item.maxAttempts) {
      const existingAttempts = await this.prisma.examAttempt.count({
        where: {
          userId,
          exam: {
            title: { startsWith: `[catalog:${cid}]` },
          },
        },
      });
      if (existingAttempts >= item.maxAttempts) {
        throw new BadRequestException('Maximum attempts reached for this exam');
      }
    }

    // Check prerequisite
    if (item.prerequisiteId) {
      const prereq = await this.prisma.examCatalogItem.findUnique({
        where: { id: item.prerequisiteId },
        select: { passingScore: true },
      });
      const hasPassed = await this.prisma.examAttempt.findFirst({
        where: {
          userId,
          exam: { title: { startsWith: `[catalog:${item.prerequisiteId}]` } },
          score: prereq?.passingScore
            ? { gte: prereq.passingScore }
            : { not: null },
        },
      });
      if (!hasPassed) {
        throw new BadRequestException(
          'You must complete the prerequisite exam first',
        );
      }
    }

    // Determine questions
    let questions: any[] = [];

    if (item.type === ExamCatalogItemType.FIXED) {
      questions = item.questions
        .map((q) => q.orgQuestion || q.publicQuestion)
        .filter((q): q is any => !!q);
    } else {
      // DYNAMIC: randomly select approved public questions for certification
      const pool = await this.prisma.question.findMany({
        where: {
          certificationId: effectiveCertId,
          status: 'APPROVED',
          deletedAt: null,
        },
        include: {
          choices: { orderBy: { sortOrder: 'asc' } },
          domain: true,
          tags: { include: { tag: true } },
        },
      });

      if (pool.length < item.questionCount) {
        throw new BadRequestException(
          `Not enough approved questions (need ${item.questionCount}, found ${pool.length})`,
        );
      }

      const shuffled = [...pool].sort(() => Math.random() - 0.5);
      questions = shuffled.slice(0, item.questionCount);
    }

    if (questions.length === 0) {
      throw new BadRequestException(
        'No questions available for this catalog exam',
      );
    }

    // Create a transient Exam + ExamAttempt
    const attempt = await this.prisma.$transaction(async (tx) => {
      const exam = await tx.exam.create({
        data: {
          createdBy: userId,
          certificationId: effectiveCertId,
          title: `[catalog:${cid}] ${item.title}`,
          questionCount: questions.length,
          timeLimit: item.timeLimit,
          timerMode: item.timerMode,
          visibility: 'PRIVATE',
          examQuestions: {
            create: questions.map((q, i) => ({
              questionId: q.id,
              sortOrder: i,
            })),
          },
        },
      });

      const newAttempt = await tx.examAttempt.create({
        data: {
          userId,
          examId: exam.id,
          totalQuestions: questions.length,
        },
      });

      return { exam, attempt: newAttempt };
    });

    // Build response matching StartAttemptResponse shape
    const shuffledQuestions = [...questions]
      .sort(() => Math.random() - 0.5)
      .map((q, index) => ({
        id: q.id,
        title: q.title,
        description: q.description,
        questionType: q.questionType,
        difficulty: q.difficulty,
        domain: q.domain,
        isScenario: q.isScenario,
        tags: q.tags?.map((t: any) => t.tag?.name ?? t) ?? [],
        choices: [...(q.choices ?? [])]
          .sort(() => Math.random() - 0.5)
          .map((c: any) => ({
            id: c.id,
            label: c.label,
            content: c.content,
          })),
        sortOrder: index,
      }));

    return {
      attemptId: attempt.attempt.id,
      examId: attempt.exam.id,
      title: item.title,
      certification: item.certification,
      timeLimit: item.timeLimit,
      timerMode: item.timerMode,
      totalQuestions: shuffledQuestions.length,
      questions: shuffledQuestions,
    };
  }

  // ─── My Assignments ───────────────────────────────────────────────────────

  async getMyAssignments(slugOrId: string, userId: string) {
    const orgId = await this.orgsService.resolveOrgId(slugOrId);

    const member = await this.prisma.orgMember.findFirst({
      where: { orgId, userId, isActive: true },
      select: { id: true, groupId: true },
    });
    if (!member) return [];

    // Find assignments for this member (directly or via group)
    const assignments = await this.prisma.orgExamAssignment.findMany({
      where: {
        catalogItem: { orgId },
        OR: [
          { memberId: member.id },
          ...(member.groupId ? [{ groupId: member.groupId }] : []),
        ],
      },
      include: {
        catalogItem: {
          include: {
            certification: { select: { id: true, name: true, code: true } },
            track: { select: { id: true, name: true } },
            _count: { select: { questions: true } },
          },
        },
        group: { select: { id: true, name: true } },
      },
      orderBy: { assignedAt: 'desc' },
    });

    // Enrich with attempt stats per catalog item
    const enriched = await Promise.all(
      assignments.map(async (a) => {
        const attemptsRaw = await this.prisma.examAttempt.findMany({
          where: {
            userId,
            exam: { title: { startsWith: `[catalog:${a.catalogItemId}]` } },
          },
          select: { score: true, status: true },
        });

        const submitted = attemptsRaw.filter(
          (att) => att.status === 'SUBMITTED',
        );
        const bestScore = submitted.length
          ? Math.max(...submitted.map((att) => Number(att.score ?? 0)))
          : null;
        const passed =
          a.catalogItem.passingScore != null
            ? (bestScore ?? 0) >= a.catalogItem.passingScore
            : null;

        return {
          ...a,
          attemptsCount: submitted.length,
          bestScore,
          passed,
        };
      }),
    );

    return enriched;
  }

  // ─── Learning Tracks ──────────────────────────────────────────────────────

  async listTracks(slugOrId: string) {
    const orgId = await this.orgsService.resolveOrgId(slugOrId);
    return this.prisma.learningTrack.findMany({
      where: { orgId },
      orderBy: { createdAt: 'asc' },
      include: {
        catalogItems: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
          select: {
            id: true,
            title: true,
            questionCount: true,
            timeLimit: true,
            isMandatory: true,
            sortOrder: true,
          },
        },
        _count: { select: { catalogItems: true } },
      },
    });
  }

  async createTrack(slugOrId: string, userId: string, dto: CreateTrackDto) {
    const orgId = await this.orgsService.resolveOrgId(slugOrId);
    return this.prisma.learningTrack.create({
      data: {
        orgId,
        name: dto.name,
        description: dto.description,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async updateTrack(slugOrId: string, tid: string, dto: UpdateTrackDto) {
    const orgId = await this.orgsService.resolveOrgId(slugOrId);
    const track = await this.prisma.learningTrack.findFirst({
      where: { id: tid, orgId },
    });
    if (!track) throw new NotFoundException('Learning track not found');

    return this.prisma.learningTrack.update({
      where: { id: tid },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  async deleteTrack(slugOrId: string, tid: string) {
    const orgId = await this.orgsService.resolveOrgId(slugOrId);
    const track = await this.prisma.learningTrack.findFirst({
      where: { id: tid, orgId },
    });
    if (!track) throw new NotFoundException('Learning track not found');

    // Detach catalog items from this track before deleting
    await this.prisma.examCatalogItem.updateMany({
      where: { trackId: tid },
      data: { trackId: null },
    });
    await this.prisma.learningTrack.delete({ where: { id: tid } });
  }
}
