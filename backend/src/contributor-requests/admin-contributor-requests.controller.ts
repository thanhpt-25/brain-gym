import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { ContributorRequestsService } from './contributor-requests.service';
import {
  ApproveContributorRequestDto,
  RejectContributorRequestDto,
} from './dto/review-contributor-request.dto';

@ApiTags('admin')
@Controller('admin/contributor-requests')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiBearerAuth()
export class AdminContributorRequestsController {
  constructor(private readonly service: ContributorRequestsService) {}

  @Get()
  @ApiOperation({ summary: 'List contributor requests' })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'ALL'],
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  list(
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    return this.service.adminList({
      status,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      search,
    });
  }

  @Get('stats')
  @ApiOperation({ summary: 'Pending contributor request count' })
  stats() {
    return this.service.adminStats();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Contributor request detail with user activity' })
  get(@Param('id') id: string) {
    return this.service.adminGet(id);
  }

  @Post(':id/approve')
  @ApiOperation({ summary: 'Approve: promote the learner to CONTRIBUTOR' })
  approve(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: ApproveContributorRequestDto,
  ) {
    return this.service.approve(id, req.user.sub || req.user.id, dto?.note);
  }

  @Post(':id/reject')
  @ApiOperation({ summary: 'Reject with a reason' })
  reject(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: RejectContributorRequestDto,
  ) {
    return this.service.reject(id, req.user.sub || req.user.id, dto.reason);
  }
}
