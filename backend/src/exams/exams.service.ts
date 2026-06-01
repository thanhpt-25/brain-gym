import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateExamDto } from './dto/create-exam.dto';
import { UpdateExamDto } from './dto/update-exam.dto';
import { ExamVisibility, QuestionStatus, UserRole } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class ExamsService {
  constructor(private readonly prisma: PrismaService) {}

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

    const { questionIds, ...scalarData } = dto;

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
    const validQuestions = await this.prisma.question.findMany({
      where: { id: { in: questionIds }, certificationId: exam.certificationId },
      select: { id: true },
    });
    if (validQuestions.length !== questionIds.length) {
      throw new BadRequestException(
        "One or more questions are invalid or do not belong to this exam's certification",
      );
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
