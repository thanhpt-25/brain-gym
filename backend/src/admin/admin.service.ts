import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard() {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      newUsers7d,
      newUsers30d,
      questionsByStatus,
      totalExams,
      totalAttempts,
      pendingReports,
      totalProviders,
      totalCertifications,
      aiGenerationStats,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
      this.prisma.user.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      this.prisma.question.groupBy({
        by: ['status'],
        _count: true,
        where: { deletedAt: null },
      }),
      this.prisma.exam.count(),
      this.prisma.examAttempt.count(),
      this.prisma.report.count({ where: { status: 'PENDING' } }),
      this.prisma.provider.count({ where: { isActive: true } }),
      this.prisma.certification.count({ where: { isActive: true } }),
      this.prisma.questionGenerationJob.groupBy({
        by: ['status'],
        _count: true,
      }),
    ]);

    const statusMap: Record<string, number> = {};
    for (const item of questionsByStatus) {
      statusMap[item.status] = item._count;
    }

    const aiStatsMap: Record<string, number> = {};
    for (const item of aiGenerationStats) {
      aiStatsMap[item.status] = item._count;
    }

    return {
      users: {
        total: totalUsers,
        newLast7d: newUsers7d,
        newLast30d: newUsers30d,
      },
      questions: {
        draft: statusMap['DRAFT'] || 0,
        pending: statusMap['PENDING'] || 0,
        approved: statusMap['APPROVED'] || 0,
        rejected: statusMap['REJECTED'] || 0,
        total: Object.values(statusMap).reduce((a, b) => a + b, 0),
      },
      exams: { total: totalExams },
      attempts: { total: totalAttempts },
      reports: { pending: pendingReports },
      providers: { total: totalProviders },
      certifications: { total: totalCertifications },
      aiGeneration: {
        pending: aiStatsMap['PENDING'] || 0,
        processing: aiStatsMap['PROCESSING'] || 0,
        completed: aiStatsMap['COMPLETED'] || 0,
        failed: aiStatsMap['FAILED'] || 0,
      },
    };
  }

  async getExams(params: { page?: number; limit?: number; visibility?: string }) {
    const { page = 1, limit = 20, visibility } = params;
    const where: any = {};
    if (visibility) where.visibility = visibility;

    const [data, total] = await Promise.all([
      this.prisma.exam.findMany({
        where,
        include: {
          author: { select: { id: true, displayName: true, email: true } },
          certification: { select: { id: true, name: true, code: true } },
          _count: { select: { attempts: true, examQuestions: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.exam.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, lastPage: Math.ceil(total / limit) },
    };
  }

  async getGenerationJobs(params: { page?: number; limit?: number; status?: string }) {
    const { page = 1, limit = 20, status } = params;
    const where: any = {};
    if (status) where.status = status;

    const [data, total] = await Promise.all([
      this.prisma.questionGenerationJob.findMany({
        where,
        include: {
          user: { select: { id: true, displayName: true, email: true } },
          certification: { select: { id: true, name: true, code: true } },
          domain: { select: { id: true, name: true } },
          _count: { select: { questions: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.questionGenerationJob.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, lastPage: Math.ceil(total / limit) },
    };
  }

  async getDomains(params: { certificationId?: string; page?: number; limit?: number }) {
    const { certificationId, page = 1, limit = 50 } = params;
    const where: any = {};
    if (certificationId) where.certificationId = certificationId;

    const [data, total] = await Promise.all([
      this.prisma.domain.findMany({
        where,
        include: {
          certification: { select: { id: true, name: true, code: true } },
          _count: { select: { questions: true } },
        },
        orderBy: [{ certification: { name: 'asc' } }, { name: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.domain.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, lastPage: Math.ceil(total / limit) },
    };
  }
}
