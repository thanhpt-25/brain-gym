import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

interface CoachSessionResponse {
  id: string;
  messages: Array<{ id: string; role: string; content: string; timestamp: string }>;
  createdAt: string;
  sessionCount: number;
}

@Injectable()
export class CoachService {
  constructor(private prisma: PrismaService) {}

  async getOrCreateCoachSession(userId: string): Promise<CoachSessionResponse> {
    const session = await this.prisma.coachSession.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 1,
    });

    if (!session) {
      const newSession = await this.prisma.coachSession.create({
        data: {
          userId,
          messages: [],
          costUsd: 0,
        },
      });

      return {
        id: newSession.id,
        messages: [],
        createdAt: newSession.createdAt.toISOString(),
        sessionCount: 1,
      };
    }

    // Count sessions today for rate limiting
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const sessionCount = await this.prisma.coachSession.count({
      where: {
        userId,
        createdAt: {
          gte: today,
        },
      },
    });

    return {
      id: session.id,
      messages: session.messages || [],
      createdAt: session.createdAt.toISOString(),
      sessionCount,
    };
  }

  async getSessionCount(userId: string): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return this.prisma.coachSession.count({
      where: {
        userId,
        createdAt: {
          gte: today,
        },
      },
    });
  }
}
