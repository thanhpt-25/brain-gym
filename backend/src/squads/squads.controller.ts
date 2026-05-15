import { Controller, Post, Body, Param, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { SquadsService } from './squads.service';
import { CreateSquadDto } from './dto/create-squad.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthenticatedRequest } from '../common/interfaces/request.interface';

@ApiTags('Squads')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('squads')
export class SquadsController {
  constructor(private readonly squadsService: SquadsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new squad' })
  async createSquad(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateSquadDto,
  ) {
    this.squadsService.assertFlagEnabled();
    return this.squadsService.create(req.user.id, dto);
  }

  @Post(':id/invites')
  @ApiOperation({ summary: 'Create an invite link for a squad' })
  async createInvite(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    this.squadsService.assertFlagEnabled();
    return this.squadsService.createInvite(req.user.id, id);
  }

  @Post('join/:code')
  @ApiOperation({ summary: 'Join a squad via invite code' })
  async joinSquad(
    @Req() req: AuthenticatedRequest,
    @Param('code') code: string,
  ) {
    this.squadsService.assertFlagEnabled();
    return this.squadsService.join(req.user.id, code);
  }
}
