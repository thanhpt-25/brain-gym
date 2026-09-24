import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ContributorRequestsService } from './contributor-requests.service';
import { CreateContributorRequestDto } from './dto/create-contributor-request.dto';

/**
 * Learner-facing endpoints. There is deliberately no `:id` route here: a user
 * can only ever act on their own request (avoids IDOR).
 */
@ApiTags('contributor-requests')
@Controller('contributor-requests')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ContributorRequestsController {
  constructor(private readonly service: ContributorRequestsService) {}

  @Get('me/eligibility')
  @ApiOperation({ summary: 'Check whether I can request contributor access' })
  getEligibility(@Req() req: any) {
    return this.service.getEligibility(req.user.sub || req.user.id);
  }

  @Get('me')
  @ApiOperation({ summary: 'My latest contributor request and history' })
  getMine(@Req() req: any) {
    return this.service.getMine(req.user.sub || req.user.id);
  }

  // No per-route @Throttle: it is keyed by IP, which would block learners
  // sharing a NAT. One-pending-per-user + the rejection cooldown bound spam.
  @Post()
  @ApiOperation({ summary: 'Request contributor access' })
  create(@Req() req: any, @Body() dto: CreateContributorRequestDto) {
    return this.service.create(req.user.sub || req.user.id, dto);
  }

  @Delete('me')
  @ApiOperation({ summary: 'Cancel my pending contributor request' })
  cancel(@Req() req: any) {
    return this.service.cancelMine(req.user.sub || req.user.id);
  }
}
