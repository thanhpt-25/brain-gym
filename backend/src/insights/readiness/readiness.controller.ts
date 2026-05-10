import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import type { AuthenticatedRequest } from '../../common/interfaces/request.interface';
import { MIN_ATTEMPTS_FOR_SCORE } from './readiness.constants';
import { ReadinessService } from './readiness.service';

@ApiTags('readiness')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('readiness')
export class ReadinessController {
  constructor(private readonly readinessService: ReadinessService) {}

  @Get(':certificationId')
  @ApiOperation({ summary: 'Get readiness score for a certification' })
  async getReadinessScore(
    @Req() req: AuthenticatedRequest,
    @Param('certificationId') certificationId: string,
  ) {
    const row = await this.readinessService.getReadinessScore(
      req.user.id,
      certificationId,
    );

    if (!row || row.attempts < MIN_ATTEMPTS_FOR_SCORE) {
      throw new NotFoundException({
        message: 'not_enough_attempts',
        error: `Readiness score unavailable — user has ${row?.attempts ?? 0} of ${MIN_ATTEMPTS_FOR_SCORE} required attempts`,
      });
    }

    return row;
  }
}
