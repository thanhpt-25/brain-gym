import {
  Controller,
  Post,
  Body,
  Param,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { SquadsService } from './squads.service';
import { CreateSquadDto } from './dto/create-squad.dto';
import { SquadDto } from './dto/squad.dto';
import { InviteLinkDto } from './dto/invite-link.dto';
import { AuthGuard } from '@nestjs/passport';
import { AuthUser } from '../auth/decorators/auth-user.decorator';
import { User } from '@prisma/client';

@Controller('squads')
export class SquadsController {
  constructor(private readonly squadsService: SquadsService) {}

  @Post()
  @UseGuards(AuthGuard('jwt'))
  async createSquad(
    @AuthUser() user: User,
    @Body() dto: CreateSquadDto,
  ): Promise<SquadDto> {
    if (!user) {
      throw new BadRequestException('User not authenticated');
    }
    return this.squadsService.createSquad(user.id, dto);
  }

  @Post(':id/invites')
  @UseGuards(AuthGuard('jwt'))
  async createInviteLink(
    @Param('id') squadId: string,
    @AuthUser() user: User,
  ): Promise<InviteLinkDto> {
    if (!user) {
      throw new BadRequestException('User not authenticated');
    }
    return this.squadsService.createInviteLink(squadId, user.id);
  }

  @Post('join/:token')
  @UseGuards(AuthGuard('jwt'))
  async joinSquad(
    @Param('token') token: string,
    @AuthUser() user: User,
  ): Promise<SquadDto> {
    if (!user) {
      throw new BadRequestException('User not authenticated');
    }
    return this.squadsService.joinSquad(token, user.id);
  }
}
