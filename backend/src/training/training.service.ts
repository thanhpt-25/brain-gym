import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { StartWeaknessTrainingDto } from './dto/start-weakness-training.dto';
import { SubmitReviewDto } from './dto/submit-review.dto';
import { ExamVisibility, QuestionStatus, AttemptStatus } from '@prisma/client';

@Injectable()
export class TrainingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly analyticsService: AnalyticsService,
  ) {}

  private calculateSM2(
    quality: number,
    prevInterval: number,
    prevReps: number,
    prevEF: number,
  ) {
    let interval: number;
    let repetitions: number;
    let easeFactor: number;

    if (quality >= 3) {
      if (prevReps === 0) {
        interval = 1;
      } else if (prevReps === 1) {
        interval = 6;
      } else {
        interval = Math.round(prevInterval * prevEF);
      }
      repetitions = prevReps + 1;
      easeFactor =
        prevEF + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    } else {
      repetitions = 0;
      interval = 1;
      easeFactor = prevEF;
    }

    if (easeFactor < 1.3) {
      easeFactor = 1.3;
    }

    return { interval, repetitions, easeFactor };
  }

  async submitReview(userId: string, dto: SubmitReviewDto) {
    const { questionId, quality } = dto;

    const question = await this.prisma.question.findUnique({
      where: { id: questionId },
    });

    if (!question) {
      throw new NotFoundException('Question not found');
    }

    const schedule = await this.prisma.reviewSchedule.findUnique({
      where: { userId_questionId: { userId, questionId } },
    });

    const prevInterval = schedule?.intervalDays ?? 0;
    const prevReps = schedule?.repetitions ?? 0;
    const prevEF = Number(schedule?.easeFactor ?? 2.5);

    const { interval, repetitions, easeFactor } = this.calculateSM2(
      quality,
      prevInterval,
      prevReps,
      prevEF,
    );

    const nextReviewDate = new Date();
    nextReviewDate.setDate(nextReviewDate.getDate() + interval);

    return this.prisma.reviewSchedule.upsert({
      where: { userId_questionId: { userId, questionId } },
      update: {
        intervalDays: interval,
        repetitions,
        easeFactor,
        nextReviewDate,
      },
      create: {
        userId,
        questionId,
        intervalDays: interval,
        repetitions,
        easeFactor,
        nextReviewDate,
      },
    });
  }

  async getDueReviews(
    userId: string,
    certificationId?: string,
    limit?: number,
  ) {
    const today = new Date();

    const where: any = {
      userId,
      nextReviewDate: { lte: today },
    };

    if (certificationId) {
      where.question = { certificationId };
    }

    const reviews = await this.prisma.reviewSchedule.findMany({
      where,
      include: {
        question: {
          include: {
            domain: true,
            choices: {
              select: { id: true, label: true, content: true, isCorrect: true },
            }, // Exclude isCorrect
          },
        },
      },
      orderBy: { nextReviewDate: 'asc' },
      take: limit,
    });

    return reviews;
  }

  async startWeaknessTraining(userId: string, dto: StartWeaknessTrainingDto) {
    const { certificationId, questionCount = 10 } = dto;

    const certification = await this.prisma.certification.findFirst({
      where: {
        OR: [{ id: certificationId }, { code: certificationId }],
      },
      include: { domains: true, provider: true },
    });

    if (!certification) {
      throw new NotFoundException('Certification not found');
    }

    const domainPerformance = await this.analyticsService.getDomains(
      userId,
      certificationId,
    );

    // Assign weights: weight = (100 - domainScore + 10)
    const domainWeights = certification.domains.map((domain) => {
      const performance = domainPerformance.find(
        (p) => p.domain === domain.name,
      );
      const score = performance ? performance.percentage : 50; // Use 50 if no prior performance
      return {
        id: domain.id,
        name: domain.name,
        weight: 100 - score + 10,
      };
    });

    const totalWeight = domainWeights.reduce((sum, d) => sum + d.weight, 0);
    const selectedQuestions: any[] = [];

    // Simple weighted random selection
    for (let i = 0; i < questionCount; i++) {
      let random = Math.random() * totalWeight;
      let selectedDomainId = domainWeights[0].id;

      for (const dw of domainWeights) {
        if (random < dw.weight) {
          selectedDomainId = dw.id;
          break;
        }
        random -= dw.weight;
      }

      // Find random approved question from this domain that hasn't been selected yet
      const question = await this.prisma.question.findFirst({
        where: {
          domainId: selectedDomainId,
          status: QuestionStatus.APPROVED,
          id: { notIn: selectedQuestions.map((q) => q.id) },
        },
        orderBy: { id: 'asc' }, // Will be randomized later
        skip: Math.floor(Math.random() * 5), // Simple random skip
      });

      if (question) {
        selectedQuestions.push(question);
      }
    }

    // If still need questions, fill with any approved questions from certification
    if (selectedQuestions.length < questionCount) {
      console.log(
        `Filling remaining ${questionCount - selectedQuestions.length} questions from entire certification ${certificationId}`,
      );
      const remaining = await this.prisma.question.findMany({
        where: {
          certificationId,
          status: QuestionStatus.APPROVED,
          id: { notIn: selectedQuestions.map((q) => q.id) },
        },
        take: questionCount - selectedQuestions.length,
      });
      selectedQuestions.push(...remaining);
    }

    console.log(`Final questions selected: ${selectedQuestions.length}`);

    if (selectedQuestions.length === 0) {
      throw new NotFoundException(
        'No approved questions found for this certification. Please ensure questions are approved in the admin panel.',
      );
    }

    // Create a PRIVATE, adaptive exam
    const exam = await this.prisma.exam.create({
      data: {
        title: `Weakness Training - ${certification.code} - ${new Date().toLocaleDateString()}`,
        description:
          'Auto-generated weakness training based on your performance.',
        certificationId,
        createdBy: userId,
        questionCount: selectedQuestions.length,
        timeLimit: selectedQuestions.length * 2, // 2 mins per question
        visibility: ExamVisibility.PRIVATE,
        isAdaptive: true,
        examQuestions: {
          create: selectedQuestions.map((q, index) => ({
            questionId: q.id,
            sortOrder: index,
          })),
        },
      },
      include: {
        certification: true,
      },
    });

    // Start attempt (AttemptsService style)
    const attempt = await this.prisma.examAttempt.create({
      data: {
        userId,
        examId: exam.id,
        totalQuestions: selectedQuestions.length,
      },
    });

    // Fetch questions with choices but WITHOUT isCorrect
    const fullQuestions = await this.prisma.question.findMany({
      where: { id: { in: selectedQuestions.map((q) => q.id) } },
      include: {
        choices: { orderBy: { sortOrder: 'asc' } },
        domain: true,
        tags: { include: { tag: true } },
      },
    });

    const shuffledQuestions = fullQuestions
      .sort(() => Math.random() - 0.5)
      .map((q, index) => ({
        id: q.id,
        title: q.title,
        description: q.description,
        questionType: q.questionType,
        difficulty: q.difficulty,
        domain: q.domain,
        tags: q.tags.map((t) => t.tag.name),
        choices: [...q.choices]
          .sort(() => Math.random() - 0.5)
          .map((c) => ({
            id: c.id,
            label: c.label,
            content: c.content,
            isCorrect: c.isCorrect,
          })),
        sortOrder: index,
      }));

    return {
      attemptId: attempt.id,
      examId: exam.id,
      title: exam.title,
      certification: {
        id: certification.id,
        name: certification.name,
        code: certification.code,
        provider: certification.provider?.name,
      },
      timeLimit: exam.timeLimit,
      totalQuestions: shuffledQuestions.length,
      questions: shuffledQuestions,
    };
  }
}
