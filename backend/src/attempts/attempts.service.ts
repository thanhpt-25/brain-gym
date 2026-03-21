import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SubmitAnswerDto } from './dto/submit-answer.dto';
import { SubmitAttemptDto } from './dto/submit-attempt.dto';
import { AttemptStatus, Prisma } from '@prisma/client';
import { GamificationService, POINTS } from '../gamification/gamification.service';
import { ExamsService } from '../exams/exams.service';
import { AttemptResultResponse, QuestionResultResponse } from './dto/attempt-result.dto';

interface QuestionWithChoices extends Prisma.QuestionGetPayload<{
    include: { choices: true, domain: true }
}> {}

@Injectable()
export class AttemptsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly gamification: GamificationService,
        private readonly examsService: ExamsService,
    ) { }

    async start(userId: string, examId: string) {
        const exam = await this.prisma.exam.findUnique({
            where: { id: examId },
            include: {
                certification: { include: { domains: true } },
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

        if (!exam) throw new NotFoundException('Exam not found');

        const attempt = await this.prisma.examAttempt.create({
            data: {
                userId,
                examId,
                totalQuestions: exam.examQuestions.length,
            },
        });

        // Randomize question order
        const shuffledQuestions = [...exam.examQuestions].sort(() => Math.random() - 0.5);

        // Return questions WITHOUT isCorrect
        const questions = shuffledQuestions.map((eq, index) => {
            const q = eq.question;
            // Randomize choice order
            const shuffledChoices = [...q.choices]
                .sort(() => Math.random() - 0.5)
                .map(c => ({
                    id: c.id,
                    label: c.label,
                    content: c.content,
                }));

            return {
                id: q.id,
                title: q.title,
                description: q.description,
                questionType: q.questionType,
                difficulty: q.difficulty,
                domain: q.domain,
                tags: q.tags.map(t => t.tag.name),
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
            totalQuestions: questions.length,
            questions,
        };
    }

    async saveAnswer(userId: string, attemptId: string, dto: SubmitAnswerDto) {
        const attempt = await this.prisma.examAttempt.findUnique({ where: { id: attemptId } });
        if (!attempt) throw new NotFoundException('Attempt not found');
        if (attempt.userId !== userId) throw new ForbiddenException('Not your attempt');
        if (attempt.status !== AttemptStatus.IN_PROGRESS) {
            throw new BadRequestException('Attempt already submitted');
        }

        const question = await this.prisma.question.findUnique({
            where: { id: dto.questionId },
            include: { choices: true },
        });

        if (!question) throw new NotFoundException('Question not found');

        const correctChoices = question.choices.filter(c => c.isCorrect).map(c => c.id);
        const isCorrect = correctChoices.length === dto.selectedChoices.length &&
            correctChoices.every(id => dto.selectedChoices.includes(id));

        const existing = await this.prisma.answer.findFirst({
            where: { attemptId, questionId: dto.questionId },
            select: { id: true },
        });

        return this.prisma.answer.upsert({
            where: { id: existing?.id ?? '' },
            create: {
                attemptId,
                questionId: dto.questionId,
                selectedChoices: dto.selectedChoices,
                isCorrect,
                isMarked: dto.isMarked ?? false,
            },
            update: {
                selectedChoices: dto.selectedChoices,
                isCorrect,
                isMarked: dto.isMarked ?? false,
            },
        });
    }

    async submit(userId: string, attemptId: string, dto: SubmitAttemptDto): Promise<AttemptResultResponse> {
        const attempt = await this.prisma.examAttempt.findUnique({
            where: { id: attemptId },
            include: { exam: true },
        });
        if (!attempt) throw new NotFoundException('Attempt not found');
        if (attempt.userId !== userId) throw new ForbiddenException('Not your attempt');
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

        const { totalCorrect, domainScores, answerRecords } = this.evaluateAnswers(attemptId, dto, examQuestions);

        const totalQuestions = examQuestions.length;
        const score = totalQuestions > 0 ? (totalCorrect / totalQuestions) * 100 : 0;
        const timeSpent = Math.floor((Date.now() - attempt.startedAt.getTime()) / 1000);

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

    async finish(userId: string, attemptId: string): Promise<AttemptResultResponse> {
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
        if (attempt.userId !== userId) throw new ForbiddenException('Not your attempt');
        if (attempt.status !== AttemptStatus.IN_PROGRESS) {
            throw new BadRequestException('Attempt already submitted');
        }

        const examQuestions = attempt.exam.examQuestions;
        let totalCorrect = 0;
        const domainScores: Record<string, { correct: number; total: number }> = {};

        for (const eq of examQuestions) {
            const q = eq.question;
            const answer = attempt.answers.find(a => a.questionId === q.id);
            const isCorrect = answer?.isCorrect ?? false;
            
            if (isCorrect) totalCorrect++;

            const domainName = q.domain?.name ?? 'Unknown';
            if (!domainScores[domainName]) domainScores[domainName] = { correct: 0, total: 0 };
            domainScores[domainName].total++;
            if (isCorrect) domainScores[domainName].correct++;
        }

        const totalQuestions = examQuestions.length;
        const score = totalQuestions > 0 ? (totalCorrect / totalQuestions) * 100 : 0;
        const timeSpent = Math.floor((Date.now() - attempt.startedAt.getTime()) / 1000);

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

    private evaluateAnswers(attemptId: string, dto: SubmitAttemptDto, examQuestions: { question: QuestionWithChoices }[]) {
        const domainScores: Record<string, { correct: number; total: number }> = {};
        let totalCorrect = 0;
        const answerRecords: Prisma.AnswerCreateManyInput[] = [];

        for (const eq of examQuestions) {
            const q = eq.question;
            const submitted = dto.answers.find(a => a.questionId === q.id);
            const selectedChoices = submitted?.selectedChoices ?? [];
            const correctChoiceIds = q.choices.filter(c => c.isCorrect).map(c => c.id);

            const isCorrect = correctChoiceIds.length === selectedChoices.length &&
                correctChoiceIds.every((id: string) => selectedChoices.includes(id));

            if (isCorrect) totalCorrect++;

            const domainName = q.domain?.name ?? 'Unknown';
            if (!domainScores[domainName]) domainScores[domainName] = { correct: 0, total: 0 };
            domainScores[domainName].total++;
            if (isCorrect) domainScores[domainName].correct++;

            answerRecords.push({
                attemptId,
                questionId: q.id,
                selectedChoices,
                isCorrect,
                isMarked: submitted?.isMarked ?? false,
            });
        }

        return { totalCorrect, domainScores, answerRecords };
    }

    async findResult(attemptId: string): Promise<AttemptResultResponse> {
        const attempt = await this.prisma.examAttempt.findUnique({
            where: { id: attemptId },
            include: {
                exam: {
                    include: {
                        certification: true,
                    },
                },
                answers: {
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

        const questionResults: QuestionResultResponse[] = attempt.answers.map(a => ({
            answerId: a.id,
            questionId: a.questionId,
            title: a.question.title,
            description: a.question.description ?? undefined,
            explanation: a.question.explanation ?? undefined,
            domain: a.question.domain?.name ?? 'Unknown',
            correct: a.isCorrect ?? false,
            mistakeType: a.mistakeType ?? undefined,
            selectedAnswers: a.selectedChoices,
            correctAnswers: a.question.choices.filter(c => c.isCorrect).map(c => c.id),
            choices: a.question.choices.map(c => ({
                id: c.id,
                label: c.label,
                content: c.content,
                isCorrect: c.isCorrect,
            })),
        }));

        return {
            attemptId: attempt.id,
            examId: attempt.examId,
            examTitle: attempt.exam.title,
            certification: attempt.exam.certification,
            status: attempt.status,
            score: Number(attempt.score ?? 0),
            totalCorrect: attempt.totalCorrect ?? 0,
            totalQuestions: attempt.totalQuestions ?? 0,
            percentage: Math.round(Number(attempt.score ?? 0)),
            domainScores: attempt.domainScores as Record<string, { correct: number; total: number }>,
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
                            certification: { select: { id: true, name: true, code: true, provider: true } },
                        },
                    },
                },
                orderBy: { startedAt: 'desc' },
                skip,
                take: limit,
            }),
        ]);

        return {
            data: attempts.map(a => ({
                id: a.id,
                examId: a.examId,
                examTitle: a.exam.title,
                certification: a.exam.certification,
                score: Number(a.score ?? 0),
                totalCorrect: a.totalCorrect,
                totalQuestions: a.totalQuestions,
                status: a.status,
                timeSpent: a.timeSpent,
                startedAt: a.startedAt,
                submittedAt: a.submittedAt,
            })),
            meta: { total, page, lastPage: Math.ceil(total / limit) },
        };
    }
}
