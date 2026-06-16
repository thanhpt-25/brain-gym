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
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrgRoleGuard } from '../organizations/guards/org-role.guard';
import { OrgRoles } from '../common/decorators/org-roles.decorator';
import { OrgRole } from '@prisma/client';
import { CompetencyService } from './competency.service';
import { CreateCompetencyDto } from './dto/create-competency.dto';
import { UpdateCompetencyDto } from './dto/update-competency.dto';
import { ListCompetenciesDto } from './dto/list-competencies.dto';

@ApiTags('competencies')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, OrgRoleGuard)
@Controller('orgs/:orgId/competencies')
export class CompetencyController {
  constructor(private readonly competencyService: CompetencyService) {}

  @Post()
  @OrgRoles(OrgRole.OWNER, OrgRole.ADMIN)
  @ApiOperation({ summary: 'Create a competency' })
  @ApiParam({ name: 'orgId', type: 'string' })
  create(@Param('orgId') orgId: string, @Body() dto: CreateCompetencyDto) {
    return this.competencyService.create(orgId, dto);
  }

  @Get()
  @OrgRoles(OrgRole.OWNER, OrgRole.ADMIN, OrgRole.MEMBER, OrgRole.RECRUITER)
  @ApiOperation({ summary: 'List competencies' })
  @ApiParam({ name: 'orgId', type: 'string' })
  findAll(@Param('orgId') orgId: string, @Query() query: ListCompetenciesDto) {
    return this.competencyService.findAll(orgId, query);
  }

  @Get(':id')
  @OrgRoles(OrgRole.OWNER, OrgRole.ADMIN, OrgRole.MEMBER, OrgRole.RECRUITER)
  @ApiOperation({ summary: 'Get competency by id' })
  @ApiParam({ name: 'orgId', type: 'string' })
  @ApiParam({ name: 'id', type: 'string' })
  findOne(@Param('orgId') orgId: string, @Param('id') id: string) {
    return this.competencyService.findOne(orgId, id);
  }

  @Patch(':id')
  @OrgRoles(OrgRole.OWNER, OrgRole.ADMIN)
  @ApiOperation({ summary: 'Update a competency' })
  @ApiParam({ name: 'orgId', type: 'string' })
  @ApiParam({ name: 'id', type: 'string' })
  update(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @Body() dto: UpdateCompetencyDto,
  ) {
    return this.competencyService.update(orgId, id, dto);
  }

  @Delete(':id')
  @OrgRoles(OrgRole.OWNER, OrgRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a competency' })
  @ApiParam({ name: 'orgId', type: 'string' })
  @ApiParam({ name: 'id', type: 'string' })
  remove(@Param('orgId') orgId: string, @Param('id') id: string) {
    return this.competencyService.remove(orgId, id);
  }
}
