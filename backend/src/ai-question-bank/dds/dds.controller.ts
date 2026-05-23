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
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { DdsService } from './dds.service';
import { DdsReason } from '@prisma/client';

class ProposeVariantDto {
  reason?: DdsReason;
}

class ReviewVariantDto {
  reviewNote?: string;
}

@Controller('ai-question-bank/dds')
@UseGuards(AuthGuard('jwt'))
export class DdsController {
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
}
