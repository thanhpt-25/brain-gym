import { Controller, Get, Param, Query, UseGuards, Req, Body, Patch } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiBody, ApiResponse } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from '../common/decorators/public.decorator';
import { UpdateMistakeTypeDto } from './dto/update-mistake-type.dto';
import type { AuthenticatedRequest } from '../common/interfaces/request.interface';
import {
  AnalyticsSummaryResponse,
  AnalyticsHistoryResponse,
  DomainStatsResponse,
  ReadinessResponse,
  MistakePatternsResponse,
} from './dto/analytics-response.dto';

@ApiTags('analytics')
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('me/summary')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get aggregate stats for current user' })
  @ApiQuery({ name: 'certificationId', required: false })
  @ApiResponse({ status: 200, type: AnalyticsSummaryResponse })
  getSummary(@Req() req: AuthenticatedRequest, @Query('certificationId') certificationId?: string) {
    const userId = req.user.id;
    return this.analyticsService.getSummary(userId, certificationId);
  }

  @Get('me/history')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get exam attempt history with scores' })
  @ApiQuery({ name: 'certificationId', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, type: AnalyticsHistoryResponse })
  getHistory(
    @Req() req: AuthenticatedRequest,
    @Query('certificationId') certificationId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const userId = req.user.id;
    return this.analyticsService.getHistory(userId, certificationId, page ? +page : 1, limit ? +limit : 20);
  }

  @Get('me/hesitation')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get questions where user hesitates (avg time > 2× per-question budget)' })
  getHesitationPatterns(@Req() req: AuthenticatedRequest) {
    const userId = req.user.id;
    return this.analyticsService.getHesitationPatterns(userId);
  }

  @Get('me/domains')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get per-domain performance across all attempts' })
  @ApiQuery({ name: 'certificationId', required: false })
  @ApiResponse({ status: 200, type: [DomainStatsResponse] })
  getDomains(@Req() req: AuthenticatedRequest, @Query('certificationId') certificationId?: string) {
    const userId = req.user.id;
    return this.analyticsService.getDomains(userId, certificationId);
  }

  @Get('me/weak-topics')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get weakest domains/topics' })
  @ApiQuery({ name: 'certificationId', required: false })
  @ApiQuery({ name: 'topN', required: false, type: Number })
  @ApiResponse({ status: 200, type: [DomainStatsResponse] })
  getWeakTopics(
    @Req() req: AuthenticatedRequest,
    @Query('certificationId') certificationId?: string,
    @Query('topN') topN?: string,
  ) {
    const userId = req.user.id;
    return this.analyticsService.getWeakTopics(userId, certificationId, topN ? +topN : 5);
  }

  @Get('questions/:id/stats')
  @Public()
  @ApiOperation({ summary: 'Get question-level stats (attempt count, correct rate)' })
  getQuestionStats(@Param('id') id: string) {
    return this.analyticsService.getQuestionStats(id);
  }

  @Get('readiness/:certificationId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get readiness score for a specific certification' })
  @ApiResponse({ status: 200, type: ReadinessResponse })
  getReadiness(@Req() req: AuthenticatedRequest, @Param('certificationId') certificationId: string) {
    const userId = req.user.id;
    return this.analyticsService.getReadiness(userId, certificationId);
  }

  @Patch('answers/:answerId/mistake-type')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update mistake type for a specific answer' })
  @ApiBody({ type: UpdateMistakeTypeDto })
  updateMistakeType(
    @Req() req: AuthenticatedRequest,
    @Param('answerId') answerId: string,
    @Body() dto: UpdateMistakeTypeDto,
  ) {
    const userId = req.user.id;
    return this.analyticsService.updateMistakeType(userId, answerId, dto);
  }

  @Get('mistake-patterns')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get mistake patterns aggregation' })
  @ApiQuery({ name: 'certificationId', required: false })
  @ApiResponse({ status: 200, type: MistakePatternsResponse })
  getMistakePatterns(@Req() req: AuthenticatedRequest, @Query('certificationId') certificationId?: string) {
    const userId = req.user.id;
    return this.analyticsService.getMistakePatterns(userId, certificationId);
  }
}
