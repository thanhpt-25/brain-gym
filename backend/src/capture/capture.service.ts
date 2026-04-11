import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCaptureDto } from './dto/create-capture.dto';

@Injectable()
export class CaptureService {
  constructor(private prisma: PrismaService) {}

  async captureWord(userId: string, dto: CreateCaptureDto) {
    return this.prisma.capturedWord.create({
      data: {
        ...dto,
        userId,
      },
    });
  }

  async getPendingCaptures(userId: string) {
    return this.prisma.capturedWord.findMany({
      where: {
        userId,
        status: 'pending',
      },
      include: {
        question: {
          select: {
            title: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async updateStatus(
    userId: string,
    id: string,
    status: 'processed' | 'discarded',
  ) {
    const capture = await this.prisma.capturedWord.findUnique({
      where: { id },
    });

    if (!capture || capture.userId !== userId) {
      throw new NotFoundException('Captured word not found');
    }

    return this.prisma.capturedWord.update({
      where: { id },
      data: { status },
    });
  }

  async deleteCapture(userId: string, id: string) {
    const capture = await this.prisma.capturedWord.findUnique({
      where: { id },
    });

    if (!capture || capture.userId !== userId) {
      throw new NotFoundException('Captured word not found');
    }

    return this.prisma.capturedWord.delete({
      where: { id },
    });
  }
}
