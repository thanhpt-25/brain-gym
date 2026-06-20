import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { CampaignsService } from './campaigns.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { AssignCampaignDto } from './dto/assign-campaign.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrgRoleGuard } from '../organizations/guards/org-role.guard';
import { OrgRoles } from '../common/decorators/org-roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('organizations/:orgId/campaigns')
@UseGuards(JwtAuthGuard, OrgRoleGuard)
export class CampaignsController {
  constructor(private readonly service: CampaignsService) {}

  @Get()
  @OrgRoles('OWNER', 'ADMIN', 'MANAGER', 'RECRUITER', 'MEMBER')
  list(@Param('orgId') orgId: string, @Query('filter') filter?: string) {
    return this.service.list(orgId, filter);
  }

  @Post()
  @OrgRoles('OWNER', 'ADMIN', 'MANAGER')
  create(
    @Param('orgId') orgId: string,
    @Body() dto: CreateCampaignDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.service.create(orgId, dto, userId);
  }

  @Get(':campaignId')
  @OrgRoles('OWNER', 'ADMIN', 'MANAGER', 'RECRUITER', 'MEMBER')
  get(@Param('orgId') orgId: string, @Param('campaignId') campaignId: string) {
    return this.service.get(orgId, campaignId);
  }

  @Patch(':campaignId')
  @OrgRoles('OWNER', 'ADMIN', 'MANAGER')
  update(
    @Param('orgId') orgId: string,
    @Param('campaignId') campaignId: string,
    @Body() dto: UpdateCampaignDto,
  ) {
    return this.service.update(orgId, campaignId, dto);
  }

  @Delete(':campaignId')
  @OrgRoles('OWNER', 'ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('orgId') orgId: string,
    @Param('campaignId') campaignId: string,
  ) {
    return this.service.remove(orgId, campaignId);
  }

  @Post(':campaignId/activate')
  @OrgRoles('OWNER', 'ADMIN', 'MANAGER')
  activate(
    @Param('orgId') orgId: string,
    @Param('campaignId') campaignId: string,
  ) {
    return this.service.activate(orgId, campaignId);
  }

  @Post(':campaignId/assign')
  @OrgRoles('OWNER', 'ADMIN', 'MANAGER')
  assign(
    @Param('orgId') orgId: string,
    @Param('campaignId') campaignId: string,
    @Body() dto: AssignCampaignDto,
  ) {
    return this.service.assign(orgId, campaignId, dto);
  }

  @Get(':campaignId/progress')
  @OrgRoles('OWNER', 'ADMIN', 'MANAGER', 'RECRUITER')
  getProgress(
    @Param('orgId') orgId: string,
    @Param('campaignId') campaignId: string,
  ) {
    return this.service.getProgress(orgId, campaignId);
  }
}
