import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrgRoleGuard } from '../organizations/guards/org-role.guard';
import { OrgRoles } from '../common/decorators/org-roles.decorator';
import { OrgRole } from '@prisma/client';
import { CompetencyService } from './competency.service';
import { CreateCompetencyDto } from './dto/create-competency.dto';
import { UpdateCompetencyDto } from './dto/update-competency.dto';
import { ListCompetenciesDto } from './dto/list-competencies.dto';
import { LinkQuestionDto } from './dto/link-question.dto';
import { AddDomainDto } from './dto/add-domain.dto';

const WRITE_ROLES = [OrgRole.OWNER, OrgRole.ADMIN, OrgRole.MANAGER] as const;
const ALL_ROLES = [
  OrgRole.OWNER,
  OrgRole.ADMIN,
  OrgRole.MANAGER,
  OrgRole.RECRUITER,
  OrgRole.MEMBER,
] as const;

@ApiTags('competencies')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, OrgRoleGuard)
@Controller('organizations/:orgId/competencies')
export class CompetencyController {
  constructor(private readonly competencyService: CompetencyService) {}

  @Post()
  @OrgRoles(...WRITE_ROLES)
  @ApiOperation({ summary: 'Create a competency' })
  create(@Param('orgId') orgId: string, @Body() dto: CreateCompetencyDto) {
    return this.competencyService.create(orgId, dto);
  }

  @Get()
  @OrgRoles(...ALL_ROLES)
  @ApiOperation({ summary: 'List competencies' })
  findAll(@Param('orgId') orgId: string, @Query() query: ListCompetenciesDto) {
    return this.competencyService.findAll(orgId, query);
  }

  @Get(':id')
  @OrgRoles(...ALL_ROLES)
  @ApiOperation({ summary: 'Get competency by id' })
  findOne(@Param('orgId') orgId: string, @Param('id') id: string) {
    return this.competencyService.findOne(orgId, id);
  }

  @Patch(':id')
  @OrgRoles(...WRITE_ROLES)
  @ApiOperation({ summary: 'Update a competency' })
  update(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @Body() dto: UpdateCompetencyDto,
  ) {
    return this.competencyService.update(orgId, id, dto);
  }

  @Patch(':id/toggle-active')
  @OrgRoles(...WRITE_ROLES)
  @ApiOperation({ summary: 'Toggle isActive flag' })
  toggleActive(@Param('orgId') orgId: string, @Param('id') id: string) {
    return this.competencyService.toggleActive(orgId, id);
  }

  @Delete(':id')
  @OrgRoles(...WRITE_ROLES)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a competency' })
  remove(@Param('orgId') orgId: string, @Param('id') id: string) {
    return this.competencyService.remove(orgId, id);
  }

  // ── Question links ────────────────────────────────────────────────────────

  @Get(':id/questions')
  @OrgRoles(...ALL_ROLES)
  @ApiOperation({ summary: 'List linked questions' })
  listQuestions(@Param('orgId') orgId: string, @Param('id') id: string) {
    return this.competencyService.listQuestions(orgId, id);
  }

  @Post(':id/questions')
  @OrgRoles(...WRITE_ROLES)
  @ApiOperation({ summary: 'Link a question to competency' })
  linkQuestion(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @Body() dto: LinkQuestionDto,
  ) {
    return this.competencyService.linkQuestion(orgId, id, dto);
  }

  @Delete(':id/questions/:questionId')
  @OrgRoles(...WRITE_ROLES)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Unlink a question from competency' })
  unlinkQuestion(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @Param('questionId') questionId: string,
  ) {
    return this.competencyService.unlinkQuestion(orgId, id, questionId);
  }

  // ── Domains ───────────────────────────────────────────────────────────────

  @Get(':id/domains')
  @OrgRoles(...ALL_ROLES)
  @ApiOperation({ summary: 'List competency domains' })
  listDomains(@Param('orgId') orgId: string, @Param('id') id: string) {
    return this.competencyService.listDomains(orgId, id);
  }

  @Post(':id/domains')
  @OrgRoles(...WRITE_ROLES)
  @ApiOperation({ summary: 'Add a domain mapping' })
  addDomain(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @Body() dto: AddDomainDto,
  ) {
    return this.competencyService.addDomain(orgId, id, dto);
  }

  @Delete(':id/domains/:domainId')
  @OrgRoles(...WRITE_ROLES)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a domain mapping' })
  removeDomain(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @Param('domainId') domainId: string,
  ) {
    return this.competencyService.removeDomain(orgId, id, domainId);
  }
}
