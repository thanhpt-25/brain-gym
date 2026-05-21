import {
  Controller,
  Get,
  Post,
  Param,
  UseGuards,
  Request,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { BurnoutDetector } from './burnout.detector';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('training/burnout')
@UseGuards(JwtAuthGuard)
export class BurnoutController {
  constructor(
    private burnoutDetector: BurnoutDetector,
    private prisma: PrismaService,
  ) {}

  @Get('current')
  async getCurrentBurnoutStatus(@Request() req: any) {
    const userId = req.user.id;

    // Get unacknowledged burnout signals from last 24h
    const signals = await this.prisma.burnoutSignal.findMany({
      where: {
        userId,
        acknowledged: false,
        detectedAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      },
      orderBy: { detectedAt: 'desc' },
      take: 1,
    });

    if (signals.length === 0) {
      return {
        hasBurnout: false,
        signal: null,
      };
    }

    const signal = signals[0];
    return {
      hasBurnout: true,
      signal: {
        id: signal.id,
        severity: signal.severity,
        signals: signal.signals,
        recommendedAction: signal.recommendedAction,
        detectedAt: signal.detectedAt,
      },
    };
  }

  @Get('history')
  async getBurnoutHistory(@Request() req: any) {
    const userId = req.user.id;

    const signals = await this.prisma.burnoutSignal.findMany({
      where: { userId },
      orderBy: { detectedAt: 'desc' },
      take: 10,
    });

    return signals.map((s) => ({
      id: s.id,
      severity: s.severity,
      detectedAt: s.detectedAt,
      acknowledgedAt: s.acknowledgedAt,
      recommendedAction: s.recommendedAction,
    }));
  }

  @Post(':signalId/acknowledge')
  async acknowledgeBurnoutSignal(
    @Param('signalId') signalId: string,
    @Request() req: any,
  ) {
    const userId = req.user.id;

    const signal = await this.prisma.burnoutSignal.findUnique({
      where: { id: signalId },
    });

    if (!signal || signal.userId !== userId) {
      throw new BadRequestException('Signal not found');
    }

    const updated = await this.prisma.burnoutSignal.update({
      where: { id: signalId },
      data: {
        acknowledged: true,
        acknowledgedAt: new Date(),
      },
    });

    return {
      id: updated.id,
      acknowledged: updated.acknowledged,
      acknowledgedAt: updated.acknowledgedAt,
    };
  }

  @Post('check-now')
  async checkBurnoutNow(@Request() req: any) {
    const userId = req.user.id;

    const result = await this.burnoutDetector.checkUserBurnout(userId);

    return {
      severity: result?.severity || 'low',
      signals: result?.signals || [],
      recommendedAction: result?.recommendedAction || 'NO_ACTION',
    };
  }
}
