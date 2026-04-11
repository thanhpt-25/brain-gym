import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TagsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(certificationId?: string) {
    return this.prisma.tag.findMany({
      where: { certificationId: certificationId || undefined },
      include: { _count: { select: { questions: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async create(name: string, certificationId?: string) {
    return this.prisma.tag.create({
      data: { name, certificationId: certificationId || null },
      include: { _count: { select: { questions: true } } },
    });
  }

  async update(id: string, name: string) {
    return this.prisma.tag.update({
      where: { id },
      data: { name },
      include: { _count: { select: { questions: true } } },
    });
  }

  async remove(id: string) {
    const questionCount = await this.prisma.questionTag.count({
      where: { tagId: id },
    });
    if (questionCount > 0) {
      throw new BadRequestException(
        `Cannot delete tag used by ${questionCount} questions`,
      );
    }
    return this.prisma.tag.delete({ where: { id } });
  }

  async merge(sourceIds: string[], targetId: string) {
    // Reassign all question-tag links from source tags to target
    for (const sourceId of sourceIds) {
      const links = await this.prisma.questionTag.findMany({
        where: { tagId: sourceId },
      });
      for (const link of links) {
        await this.prisma.questionTag.upsert({
          where: {
            questionId_tagId: { questionId: link.questionId, tagId: targetId },
          },
          create: { questionId: link.questionId, tagId: targetId },
          update: {},
        });
      }
      await this.prisma.questionTag.deleteMany({ where: { tagId: sourceId } });
      await this.prisma.tag.delete({ where: { id: sourceId } });
    }
    return this.prisma.tag.findUnique({
      where: { id: targetId },
      include: { _count: { select: { questions: true } } },
    });
  }
}
