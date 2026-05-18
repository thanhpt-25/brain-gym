import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ScenariosService } from './scenarios.service';

@Controller('scenarios')
@UseGuards(JwtAuthGuard)
export class ScenariosController {
  constructor(private scenariosService: ScenariosService) {}

  /**
   * GET /scenarios/:id
   * Fetch a scenario with its questions for the reader UI
   */
  @Get(':id')
  async getScenario(@Param('id') scenarioId: string) {
    const scenario =
      await this.scenariosService.getScenarioWithQuestions(scenarioId);
    if (!scenario) {
      throw new Error(`Scenario ${scenarioId} not found`);
    }
    return scenario;
  }

  /**
   * POST /scenarios/:id/attempts
   * Submit a scenario attempt and record score
   */
  @Post(':id/attempts')
  async submitScenarioAttempt(
    @Param('id') scenarioId: string,
    @Body() attemptData: { answers: Record<string, string> },
    @Request() req: any,
  ) {
    const userId = req.user.id;
    const result = await this.scenariosService.submitAttempt(
      userId,
      scenarioId,
      attemptData.answers,
    );
    return result;
  }

  /**
   * GET /scenarios/:id/leaderboard
   * Fetch scenario leaderboard (top 50 by score)
   */
  @Get(':id/leaderboard')
  async getScenarioLeaderboard(@Param('id') scenarioId: string) {
    return await this.scenariosService.getScenarioLeaderboard(scenarioId);
  }

  /**
   * GET /user/scenarios/progress
   * Fetch user's scenario progress and leaderboard data
   */
  @Get('user/progress')
  async getUserScenarioProgress(@Request() req: any) {
    const userId = req.user.id;
    const progress =
      await this.scenariosService.getUserScenarioProgress(userId);
    return progress;
  }
}
