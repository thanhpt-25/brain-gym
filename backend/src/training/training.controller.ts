import { Controller, Post, Body, UseGuards, Req, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { TrainingService } from './training.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { StartWeaknessTrainingDto } from './dto/start-weakness-training.dto';
import { SubmitReviewDto } from './dto/submit-review.dto';

@ApiTags('training')
@Controller('training')
export class TrainingController {
  constructor(private readonly trainingService: TrainingService) {} // Trigger reload fix

  @Post('weakness/start')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Start a weakness-targeted training session' })
  startWeaknessTraining(@Req() req: any, @Body() dto: StartWeaknessTrainingDto) {
    const userId = req.user.id || req.user.sub;
    return this.trainingService.startWeaknessTraining(userId, dto);
  }

  @Post('review')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Submit a spaced repetition review quality' })
  submitReview(@Req() req: any, @Body() dto: SubmitReviewDto) {
    const userId = req.user.id || req.user.sub;
    return this.trainingService.submitReview(userId, dto);
  }

  @Get('due-reviews')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get questions due for review' })
  @ApiQuery({ name: 'certificationId', required: false })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getDueReviews(
    @Req() req: any,
    @Query('certificationId') certificationId?: string,
    @Query('limit') limit?: string,
  ) {
    const userId = req.user.id || req.user.sub;
    return this.trainingService.getDueReviews(userId, certificationId, limit ? +limit : undefined);
  }
}
