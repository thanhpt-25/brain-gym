import { Controller, Get, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('analytics')
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('me/summary')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get aggregate stats for current user' })
  @ApiQuery({ name: 'certificationId', required: false })
  getSummary(@Req() req: any, @Query('certificationId') certificationId?: string) {
    const userId = req.user.sub || req.user.id;
    return this.analyticsService.getSummary(userId, certificationId);
  }

  @Get('me/history')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get exam attempt history with scores' })
  @ApiQuery({ name: 'certificationId', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getHistory(
    @Req() req: any,
    @Query('certificationId') certificationId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const userId = req.user.sub || req.user.id;
    return this.analyticsService.getHistory(userId, certificationId, page ? +page : 1, limit ? +limit : 20);
  }

  @Get('me/domains')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get per-domain performance across all attempts' })
  @ApiQuery({ name: 'certificationId', required: false })
  getDomains(@Req() req: any, @Query('certificationId') certificationId?: string) {
    const userId = req.user.sub || req.user.id;
    return this.analyticsService.getDomains(userId, certificationId);
  }

  @Get('me/weak-topics')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get weakest domains/topics' })
  @ApiQuery({ name: 'certificationId', required: false })
  @ApiQuery({ name: 'topN', required: false, type: Number })
  getWeakTopics(
    @Req() req: any,
    @Query('certificationId') certificationId?: string,
    @Query('topN') topN?: string,
  ) {
    const userId = req.user.sub || req.user.id;
    return this.analyticsService.getWeakTopics(userId, certificationId, topN ? +topN : 5);
  }

  @Get('questions/:id/stats')
  @Public()
  @ApiOperation({ summary: 'Get question-level stats (attempt count, correct rate)' })
  getQuestionStats(@Param('id') id: string) {
    return this.analyticsService.getQuestionStats(id);
  }
}
