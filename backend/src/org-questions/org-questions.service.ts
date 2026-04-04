import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrgQuestionDto } from './dto/create-org-question.dto';
import { UpdateOrgQuestionDto } from './dto/update-org-question.dto';
import { ListOrgQuestionsDto } from './dto/list-org-questions.dto';
import { OrgQuestionStatus, OrgRole } from '@prisma/client';

@Injectable()
export class OrgQuestionsService {
  constructor(private readonly prisma: PrismaService) {}

  private async resolveOrgId(slugOrId: string): Promise<string> {
    const org = await this.prisma.organization.findFirst({
      where: { OR: [{ id: slugOrId }, { slug: slugOrId }] },
    });
    if (!org) throw new NotFoundException('Organization not found');
    return org.id;
  }

  private isAdmin(role: OrgRole): boolean {
    return role === OrgRole.OWNER || role === OrgRole.ADMIN;
  }

  private async enrichWithAuthors(questions: any[]) {
    const userIds = [...new Set(questions.map((q) => q.createdBy))];
    if (userIds.length === 0) return questions;

    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, displayName: true, avatarUrl: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    return questions.map((q) => ({
      ...q,
      author: userMap.get(q.createdBy) || null,
    }));
  }

  async findAll(orgSlugOrId: string, filters: ListOrgQuestionsDto) {
    const orgId = await this.resolveOrgId(orgSlugOrId);
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = { orgId };
    if (filters.status) where.status = filters.status;
    if (filters.difficulty) where.difficulty = filters.difficulty;
    if (filters.category) where.category = filters.category;
    if (filters.createdBy) where.createdBy = filters.createdBy;
    if (filters.search) {
      where.title = { contains: filters.search, mode: 'insensitive' };
    }

    const [total, questions] = await Promise.all([
      this.prisma.orgQuestion.count({ where }),
      this.prisma.orgQuestion.findMany({
        where,
        include: {
          choices: { orderBy: { sortOrder: 'asc' } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    const data = await this.enrichWithAuthors(questions);

    return {
      data,
      meta: { total, page, limit, lastPage: Math.ceil(total / limit) },
    };
  }

  async findOne(orgSlugOrId: string, questionId: string) {
    const orgId = await this.resolveOrgId(orgSlugOrId);
    const question = await this.prisma.orgQuestion.findFirst({
      where: { id: questionId, orgId },
      include: {
        choices: { orderBy: { sortOrder: 'asc' } },
      },
    });
    if (!question) throw new NotFoundException('Question not found');

    const [enriched] = await this.enrichWithAuthors([question]);
    return enriched;
  }

  async create(orgSlugOrId: string, userId: string, dto: CreateOrgQuestionDto) {
    const orgId = await this.resolveOrgId(orgSlugOrId);
    const { choices, tags, ...questionData } = dto;

    return this.prisma.orgQuestion.create({
      data: {
        ...questionData,
        orgId,
        createdBy: userId,
        tags: tags || [],
        status: OrgQuestionStatus.DRAFT,
        choices: {
          create: choices.map((c, index) => ({
            label: c.label,
            content: c.content,
            isCorrect: c.isCorrect ?? false,
            sortOrder: index,
          })),
        },
      },
      include: {
        choices: { orderBy: { sortOrder: 'asc' } },
      },
    });
  }

  async update(
    orgSlugOrId: string,
    questionId: string,
    userId: string,
    userRole: OrgRole,
    dto: UpdateOrgQuestionDto,
  ) {
    const orgId = await this.resolveOrgId(orgSlugOrId);
    const question = await this.prisma.orgQuestion.findFirst({
      where: { id: questionId, orgId },
    });
    if (!question) throw new NotFoundException('Question not found');

    // Only author or admin can edit
    if (question.createdBy !== userId && !this.isAdmin(userRole)) {
      throw new ForbiddenException('Only the author or an admin can edit this question');
    }

    // Only editable in DRAFT or REJECTED status
    if (question.status !== OrgQuestionStatus.DRAFT && question.status !== OrgQuestionStatus.REJECTED) {
      throw new BadRequestException('Can only edit questions in DRAFT or REJECTED status');
    }

    const { choices, tags, ...updateData } = dto;

    return this.prisma.$transaction(async (tx) => {
      if (choices) {
        await tx.orgQuestionChoice.deleteMany({ where: { orgQuestionId: questionId } });
      }

      return tx.orgQuestion.update({
        where: { id: questionId },
        data: {
          ...updateData,
          ...(tags !== undefined ? { tags } : {}),
          status: OrgQuestionStatus.DRAFT, // reset to DRAFT on edit
          ...(choices
            ? {
                choices: {
                  create: choices.map((c, index) => ({
                    label: c.label,
                    content: c.content,
                    isCorrect: c.isCorrect ?? false,
                    sortOrder: index,
                  })),
                },
              }
            : {}),
        },
        include: {
          choices: { orderBy: { sortOrder: 'asc' } },
        },
      });
    });
  }

  async remove(orgSlugOrId: string, questionId: string, userId: string, userRole: OrgRole) {
    const orgId = await this.resolveOrgId(orgSlugOrId);
    const question = await this.prisma.orgQuestion.findFirst({
      where: { id: questionId, orgId },
    });
    if (!question) throw new NotFoundException('Question not found');

    // Author can delete own DRAFT/REJECTED; admin can delete any
    if (!this.isAdmin(userRole)) {
      if (question.createdBy !== userId) {
        throw new ForbiddenException('Only the author or an admin can delete this question');
      }
      if (question.status !== OrgQuestionStatus.DRAFT && question.status !== OrgQuestionStatus.REJECTED) {
        throw new ForbiddenException('Members can only delete their own DRAFT or REJECTED questions');
      }
    }

    await this.prisma.orgQuestion.delete({ where: { id: questionId } });
  }

  async submitForReview(orgSlugOrId: string, questionId: string, userId: string) {
    const orgId = await this.resolveOrgId(orgSlugOrId);
    const question = await this.prisma.orgQuestion.findFirst({
      where: { id: questionId, orgId },
    });
    if (!question) throw new NotFoundException('Question not found');
    if (question.createdBy !== userId) {
      throw new ForbiddenException('Only the author can submit for review');
    }
    if (question.status !== OrgQuestionStatus.DRAFT) {
      throw new BadRequestException('Only DRAFT questions can be submitted for review');
    }

    return this.prisma.orgQuestion.update({
      where: { id: questionId },
      data: { status: OrgQuestionStatus.UNDER_REVIEW },
      include: { choices: { orderBy: { sortOrder: 'asc' } } },
    });
  }

  async approve(orgSlugOrId: string, questionId: string) {
    const orgId = await this.resolveOrgId(orgSlugOrId);
    const question = await this.prisma.orgQuestion.findFirst({
      where: { id: questionId, orgId },
    });
    if (!question) throw new NotFoundException('Question not found');
    if (question.status !== OrgQuestionStatus.UNDER_REVIEW) {
      throw new BadRequestException('Only UNDER_REVIEW questions can be approved');
    }

    return this.prisma.orgQuestion.update({
      where: { id: questionId },
      data: {
        status: OrgQuestionStatus.APPROVED,
        version: { increment: 1 },
      },
      include: { choices: { orderBy: { sortOrder: 'asc' } } },
    });
  }

  async reject(orgSlugOrId: string, questionId: string) {
    const orgId = await this.resolveOrgId(orgSlugOrId);
    const question = await this.prisma.orgQuestion.findFirst({
      where: { id: questionId, orgId },
    });
    if (!question) throw new NotFoundException('Question not found');
    if (question.status !== OrgQuestionStatus.UNDER_REVIEW) {
      throw new BadRequestException('Only UNDER_REVIEW questions can be rejected');
    }

    return this.prisma.orgQuestion.update({
      where: { id: questionId },
      data: { status: OrgQuestionStatus.REJECTED },
      include: { choices: { orderBy: { sortOrder: 'asc' } } },
    });
  }

  async cloneFromPublic(orgSlugOrId: string, userId: string, sourceQuestionId: string) {
    const orgId = await this.resolveOrgId(orgSlugOrId);
    const source = await this.prisma.question.findUnique({
      where: { id: sourceQuestionId },
      include: { choices: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!source) throw new NotFoundException('Source question not found');

    return this.prisma.orgQuestion.create({
      data: {
        orgId,
        createdBy: userId,
        sourceQuestionId: source.id,
        title: source.title,
        description: source.description,
        questionType: source.questionType,
        difficulty: source.difficulty,
        explanation: source.explanation,
        referenceUrl: source.referenceUrl,
        codeSnippet: source.codeSnippet,
        isScenario: source.isScenario,
        isTrapQuestion: source.isTrapQuestion,
        status: OrgQuestionStatus.APPROVED,
        tags: [],
        choices: {
          create: source.choices.map((c) => ({
            label: c.label,
            content: c.content,
            isCorrect: c.isCorrect,
            sortOrder: c.sortOrder,
          })),
        },
      },
      include: {
        choices: { orderBy: { sortOrder: 'asc' } },
      },
    });
  }
}
