import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { OrganizationsService } from './organizations.service';
import { CreateOrgDto } from './dto/create-org.dto';
import { UpdateOrgDto } from './dto/update-org.dto';
import { InviteMemberDto, BulkInviteMemberDto } from './dto/invite-member.dto';
import { CreateJoinLinkDto } from './dto/create-join-link.dto';
import { CreateGroupDto, UpdateGroupDto } from './dto/create-group.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { OrgRoleGuard } from './guards/org-role.guard';
import { OrgRoles } from '../common/decorators/org-roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { OrgRole } from '@prisma/client';

@ApiTags('organizations')
@ApiBearerAuth()
@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Post()
  @ApiOperation({ summary: 'Create organization (caller becomes OWNER)' })
  create(@CurrentUser('id') userId: string, @Body() createOrgDto: CreateOrgDto) {
    return this.organizationsService.create(userId, createOrgDto);
  }

  @Get('my')
  @ApiOperation({ summary: 'List orgs the user belongs to' })
  findMyOrgs(@CurrentUser('id') userId: string) {
    return this.organizationsService.findMyOrgs(userId);
  }

  @Post('accept-invite/:token')
  @ApiOperation({ summary: 'Accept email invitation' })
  acceptInvite(@CurrentUser('id') userId: string, @Param('token') token: string) {
    return this.organizationsService.acceptInvite(userId, token);
  }

  @Get('join/:code')
  @ApiOperation({ summary: 'Join org via link' })
  joinViaLink(@CurrentUser('id') userId: string, @Param('code') code: string) {
    return this.organizationsService.joinViaLink(userId, code);
  }

  // ---- Org-scoped routes below ----

  @Get(':orgId')
  @UseGuards(OrgRoleGuard)
  @ApiOperation({ summary: 'Get org details' })
  findOne(@Param('orgId') orgId: string) {
    return this.organizationsService.findOne(orgId);
  }

  @Patch(':orgId')
  @UseGuards(OrgRoleGuard)
  @OrgRoles(OrgRole.OWNER, OrgRole.ADMIN)
  @ApiOperation({ summary: 'Update org settings' })
  update(@Param('orgId') orgId: string, @Body() updateOrgDto: UpdateOrgDto) {
    return this.organizationsService.update(orgId, updateOrgDto);
  }

  @Delete(':orgId')
  @UseGuards(OrgRoleGuard)
  @OrgRoles(OrgRole.OWNER)
  @ApiOperation({ summary: 'Delete organization' })
  remove(@Param('orgId') orgId: string) {
    return this.organizationsService.remove(orgId);
  }

  @Get(':orgId/members')
  @UseGuards(OrgRoleGuard)
  @ApiOperation({ summary: 'List members (paginated)' })
  findMembers(@Param('orgId') orgId: string, @Query('page') page?: string, @Query('limit') limit?: string) {
    return this.organizationsService.findMembers(orgId, page ? +page : 1, limit ? +limit : 20);
  }

  @Post(':orgId/members/invite')
  @UseGuards(OrgRoleGuard)
  @OrgRoles(OrgRole.OWNER, OrgRole.ADMIN)
  @ApiOperation({ summary: 'Invite by email' })
  inviteMember(
    @Param('orgId') orgId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: InviteMemberDto,
  ) {
    return this.organizationsService.inviteMember(orgId, userId, dto);
  }

  @Post(':orgId/members/bulk-invite')
  @UseGuards(OrgRoleGuard)
  @OrgRoles(OrgRole.OWNER, OrgRole.ADMIN)
  @ApiOperation({ summary: 'Bulk invite' })
  bulkInvite(
    @Param('orgId') orgId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: BulkInviteMemberDto,
  ) {
    return this.organizationsService.bulkInvite(orgId, userId, dto);
  }

  @Patch(':orgId/members/:userId')
  @UseGuards(OrgRoleGuard)
  @OrgRoles(OrgRole.OWNER, OrgRole.ADMIN)
  @ApiOperation({ summary: 'Change member role' })
  updateMemberRole(
    @Param('orgId') orgId: string,
    @Param('userId') targetUserId: string,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    return this.organizationsService.updateMemberRole(orgId, targetUserId, dto);
  }

  @Delete(':orgId/members/:userId')
  @UseGuards(OrgRoleGuard)
  @OrgRoles(OrgRole.OWNER, OrgRole.ADMIN)
  @ApiOperation({ summary: 'Remove member' })
  removeMember(@Param('orgId') orgId: string, @Param('userId') targetUserId: string) {
    return this.organizationsService.removeMember(orgId, targetUserId);
  }

  @Post(':orgId/join-links')
  @UseGuards(OrgRoleGuard)
  @OrgRoles(OrgRole.OWNER, OrgRole.ADMIN)
  @ApiOperation({ summary: 'Generate join link' })
  createJoinLink(@Param('orgId') orgId: string, @Body() dto: CreateJoinLinkDto) {
    return this.organizationsService.createJoinLink(orgId, dto);
  }

  @Post(':orgId/groups')
  @UseGuards(OrgRoleGuard)
  @OrgRoles(OrgRole.OWNER, OrgRole.ADMIN, OrgRole.MANAGER)
  @ApiOperation({ summary: 'Create group' })
  createGroup(@Param('orgId') orgId: string, @Body() dto: CreateGroupDto) {
    return this.organizationsService.createGroup(orgId, dto);
  }

  @Get(':orgId/groups')
  @UseGuards(OrgRoleGuard)
  @ApiOperation({ summary: 'List groups' })
  findGroups(@Param('orgId') orgId: string) {
    return this.organizationsService.findGroups(orgId);
  }

  @Patch(':orgId/groups/:groupId')
  @UseGuards(OrgRoleGuard)
  @OrgRoles(OrgRole.OWNER, OrgRole.ADMIN, OrgRole.MANAGER)
  @ApiOperation({ summary: 'Update group' })
  updateGroup(
    @Param('orgId') orgId: string,
    @Param('groupId') groupId: string,
    @Body() dto: UpdateGroupDto,
  ) {
    return this.organizationsService.updateGroup(orgId, groupId, dto);
  }
}
