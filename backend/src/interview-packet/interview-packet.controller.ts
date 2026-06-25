import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrgRoleGuard } from '../organizations/guards/org-role.guard';
import { OrgRoles } from '../common/decorators/org-roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { InterviewPacketService } from './interview-packet.service';
import { CreatePacketTokenDto } from './dto/create-packet-token.dto';

@Controller('organizations/:orgId/invites/:inviteId/packet-token')
@UseGuards(JwtAuthGuard, OrgRoleGuard)
@OrgRoles('OWNER', 'ADMIN', 'MANAGER')
export class InterviewPacketController {
  constructor(private readonly service: InterviewPacketService) {}

  @Post()
  create(
    @Param('orgId') orgId: string,
    @Param('inviteId') inviteId: string,
    @Body() dto: CreatePacketTokenDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.service.createToken(orgId, inviteId, dto, userId);
  }
}
