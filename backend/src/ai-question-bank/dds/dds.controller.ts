import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Request,
  ForbiddenException,
  TooManyRequestsException,
  BadRequestException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { DdsService } from './dds.service';
import { DdsReason, UserRole } from '@prisma/client';

class ProposeVariantDto {
  reason?: DdsReason;
}

class ReviewVariantDto {
  reviewNote?: string;
}

/**
 * US-1107: Gate 2 readiness data structure.
 * Surfaces approval progress toward promotion threshold.
 */
class GateReadinessDto {
  /** Current count of clean approvals (APPROVED status, not rolled back) */
  cleanApprovals: number;

  /** Minimum threshold required for promotion (default 30) */
  threshold: number;

  /** Total count of rolled-back variants */
  rollbackCount: number;

  /** Timestamp of the most recent rollback, or null if none */
  lastRollbackAt: Date | null;

  /** Readiness to promote: true if cleanApprovals >= threshold AND rollbackCount === 0 */
  readyToPromote: boolean;

  /** Progress as percentage (0-100), for UI progress bar */
  progressPercent: number;
}

/**
 * Simple in-memory rate limiter for H-5: tryAutoApply endpoint protection
 * Tracks requests per user/minute to prevent abuse
 */
class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  private readonly windowMs = 60000; // 1 minute
  private readonly maxRequests = 5; // Max 5 requests per minute

  isAllowed(userId: string): boolean {
    const now = Date.now();
    const userRequests = this.requests.get(userId) || [];

    // Remove old requests outside the window
    const recentRequests = userRequests.filter(
      (time) => now - time < this.windowMs,
    );

    if (recentRequests.length >= this.maxRequests) {
      return false;
    }

    // Add current request
    recentRequests.push(now);
    this.requests.set(userId, recentRequests);

    return true;
  }
}

@Controller('ai-question-bank/dds')
@UseGuards(AuthGuard('jwt'))
export class DdsController {
  private rateLimiter = new RateLimiter();

  constructor(private readonly dds: DdsService) {}

  /** POST /ai-question-bank/dds/questions/:questionId/propose */
  @Post('questions/:questionId/propose')
  @HttpCode(HttpStatus.CREATED)
  async propose(
    @Param('questionId') questionId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: ProposeVariantDto,
  ) {
    return this.dds.proposeVariant(
      questionId,
      dto.reason ?? DdsReason.DDS_HARDEN,
      userId,
    );
  }

  /** GET /ai-question-bank/dds/pending */
  @Get('pending')
  async listPending(@Query('limit') limit?: string) {
    return this.dds.listPending(limit ? parseInt(limit, 10) : 20);
  }

  /** GET /ai-question-bank/dds/questions/:questionId */
  @Get('questions/:questionId')
  async listForQuestion(@Param('questionId') questionId: string) {
    return this.dds.listForQuestion(questionId);
  }

  /** PATCH /ai-question-bank/dds/variants/:variantId/approve */
  @Patch('variants/:variantId/approve')
  async approve(
    @Param('variantId') variantId: string,
    @CurrentUser('id') reviewerId: string,
    @Body() dto: ReviewVariantDto,
  ) {
    return this.dds.approve(variantId, reviewerId, dto.reviewNote);
  }

  /** PATCH /ai-question-bank/dds/variants/:variantId/reject */
  @Patch('variants/:variantId/reject')
  async reject(
    @Param('variantId') variantId: string,
    @CurrentUser('id') reviewerId: string,
    @Body() dto: ReviewVariantDto,
  ) {
    return this.dds.reject(variantId, reviewerId, dto.reviewNote);
  }

  /** PATCH /ai-question-bank/dds/variants/:variantId/rollback */
  @Patch('variants/:variantId/rollback')
  async rollback(
    @Param('variantId') variantId: string,
    @CurrentUser('id') reviewerId: string,
  ) {
    return this.dds.rollback(variantId, reviewerId);
  }

  /** POST /ai-question-bank/dds/variants/:variantId/auto-apply */
  @Post('variants/:variantId/auto-apply')
  async tryAutoApply(
    @Param('variantId') variantId: string,
    @Request() req: any,
  ) {
    // H-5: Add role check + rate limiting to tryAutoApply endpoint
    // Only REVIEWER and ADMIN roles can trigger auto-apply
    const userRole = req.user?.role;
    if (
      !userRole ||
      (userRole !== UserRole.REVIEWER && userRole !== UserRole.ADMIN)
    ) {
      throw new ForbiddenException(
        'You do not have permission to trigger auto-apply. Only reviewers and admins can perform this action.',
      );
    }

    // Rate limit: max 5 requests per minute per user
    const userId = req.user?.id;
    if (!userId || !this.rateLimiter.isAllowed(userId)) {
      throw new TooManyRequestsException(
        'Too many auto-apply requests. Maximum 5 requests per minute.',
      );
    }

    return this.dds.tryAutoApply(variantId);
  }

  /** GET /ai-question-bank/dds/variants/:variantId/auto-apply/evaluate */
  @Get('variants/:variantId/auto-apply/evaluate')
  async evaluateAutoApply(@Param('variantId') variantId: string) {
    return this.dds.evaluateAutoApply(variantId);
  }

  /** GET /ai-question-bank/dds/auto-apply/readiness — US-1107 Gate 2 dashboard */
  @Get('auto-apply/readiness')
  async getAutoApplyReadiness(): Promise<GateReadinessDto> {
    const readiness = await this.dds.getAutoApplyReadiness();
    const progressPercent = Math.min(
      (readiness.cleanApprovals / readiness.threshold) * 100,
      100,
    );

    return {
      ...readiness,
      progressPercent,
    };
  }

  /** GET /ai-question-bank/dds/auto-apply/cohort-config — US-1101 get cohort config */
  @Get('auto-apply/cohort-config')
  async getCohortConfig(@Query('cohort') cohort?: string) {
    return this.dds.getCohortConfig(cohort || 'default');
  }

  /** POST /ai-question-bank/dds/auto-apply/promote — US-1101 promote cohort to live */
  @Post('auto-apply/promote')
  async promoteCohortToLive(
    @Query('cohort') cohort?: string,
    @CurrentUser('id') adminUserId?: string,
    @Request() req?: any,
  ) {
    // H-4: Add admin role check to promote endpoint
    // Only ADMIN role users can promote cohorts to live
    const userRole = req?.user?.role;
    if (userRole !== UserRole.ADMIN) {
      throw new ForbiddenException(
        'Only administrators can promote DDS cohorts to live mode. Please contact a system administrator.',
      );
    }

    if (!adminUserId) {
      throw new BadRequestException('Admin user ID is required');
    }

    return this.dds.promoteCohortToLive(cohort || 'default', adminUserId);
  }
}
