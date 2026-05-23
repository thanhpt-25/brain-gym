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

  /**
   * GET /knowledge-graph/overlap?certId=<id>
   * Returns the cached cross-cert graph for a given source cert.
   */
  @Get('overlap')
  async getOverlap(@Query('certId') certId: string) {
    return this.kg.getGraph(certId);
  }

  /**
   * POST /knowledge-graph/overlap/:certId/compute
   * Trigger (re)computation of overlap for a cert.
   */
  @Post('overlap/:certId/compute')
  @HttpCode(HttpStatus.ACCEPTED)
  triggerCompute(@Param('certId') certId: string) {
    void this.kg.computeOverlaps(certId);
    return { message: 'Overlap computation enqueued', certId };
  }

  /**
   * GET /knowledge-graph/drill-down?certId=<id>&domainId=<id>
   * Returns skip-able vs must-learn topics relative to the caller's passed certs.
   */
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
   * GET /knowledge-graph/study-plan?targetCertId=<id>
   * Returns an optimised study plan for a target cert based on caller's history.
   */
  @Get('study-plan')
  async getStudyPlan(
    @CurrentUser('id') userId: string,
    @Query('targetCertId') targetCertId: string,
  ) {
    const passedCertIds = await this.getPassedCertIds(userId);
    return this.kg.generateStudyPlan(targetCertId, passedCertIds);
  }

  private async getPassedCertIds(userId: string): Promise<string[]> {
    const passed = await this.prisma.readinessScore.findMany({
      where: { userId, score: { gte: 70 } },
      select: { certificationId: true },
    });
    return passed.map((r) => r.certificationId);
  }
}
