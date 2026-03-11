import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateQuestionDto } from './dto/create-question.dto';
import { QuestionStatus, VoteTargetType } from '@prisma/client';

@Injectable()
export class QuestionsService {
    constructor(private readonly prisma: PrismaService) { }

    async findAll(certificationId?: string, page: number = 1, limit: number = 10) {
        const skip = (page - 1) * limit;

        const where = certificationId ? { certificationId } : {};

        const [total, questions] = await Promise.all([
            this.prisma.question.count({ where }),
            this.prisma.question.findMany({
                where,
                include: {
                    author: {
                        select: { id: true, displayName: true, avatarUrl: true },
                    },
                    domain: true,
                    // usually you don't return all choices or just return without isCorrect 
                    // but for this phase we'll return them since we need them for exams later
                    choices: { orderBy: { sortOrder: 'asc' } },
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
        ]);

        return {
            data: questions,
            meta: {
                total,
                page,
                lastPage: Math.ceil(total / limit),
            },
        };
    }

    async findOne(id: string) {
        const question = await this.prisma.question.findUnique({
            where: { id },
            include: {
                author: { select: { id: true, displayName: true, avatarUrl: true } },
                domain: true,
                choices: { orderBy: { sortOrder: 'asc' } },
                comments: {
                    include: {
                        user: { select: { id: true, displayName: true, avatarUrl: true } }
                    },
                    orderBy: { createdAt: 'desc' }
                }
            },
        });

        if (!question) {
            throw new NotFoundException(`Question with ID ${id} not found`);
        }

        return question;
    }

    async create(userId: string, dto: CreateQuestionDto) {
        const { choices, ...questionData } = dto;

        return this.prisma.question.create({
            data: {
                ...questionData,
                createdBy: userId,
                status: QuestionStatus.DRAFT, // All newly submitted questions are DRAFT pending review
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
                choices: true,
            },
        });
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

        return this.prisma.question.findUnique({ where: { id: questionId } });
    }
}
