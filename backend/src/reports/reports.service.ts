import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReportDto } from './dto/create-report.dto';
import { UpdateReportDto } from './dto/update-report.dto';
import { ReportStatus } from '@prisma/client';

const userSelect = { id: true, displayName: true, avatarUrl: true };

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, questionId: string, dto: CreateReportDto) {
    const question = await this.prisma.question.findUnique({ where: { id: questionId } });
    if (!question) throw new NotFoundException('Question not found');

    // Prevent duplicate pending reports from same user on same question
    const existing = await this.prisma.report.findFirst({
      where: { userId, questionId, status: ReportStatus.PENDING },
    });
    if (existing) throw new BadRequestException('You already have a pending report for this question');

    return this.prisma.report.create({
      data: { userId, questionId, reason: dto.reason, description: dto.description },
      include: { user: { select: userSelect }, question: { select: { id: true, title: true } } },
    });
  }

  async findAll(status?: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const where = status ? { status: status as ReportStatus } : {};

    const [total, reports] = await Promise.all([
      this.prisma.report.count({ where }),
      this.prisma.report.findMany({
        where,
        include: {
          user: { select: userSelect },
          question: { select: { id: true, title: true, certificationId: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return { data: reports, meta: { total, page, lastPage: Math.ceil(total / limit) } };
  }

  async update(reportId: string, dto: UpdateReportDto) {
    const report = await this.prisma.report.findUnique({ where: { id: reportId } });
    if (!report) throw new NotFoundException('Report not found');

    return this.prisma.report.update({
      where: { id: reportId },
      data: { status: dto.status },
      include: { user: { select: userSelect }, question: { select: { id: true, title: true } } },
    });
  }
}
