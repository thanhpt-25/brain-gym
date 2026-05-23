import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';

interface ScheduleExamDayInput {
  examId: string;
  scheduledDate: Date;
}

interface ExamDayChecklist {
  id: string;
  examId: string;
  scheduledDate: Date;
  createdAt: Date;
  items: Array<{
    id: string;
    category: string;
    description: string;
    completed: boolean;
  }>;
}

@Controller('exams/exam-day')
@UseGuards(JwtAuthGuard)
export class ExamDayController {
  constructor(private prisma: PrismaService) {}

  @Post('schedule')
  async scheduleExamDay(
    @Body() input: ScheduleExamDayInput,
    @Request() req: any,
  ) {
    const userId = req.user.id;

    // Verify exam exists and belongs to user
    const exam = await this.prisma.exam.findUnique({
      where: { id: input.examId },
      include: { author: true },
    });

    if (!exam) {
      throw new BadRequestException('Exam not found');
    }

    // Allow scheduling if user created the exam or is taking it
    const isAuthor = exam.author.id === userId;
    const isAttempting = await this.prisma.examAttempt.findFirst({
      where: { examId: input.examId, userId },
    });

    if (!isAuthor && !isAttempting) {
      throw new BadRequestException(
        'You do not have permission to schedule this exam',
      );
    }

    // Create or update Exam Day schedule
    // For v1.5, we'll store this in user preferences as a simple JSON
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    const preferences = (user?.preferences as any) || {};
    if (!preferences.examDaySchedules) {
      preferences.examDaySchedules = [];
    }

    preferences.examDaySchedules = preferences.examDaySchedules.filter(
      (s: any) => s.examId !== input.examId,
    );

    preferences.examDaySchedules.push({
      examId: input.examId,
      scheduledDate: input.scheduledDate,
      createdAt: new Date(),
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: { preferences },
    });

    return {
      examId: input.examId,
      scheduledDate: input.scheduledDate,
      message:
        'Exam day scheduled. You will receive a reminder 24 hours before.',
    };
  }

  @Get('checklist/:examId')
  async getExamDayChecklist(
    @Param('examId') examId: string,
    @Request() req: any,
  ): Promise<ExamDayChecklist> {
    const userId = req.user.id;

    const exam = await this.prisma.exam.findUnique({
      where: { id: examId },
    });

    if (!exam) {
      throw new BadRequestException('Exam not found');
    }

    // Standard exam day checklist
    const checklist: ExamDayChecklist = {
      id: `checklist_${examId}`,
      examId,
      scheduledDate: new Date(),
      createdAt: new Date(),
      items: [
        {
          id: '1',
          category: 'Day Before',
          description: 'Review key concepts and formulas (60 min)',
          completed: false,
        },
        {
          id: '2',
          category: 'Day Before',
          description: 'Get adequate sleep (7-9 hours)',
          completed: false,
        },
        {
          id: '3',
          category: 'Day Before',
          description: 'Prepare materials: ID, calculator, notepads',
          completed: false,
        },
        {
          id: '4',
          category: 'Day Before',
          description: 'Set multiple alarms for exam start',
          completed: false,
        },
        {
          id: '5',
          category: 'Morning Of',
          description: 'Eat a healthy breakfast',
          completed: false,
        },
        {
          id: '6',
          category: 'Morning Of',
          description: 'Avoid caffeine 2 hours before exam',
          completed: false,
        },
        {
          id: '7',
          category: 'Morning Of',
          description: 'Arrive 15 min early to location',
          completed: false,
        },
        {
          id: '8',
          category: 'During Exam',
          description: "Read questions carefully (don't rush)",
          completed: false,
        },
        {
          id: '9',
          category: 'During Exam',
          description: 'Budget time: skip hard questions initially',
          completed: false,
        },
        {
          id: '10',
          category: 'During Exam',
          description: 'Review marked questions before submit',
          completed: false,
        },
      ],
    };

    return checklist;
  }

  @Get('upcoming')
  async getUpcomingExams(@Request() req: any) {
    const userId = req.user.id;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    const preferences = (user?.preferences as any) || {};
    const schedules = (preferences.examDaySchedules || []) as Array<{
      examId: string;
      scheduledDate: string;
      createdAt: string;
    }>;

    // Filter for exams scheduled in next 7 days
    const now = new Date();
    const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const upcoming = schedules
      .filter((s) => {
        const date = new Date(s.scheduledDate);
        return date >= now && date <= weekFromNow;
      })
      .sort(
        (a, b) =>
          new Date(a.scheduledDate).getTime() -
          new Date(b.scheduledDate).getTime(),
      );

    // Get exam details
    const examIds = upcoming.map((s) => s.examId);
    const exams = await this.prisma.exam.findMany({
      where: { id: { in: examIds } },
      select: {
        id: true,
        title: true,
        timeLimit: true,
        certification: { select: { code: true, name: true } },
      },
    });

    return upcoming.map((schedule) => {
      const exam = exams.find((e) => e.id === schedule.examId);
      const hoursUntilExam = Math.round(
        (new Date(schedule.scheduledDate).getTime() - Date.now()) /
          (1000 * 60 * 60),
      );

      return {
        examId: schedule.examId,
        title: exam?.title || 'Unknown Exam',
        certification: exam?.certification,
        timeLimit: exam?.timeLimit,
        scheduledDate: schedule.scheduledDate,
        hoursUntil: hoursUntilExam,
        sendReminderSoon: hoursUntilExam <= 24,
      };
    });
  }
}
