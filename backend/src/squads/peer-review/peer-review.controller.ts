import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { SubmitExplanationDto } from './peer-review.service';
import { PeerReviewService } from './peer-review.service';

@Controller('squads/peer-review')
@UseGuards(AuthGuard('jwt'))
export class PeerReviewController {
  constructor(private readonly peerReview: PeerReviewService) {}

  /**
   * POST /squads/peer-review/explanations
   * Submit or update an explanation for a question within a squad.
   */
  @Post('explanations')
  @HttpCode(HttpStatus.CREATED)
  async submit(
    @CurrentUser('id') userId: string,
    @Body() dto: SubmitExplanationDto,
  ) {
    return this.peerReview.submitExplanation(userId, dto);
  }

  /**
   * GET /squads/peer-review/explanations?questionId=&squadId=
   * List explanations for a question within a squad.
   */
  @Get('explanations')
  async list(
    @Query('questionId') questionId: string,
    @Query('squadId') squadId: string,
  ) {
    return this.peerReview.listForQuestion(questionId, squadId);
  }

  /**
   * GET /squads/peer-review/explanations/top?questionId=
   * List top (community-endorsed) explanations across all squads.
   */
  @Get('explanations/top')
  async listTop(@Query('questionId') questionId: string) {
    return this.peerReview.listTopForQuestion(questionId);
  }

  /**
   * POST /squads/peer-review/explanations/:explanationId/vote
   * Cast an upvote on a peer explanation.
   */
  @Post('explanations/:explanationId/vote')
  @HttpCode(HttpStatus.OK)
  async vote(
    @Param('explanationId') explanationId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.peerReview.vote(userId, explanationId);
  }
}
