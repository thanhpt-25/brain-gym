import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateQuestionDto } from './dto/create-question.dto';
import { QuestionStatus, VoteTargetType, UserRole } from '@prisma/client';
import { GamificationService, POINTS } from '../gamification/gamification.service';

@Injectable()
export class QuestionsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly gamification: GamificationService,
    ) { }

    async findAll(certificationId?: string, status?: string, page: number = 1, limit: number = 10, userId?: string) {
        const skip = (page - 1) * limit;

        const where: any = {};
        if (certificationId) where.certificationId = certificationId;
        where.status = (status as QuestionStatus) || QuestionStatus.APPROVED;

        const [total, questions] = await Promise.all([
            this.prisma.question.count({ where }),
            this.prisma.question.findMany({
                where,
                include: {
                    author: {
                        select: { id: true, displayName: true, avatarUrl: true },
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
            questions.forEach(q => {
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
                certification: { select: { id: true, name: true, code: true, provider: true } },
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
            (question as any).explanation = 'Log in to view the detailed explanation.';
        }

        return { ...question, userVote };
    }

    async create(userId: string, dto: CreateQuestionDto) {
        const { choices, tags, ...questionData } = dto;

        // Upsert tags if provided
        const tagRecords = tags && tags.length > 0
            ? await Promise.all(tags.map(tagName =>
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
                })
            ))
            : [];

        const question = await this.prisma.question.create({
            data: {
                ...questionData,
                createdBy: userId,
                status: QuestionStatus.DRAFT,
                choices: {
                    create: choices.map((c, index) => ({
                        label: c.label,
                        content: c.content,
                        isCorrect: c.isCorrect ?? false,
                        sortOrder: index,
                    })),
                },
                tags: {
                    create: tagRecords.map(tag => ({
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

        const question = await this.prisma.question.findUnique({ where: { id: questionId } });
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

                    // Adjust counts
                    const upAdj = value === 1 ? 1 : -1;
                    const downAdj = value === -1 ? 1 : -1;

                    await tx.question.update({
                        where: { id: questionId },
                        data: {
                            upvotes: { increment: upAdj },
                            downvotes: { increment: downAdj },
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

    async updateStatus(userId: string, userRole: UserRole, questionId: string, newStatus: QuestionStatus) {
        const question = await this.prisma.question.findUnique({ where: { id: questionId } });
        if (!question) throw new NotFoundException('Question not found');

        // Contributors can only submit DRAFT → PENDING
        if (userRole === UserRole.CONTRIBUTOR) {
            if (question.status !== QuestionStatus.DRAFT || newStatus !== QuestionStatus.PENDING) {
                throw new ForbiddenException('Contributors can only submit drafts for review');
            }
        }

        // Only REVIEWER or ADMIN can approve/reject
        if (newStatus === QuestionStatus.APPROVED || newStatus === QuestionStatus.REJECTED) {
            if (userRole !== UserRole.REVIEWER && userRole !== UserRole.ADMIN) {
                throw new ForbiddenException('Only reviewers or admins can approve/reject');
            }
        }

        const updated = await this.prisma.question.update({
            where: { id: questionId },
            data: { status: newStatus },
            include: { author: { select: { id: true, displayName: true } } },
        });

        // Award points to author when question is approved
        if (newStatus === QuestionStatus.APPROVED && question.status !== QuestionStatus.APPROVED) {
            await this.gamification.awardPoints(question.createdBy, POINTS.QUESTION_APPROVED);
        }

        return updated;
    }

    async findPending(page = 1, limit = 20) {
        const skip = (page - 1) * limit;
        const where = { status: QuestionStatus.PENDING };

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

        return { data: questions, meta: { total, page, limit, lastPage: Math.ceil(total / limit) } };
    }
}
