import { Controller, Get, Put, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { SuspendUserDto } from './dto/suspend-user.dto';
import { BanUserDto } from './dto/ban-user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import { AuditService } from '../audit/audit.service';
import { UserRole } from '@prisma/client';
import { PaginationDto } from '../common/dto/pagination.dto';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly auditService: AuditService,
  ) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  getProfile(@Req() req: any) {
    const { passwordHash, ...userWithoutPassword } = req.user;
    return userWithoutPassword;
  }

  @Put('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update own profile (displayName, avatarUrl)' })
  updateProfile(@Req() req: any, @Body() dto: UpdateProfileDto) {
    const userId = req.user.sub || req.user.id;
    return this.usersService.updateProfile(userId, dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all users (admin only)' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  findAll(
    @Query('search') search?: string,
    @Query() pagination?: PaginationDto,
  ) {
    return this.usersService.findAll(search, pagination?.page, pagination?.limit);
  }

  @Put(':id/role')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change user role (admin only)' })
  async updateRole(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateUserRoleDto) {
    const result = await this.usersService.updateRole(id, dto.role);
    await this.auditService.log({
      userId: req.user.sub || req.user.id,
      action: 'ROLE_CHANGED',
      targetType: 'User',
      targetId: id,
      metadata: { newRole: dto.role },
    });
    return result;
  }

  @Put(':id/suspend')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Suspend a user (admin only)' })
  async suspendUser(@Req() req: any, @Param('id') id: string, @Body() dto: SuspendUserDto) {
    const result = await this.usersService.suspendUser(id, dto.reason, dto.suspendedUntil);
    await this.auditService.log({
      userId: req.user.sub || req.user.id,
      action: 'USER_SUSPENDED',
      targetType: 'User',
      targetId: id,
      metadata: { reason: dto.reason, suspendedUntil: dto.suspendedUntil },
    });
    return result;
  }

  @Put(':id/ban')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Ban a user (admin only)' })
  async banUser(@Req() req: any, @Param('id') id: string, @Body() dto: BanUserDto) {
    const result = await this.usersService.banUser(id, dto.reason);
    await this.auditService.log({
      userId: req.user.sub || req.user.id,
      action: 'USER_BANNED',
      targetType: 'User',
      targetId: id,
      metadata: { reason: dto.reason },
    });
    return result;
  }

  @Put(':id/reactivate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reactivate a suspended/banned user (admin only)' })
  async reactivateUser(@Req() req: any, @Param('id') id: string) {
    const result = await this.usersService.reactivateUser(id);
    await this.auditService.log({
      userId: req.user.sub || req.user.id,
      action: 'USER_REACTIVATED',
      targetType: 'User',
      targetId: id,
    });
    return result;
  }

  @Put(':id/points')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Adjust user points (admin only)' })
  async adjustPoints(@Req() req: any, @Param('id') id: string, @Body() body: { amount: number; reason?: string }) {
    const result = await this.usersService.adjustPoints(id, body.amount);
    await this.auditService.log({
      userId: req.user.sub || req.user.id,
      action: 'POINTS_ADJUSTED',
      targetType: 'User',
      targetId: id,
      metadata: { amount: body.amount, reason: body.reason },
    });
    return result;
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get public user profile with badges and stats' })
  getPublicProfile(@Param('id') id: string) {
    return this.usersService.getPublicProfile(id);
  }
}
