import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { KnowledgeGraphService } from './knowledge-graph.service';
import { PrismaService } from '../prisma/prisma.service';

@Controller('knowledge-graph')
@UseGuards(AuthGuard('jwt'))
export class KnowledgeGraphController {
  constructor(
    private readonly kg: KnowledgeGraphService,
    private readonly prisma: PrismaService,
  ) {}

  /** GET /knowledge-graph/overlap?certId=<id> */
  @Get('overlap')
  async getOverlap(@Query('certId') certId: string) {
    return this.kg.getGraph(certId);
  }

  /**
   * POST /knowledge-graph/overlap/:certId/compute
   * US-1001: Enqueues async BullMQ job; returns jobId immediately (202).
   */
  @Post('overlap/:certId/compute')
  @HttpCode(HttpStatus.ACCEPTED)
  async triggerCompute(@Param('certId') certId: string) {
    const { jobId } = await this.kg.enqueueOverlapCompute(certId);
    return { message: 'Overlap computation enqueued', certId, jobId };
  }

  /** GET /knowledge-graph/drill-down?certId=<id>&domainId=<id> */
  @Get('drill-down')
  async getDrillDown(
    @CurrentUser('id') userId: string,
    @Query('certId') certId: string,
    @Query('domainId') domainId?: string,
  ) {
    const passedCertIds = await this.getPassedCertIds(userId);
    return this.kg.getDrillDown(certId, domainId ?? null, passedCertIds);
  }

  /**
   * POST /knowledge-graph/study-plan?targetCertId=<id>
   * US-1002: Generates and persists a study plan; returns saved plan with id.
   */
  @Post('study-plan')
  @HttpCode(HttpStatus.CREATED)
  async createStudyPlan(
    @CurrentUser('id') userId: string,
    @Query('targetCertId') targetCertId: string,
  ) {
    const passedCertIds = await this.getPassedCertIds(userId);
    return this.kg.generateStudyPlan(userId, targetCertId, passedCertIds);
  }

  /** GET /knowledge-graph/study-plans — list saved plans for the caller */
  @Get('study-plans')
  async listStudyPlans(@CurrentUser('id') userId: string) {
    return this.kg.listStudyPlans(userId);
  }

  /**
   * POST /knowledge-graph/study-plans/:planId/schedule
   * US-1104: Generate ReviewSchedule entries for must-learn topics in the plan.
   */
  @Post('study-plans/:planId/schedule')
  @HttpCode(HttpStatus.OK)
  async scheduleFromPlan(
    @CurrentUser('id') userId: string,
    @Param('planId') planId: string,
  ) {
    return this.kg.scheduleFromPlan(userId, planId);
  }

  private async getPassedCertIds(userId: string): Promise<string[]> {
    const passed = await this.prisma.readinessScore.findMany({
      where: { userId, score: { gte: 70 } },
      select: { certificationId: true },
    });
    return passed.map((r) => r.certificationId);
  }
}
