import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  Request,
  Res,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CoachService } from './coach.service';

interface CoachSessionResponse {
  id: string;
  messages: Array<{
    id: string;
    role: string;
    content: string;
    timestamp: string;
  }>;
  createdAt: string;
  sessionCount: number;
}

/**
 * Coach Feature Controller
 *
 * TIER-LOCK REQUIREMENTS:
 * - Free tier: ❌ No access to coach feature (returns 403 Forbidden)
 * - Pro tier: ✅ Full access with 10 sessions per day limit
 * - Elite tier: ✅ Full access with unlimited sessions
 *
 * All endpoints require JWT authentication and validate session ownership.
 * Tier checks are enforced at the service level via CoachService.sendMessage().
 */
@Controller('training/coach')
@UseGuards(JwtAuthGuard)
export class CoachController {
  constructor(private coachService: CoachService) {}

  /**
   * Get or create a coach session for the authenticated user
   *
   * @param userId - User ID (must match authenticated user)
   * @param req - Express request with authenticated user
   * @returns CoachSessionResponse with session ID, messages, and session count
   * @throws Error if userId doesn't match authenticated user (unauthorized)
   */
  @Get('session/:userId')
  async getCoachSession(
    @Param('userId') userId: string,
    @Request() req: any,
  ): Promise<CoachSessionResponse> {
    if (req.user.id !== userId) {
      throw new Error('Unauthorized');
    }
    return this.coachService.getOrCreateCoachSession(userId);
  }

  /**
   * Get the current session count for the authenticated user (today)
   *
   * Used by frontend to display rate limit status.
   * Pro tier users can see when they're approaching the 10 sessions/day limit.
   *
   * @param req - Express request with authenticated user
   * @returns Object with sessionCount (number of sessions created today)
   */
  @Get('session-count')
  async getSessionCount(
    @Request() req: any,
  ): Promise<{ sessionCount: number }> {
    const count = await this.coachService.getSessionCount(req.user.id);
    return { sessionCount: count };
  }

  /**
   * Send a message to the coach and receive an LLM-generated response via Server-Sent Events
   *
   * TIER GATING:
   * - Free tier: Returns 403 Forbidden (feature not available)
   * - Pro tier: Allows up to 10 sessions per day
   *   If limit reached, returns 400 Bad Request with "Daily session limit reached"
   * - Elite tier: No session limits
   *
   * SAFETY:
   * - All messages are validated for jailbreak attempts via CoachSafetyService
   * - Session ownership is verified (session.userId must match authenticated user.id)
   * - SSE streaming is used for real-time response delivery
   *
   * @param sessionId - Coach session ID (must be owned by authenticated user)
   * @param body - Request body with message string
   * @param req - Express request with authenticated user
   * @param res - Express response for SSE streaming
   * @throws BadRequestException if message is empty or session limit reached
   * @throws ForbiddenException if user tier doesn't have coach access
   * @throws BadRequestException if session not found or unauthorized
   */
  @Post('session/:sessionId/message')
  async sendMessage(
    @Param('sessionId') sessionId: string,
    @Body() body: { message: string },
    @Request() req: any,
    @Res() res: any,
  ): Promise<void> {
    // H-1: Enforce free-tier gate - free tier users cannot access coach
    const userTier = req.user.subscriptionTier || req.user.plan || 'free';
    if (userTier === 'free' || userTier === 'FREE') {
      throw new ForbiddenException(
        'Coach feature is not available on free tier. Please upgrade to Pro or Elite tier.',
      );
    }

    if (!body.message || body.message.trim().length === 0) {
      throw new BadRequestException('Message cannot be empty');
    }

    // Stream response as Server-Sent Events
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');

    try {
      const stream = await this.coachService.sendMessage(
        sessionId,
        req.user.id,
        body.message,
      );

      for await (const chunk of stream) {
        res.write(`data: ${JSON.stringify({ delta: chunk })}\n\n`);
      }

      res.write('data: [DONE]\n\n');
      res.end();
    } catch (error) {
      res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
      res.end();
    }
  }

  /**
   * Get analytics overview for all coach sessions belonging to the authenticated user
   *
   * Returns aggregated statistics on coach usage including:
   * - Total number of sessions created
   * - Average messages per session
   * - Average response time from LLM
   * - Distribution of topics discussed
   * - Session frequency over time
   *
   * @param req - Express request with authenticated user
   * @returns Analytics object with usage statistics
   */
  @Get('analytics')
  async getAnalytics(@Request() req: any): Promise<any> {
    return this.coachService.getAnalytics(req.user.id);
  }

  /**
   * Get detailed analysis of a single coach session including effectiveness metrics
   *
   * Returns metadata and analysis for a specific session:
   * - Total message count (user + assistant)
   * - Session duration (from creation to last message)
   * - Topics discussed (extracted from conversation)
   * - User sentiment trend (positive keywords detection)
   * - Session effectiveness score (ratio of positive content)
   *
   * AUTHORIZATION: Session must belong to authenticated user (enforced via RLS check)
   *
   * @param sessionId - ID of the coach session to analyze
   * @param req - Express request with authenticated user
   * @returns Session analysis object with metrics and conversation details
   * @throws BadRequestException if session not found or not owned by user
   */
  @Get('session/:sessionId/analysis')
  async getSessionAnalysis(
    @Param('sessionId') sessionId: string,
    @Request() req: any,
  ): Promise<any> {
    return this.coachService.getSessionAnalysis(sessionId, req.user.id);
  }
}
