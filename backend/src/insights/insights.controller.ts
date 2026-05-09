import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedRequest } from '../common/interfaces/request.interface';
import { NextTopicService, NextTopicSuggestion } from './next-topic.service';

@ApiTags('insights')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('insights')
export class InsightsController {
  constructor(private readonly nextTopicService: NextTopicService) {}

  @Get('next-topic')
  @ApiOperation({
    summary:
      'Get the next topic to study based on domain performance (adaptive weakness)',
  })
  @ApiQuery({ name: 'certificationId', type: 'string' })
  async getNextTopic(
    @Req() req: AuthenticatedRequest,
    @Query('certificationId') certificationId: string,
  ): Promise<NextTopicSuggestion | { message: string }> {
    const suggestion = await this.nextTopicService.suggestNextTopic(
      req.user.id,
      certificationId,
    );

    if (!suggestion) {
      return {
        message:
          "You're well-rounded — try a full timed exam to challenge yourself",
      };
    }

    return suggestion;
  }
}
