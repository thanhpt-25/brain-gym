import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { StorageService } from '../common/storage/storage.service';
import { AvatarUploadInterceptor } from '../common/storage/avatar-upload.interceptor';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { UpdateUserPlanDto } from './dto/update-user-plan.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
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
    private readonly storageService: StorageService,
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

  @Post('me/avatar/presign')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get presigned PUT URL for avatar upload' })
  @ApiBody({
    schema: {
      properties: { contentType: { type: 'string' } },
      required: ['contentType'],
    },
  })
  async presignAvatar(@Body('contentType') contentType: string) {
    if (!contentType?.match(/^image\/(jpeg|png|gif|webp)$/)) {
      throw new BadRequestException(
        'contentType must be a valid image MIME type',
      );
    }
    return this.storageService.presignAvatarUpload(contentType);
  }

  @Post('me/avatar/confirm')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Confirm avatar upload and save URL to profile' })
  @ApiBody({
    schema: { properties: { key: { type: 'string' } }, required: ['key'] },
  })
  async confirmAvatar(@Req() req: any, @Body('key') key: string) {
    if (!key) throw new BadRequestException('key is required');
    const userId = req.user.sub || req.user.id;
    const avatarUrl = this.storageService.resolvePublicUrl(key);
    const updated = await this.usersService.updateProfile(userId, {
      avatarUrl,
    });
    return { avatarUrl: updated.avatarUrl };
  }

  @Post('me/avatar/upload-local')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Local-dev avatar upload (disk storage)' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(AvatarUploadInterceptor)
  async uploadAvatarLocal(@Req() req: any) {
    const file = req.file as Express.Multer.File;
    if (!file) throw new BadRequestException('No file provided');
    const userId = req.user.sub || req.user.id;
    const avatarUrl = `/uploads/avatars/${file.filename}`;
    const updated = await this.usersService.updateProfile(userId, {
      avatarUrl,
    });
    return { avatarUrl: updated.avatarUrl };
  }

  @Put('me/password')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change own password' })
  changePassword(@Req() req: any, @Body() dto: ChangePasswordDto) {
    const userId = req.user.sub || req.user.id;
    return this.usersService.changePassword(
      userId,
      dto.currentPassword,
      dto.newPassword,
    );
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
    return this.usersService.findAll(
      search,
      pagination?.page,
      pagination?.limit,
    );
  }

  @Put(':id/role')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change user role (admin only)' })
  async updateRole(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateUserRoleDto,
  ) {
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

  @Put(':id/plan')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change user plan (admin only)' })
  async updatePlan(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateUserPlanDto,
  ) {
    const result = await this.usersService.updatePlan(id, dto.plan);
    await this.auditService.log({
      userId: req.user.sub || req.user.id,
      action: 'PLAN_CHANGED',
      targetType: 'User',
      targetId: id,
      metadata: { newPlan: dto.plan },
    });
    return result;
  }

  @Put(':id/suspend')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Suspend a user (admin only)' })
  async suspendUser(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: SuspendUserDto,
  ) {
    const result = await this.usersService.suspendUser(
      id,
      dto.reason,
      dto.suspendedUntil,
    );
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
  async banUser(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: BanUserDto,
  ) {
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
  async adjustPoints(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { amount: number; reason?: string },
  ) {
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
