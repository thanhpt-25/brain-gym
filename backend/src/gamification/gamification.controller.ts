import { Controller, Get, Param, Query, UseGuards, Req } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { GamificationService } from './gamification.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('gamification')
@Controller()
export class GamificationController {
  constructor(private readonly gamificationService: GamificationService) {}

  @Get('leaderboard')
  @Public()
  @ApiOperation({
    summary: 'Get leaderboard — by points (global) or best score (per cert)',
  })
  @ApiQuery({ name: 'certificationId', required: false })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getLeaderboard(
    @Query('certificationId') certificationId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.gamificationService.getLeaderboard(
      certificationId,
      limit ? +limit : 20,
    );
  }

  @Get('badges')
  @Public()
  @ApiOperation({ summary: 'List all available badges' })
  getBadges() {
    return this.gamificationService.getBadges();
  }

  @Get('users/:userId/badges')
  @Public()
  @ApiOperation({ summary: "Get a user's earned badges" })
  getUserBadges(@Param('userId') userId: string) {
    return this.gamificationService.getUserBadges(userId);
  }

  @Get('me/points')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user points' })
  getMyPoints(@Req() req: any) {
    const userId = req.user.sub || req.user.id;
    return this.gamificationService.getUserPoints(userId);
  }
}
