import { Controller, Get, Param, UseGuards, Req } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { MasteryService } from './mastery.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedRequest } from '../common/interfaces/request.interface';
import { MasteryResponseDto } from './mastery.dto';

@ApiTags('mastery')
@Controller('mastery')
export class MasteryController {
  constructor(private readonly masteryService: MasteryService) {}

  @Get(':certificationId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Get per-domain mastery data for the authenticated user and a given certification',
  })
  @ApiParam({
    name: 'certificationId',
    description: 'UUID of the certification',
  })
  @ApiResponse({
    status: 200,
    type: MasteryResponseDto,
    description:
      'Domain mastery aggregation. isEmpty: true when < 10 attempts exist.',
  })
  getMastery(
    @Req() req: AuthenticatedRequest,
    @Param('certificationId') certificationId: string,
  ): Promise<MasteryResponseDto> {
    return this.masteryService.getMastery(req.user.id, certificationId);
  }
}
