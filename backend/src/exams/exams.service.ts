import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateExamDto } from './dto/create-exam.dto';
import { UpdateExamDto } from './dto/update-exam.dto';
import { ExamVisibility, QuestionStatus, UserRole } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class ExamsService {
    constructor(private readonly prisma: PrismaService) { }

    async create(userId: string, dto: CreateExamDto) {
        let questionIds = dto.questionIds;

        if (!questionIds || questionIds.length === 0) {
            const questions = await this.prisma.question.findMany({
                where: {
                    certificationId: dto.certificationId,
                    status: QuestionStatus.APPROVED,
                },
                select: { id: true },
                orderBy: { createdAt: 'desc' },
            });

            const shuffled = questions.sort(() => Math.random() - 0.5);
            questionIds = shuffled.slice(0, dto.questionCount).map(q => q.id);
        }

        const shareCode = dto.visibility === ExamVisibility.LINK
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

    async findAll(certificationId?: string, page = 1, limit = 10, sort: 'latest' | 'popular' = 'latest') {
        const skip = (page - 1) * limit;
        const where: any = { visibility: ExamVisibility.PUBLIC };
        if (certificationId) where.certificationId = certificationId;

        const orderBy = sort === 'popular' ? { attemptCount: 'desc' as const } : { createdAt: 'desc' as const };

        const [total, exams] = await Promise.all([
            this.prisma.exam.count({ where }),
            this.prisma.exam.findMany({
                where,
                include: {
                    certification: { select: { id: true, name: true, code: true, provider: true } },
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
                    certification: { select: { id: true, name: true, code: true, provider: true } },
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
        return exam;
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
        return exam;
    }

    async update(userId: string, id: string, dto: UpdateExamDto) {
        const exam = await this.prisma.exam.findUnique({ where: { id } });
        if (!exam) throw new NotFoundException(`Exam with ID ${id} not found`);
        if (exam.createdBy !== userId) throw new ForbiddenException('You can only update your own exams');

        return this.prisma.exam.update({
            where: { id },
            data: dto,
            include: { certification: true },
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
