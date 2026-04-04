import {
  Controller, Get, Post, Patch, Delete, Param, Body, Query,
  UseGuards, Req,
} from '@nestjs/common';
import { ExamCatalogService } from './exam-catalog.service';
import { CreateCatalogItemDto } from './dto/create-catalog-item.dto';
import { UpdateCatalogItemDto } from './dto/update-catalog-item.dto';
import { AssignExamDto } from './dto/assign-exam.dto';
import { CreateTrackDto } from './dto/create-track.dto';
import { UpdateTrackDto } from './dto/update-track.dto';
import { ListCatalogDto } from './dto/list-catalog.dto';
import { OrgRoleGuard } from '../organizations/guards/org-role.guard';
import { OrgRoles } from '../common/decorators/org-roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

// ─── Catalog Items ────────────────────────────────────────────────────────────

@Controller('organizations/:orgId/catalog')
@UseGuards(JwtAuthGuard, OrgRoleGuard)
export class ExamCatalogController {
  constructor(private readonly catalogService: ExamCatalogService) {}

  /** Member view: active + in-window items */
  @Get()
  listCatalog(
    @Param('orgId') orgId: string,
    @Query() query: ListCatalogDto,
  ) {
    return this.catalogService.listCatalog(orgId, false, query);
  }

  /** Admin view: all items regardless of active/window */
  @Get('manage')
  @OrgRoles('OWNER', 'ADMIN', 'MANAGER')
  listCatalogAdmin(
    @Param('orgId') orgId: string,
    @Query() query: ListCatalogDto,
  ) {
    return this.catalogService.listCatalog(orgId, true, query);
  }

  @Post()
  @OrgRoles('OWNER', 'ADMIN', 'MANAGER')
  createCatalogItem(
    @Param('orgId') orgId: string,
    @CurrentUser() user: any,
    @Body() dto: CreateCatalogItemDto,
  ) {
    return this.catalogService.createCatalogItem(orgId, user.id, dto);
  }

  @Get(':cid')
  getCatalogItem(
    @Param('orgId') orgId: string,
    @Param('cid') cid: string,
  ) {
    return this.catalogService.getCatalogItem(orgId, cid);
  }

  @Patch(':cid')
  @OrgRoles('OWNER', 'ADMIN', 'MANAGER')
  updateCatalogItem(
    @Param('orgId') orgId: string,
    @Param('cid') cid: string,
    @CurrentUser() user: any,
    @Body() dto: UpdateCatalogItemDto,
  ) {
    return this.catalogService.updateCatalogItem(orgId, cid, user.id, dto);
  }

  @Delete(':cid')
  @OrgRoles('OWNER', 'ADMIN')
  deleteCatalogItem(
    @Param('orgId') orgId: string,
    @Param('cid') cid: string,
    @CurrentUser() user: any,
    @Req() req: any,
  ) {
    return this.catalogService.deleteCatalogItem(orgId, cid, user.id, req.orgMembership?.role);
  }

  @Post(':cid/assign')
  @OrgRoles('OWNER', 'ADMIN', 'MANAGER')
  assignExam(
    @Param('orgId') orgId: string,
    @Param('cid') cid: string,
    @Body() dto: AssignExamDto,
  ) {
    return this.catalogService.assignExam(orgId, cid, dto);
  }

  @Post(':cid/start')
  startCatalogExam(
    @Param('orgId') orgId: string,
    @Param('cid') cid: string,
    @CurrentUser() user: any,
  ) {
    return this.catalogService.startCatalogExam(orgId, cid, user.id);
  }
}

// ─── Learning Tracks + My Assignments ────────────────────────────────────────

@Controller('organizations/:orgId')
@UseGuards(JwtAuthGuard, OrgRoleGuard)
export class ExamTracksController {
  constructor(private readonly catalogService: ExamCatalogService) {}

  @Get('tracks')
  listTracks(@Param('orgId') orgId: string) {
    return this.catalogService.listTracks(orgId);
  }

  @Post('tracks')
  @OrgRoles('OWNER', 'ADMIN', 'MANAGER')
  createTrack(
    @Param('orgId') orgId: string,
    @CurrentUser() user: any,
    @Body() dto: CreateTrackDto,
  ) {
    return this.catalogService.createTrack(orgId, user.id, dto);
  }

  @Patch('tracks/:tid')
  @OrgRoles('OWNER', 'ADMIN', 'MANAGER')
  updateTrack(
    @Param('orgId') orgId: string,
    @Param('tid') tid: string,
    @Body() dto: UpdateTrackDto,
  ) {
    return this.catalogService.updateTrack(orgId, tid, dto);
  }

  @Delete('tracks/:tid')
  @OrgRoles('OWNER', 'ADMIN')
  deleteTrack(
    @Param('orgId') orgId: string,
    @Param('tid') tid: string,
  ) {
    return this.catalogService.deleteTrack(orgId, tid);
  }

  @Get('my-assignments')
  getMyAssignments(
    @Param('orgId') orgId: string,
    @CurrentUser() user: any,
  ) {
    return this.catalogService.getMyAssignments(orgId, user.id);
  }
}
