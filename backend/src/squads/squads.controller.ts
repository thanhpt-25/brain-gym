import {
  Controller,
  Post,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { SquadsService } from './squads.service';
import { CreateSquadDto } from './dto/create-squad.dto';
import { SquadDto } from './dto/squad.dto';
import { InviteLinkDto } from './dto/invite-link.dto';
import { AuthGuard } from '@nestjs/passport';
import { AuthUser } from '@/src/auth/decorators/auth-user.decorator';
import { User } from '@prisma/client';
import { OrgRoleGuard } from '@/src/orgs/guards/org-role.guard';
import { OrgRoles } from '@/src/orgs/decorators/org-roles.decorator';

/**
 * Squads REST API Controller
 * Endpoints for squad creation, invite generation, and squad joining
 */
@Controller('squads')
export class SquadsController {
  constructor(private readonly squadsService: SquadsService) {}

  /**
   * POST /api/v1/squads
   * Create a new squad
   * Requires: AuthGuard (user must be logged in + paid plan)
   */
  @Post()
  @UseGuards(AuthGuard('jwt'))
  @HttpCode(HttpStatus.CREATED)
  async createSquad(
    @AuthUser() user: User,
    @Body() dto: CreateSquadDto,
  ): Promise<SquadDto> {
    return this.squadsService.createSquad(user.id, dto);
  }

  /**
   * POST /api/v1/squads/:id/invites
   * Generate invite link for squad
   * Requires: AuthGuard + OrgRoleGuard (user must be OWNER or ADMIN of squad)
   */
  @Post(':id/invites')
  @UseGuards(AuthGuard('jwt'), OrgRoleGuard)
  @OrgRoles('OWNER', 'ADMIN')
  @HttpCode(HttpStatus.CREATED)
  async createInviteLink(
    @Param('id') squadId: string,
    @AuthUser() user: User,
  ): Promise<InviteLinkDto> {
    return this.squadsService.createInviteLink(squadId, user.id);
  }

  /**
   * POST /api/v1/squads/join/:token
   * Accept invite and join squad
   * Requires: AuthGuard (user must be logged in)
   */
  @Post('join/:token')
  @UseGuards(AuthGuard('jwt'))
  @HttpCode(HttpStatus.OK)
  async joinSquad(
    @Param('token') token: string,
    @AuthUser() user: User,
  ): Promise<SquadDto> {
    return this.squadsService.joinSquad(token, user.id);
  }
}
