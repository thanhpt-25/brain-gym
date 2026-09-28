import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { CreateJobRoleDto } from './dto/create-job-role.dto';
import { UpdateJobRoleDto } from './dto/update-job-role.dto';
import { SetJobRoleCompetenciesDto } from './dto/set-job-role-competencies.dto';

@Injectable()
export class JobRolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orgsService: OrganizationsService,
  ) {}

  async list(slugOrId: string) {
    const orgId = await this.orgsService.resolveOrgId(slugOrId);
    return this.prisma.jobRole.findMany({
      where: { orgId },
      orderBy: [{ isActive: 'desc' }, { title: 'asc' }],
      include: { _count: { select: { assessments: true } } },
    });
  }

  async create(slugOrId: string, dto: CreateJobRoleDto) {
    const orgId = await this.orgsService.resolveOrgId(slugOrId);
    return this.prisma.jobRole.create({
      data: { orgId, title: dto.title, department: dto.department, description: dto.description },
    });
  }

  async update(slugOrId: string, roleId: string, dto: UpdateJobRoleDto) {
    const orgId = await this.orgsService.resolveOrgId(slugOrId);
    const existing = await this.prisma.jobRole.findFirst({ where: { id: roleId, orgId } });
    if (!existing) throw new NotFoundException('Job role not found');
    return this.prisma.jobRole.update({
      where: { id: roleId },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.department !== undefined && { department: dto.department }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  async remove(slugOrId: string, roleId: string) {
    const orgId = await this.orgsService.resolveOrgId(slugOrId);
    const existing = await this.prisma.jobRole.findFirst({ where: { id: roleId, orgId } });
    if (!existing) throw new NotFoundException('Job role not found');
    return this.prisma.jobRole.delete({ where: { id: roleId } });
  }

  // ── US-A2: Competency Requirements ────────────────────────────────────────

  async getRequirements(slugOrId: string, roleId: string) {
    const orgId = await this.orgsService.resolveOrgId(slugOrId);
    const role = await this.prisma.jobRole.findFirst({ where: { id: roleId, orgId } });
    if (!role) throw new NotFoundException('Job role not found');
    const reqs = await this.prisma.jobRoleCompetency.findMany({
      where: { jobRoleId: roleId },
      include: { competency: { select: { id: true, name: true, scaleMin: true, scaleMax: true } } },
    });
    return reqs.map((r) => ({
      id: r.id,
      competencyId: r.competencyId,
      competencyName: r.competency.name,
      requiredLevel: r.requiredLevel,
      scaleMin: r.competency.scaleMin,
      scaleMax: r.competency.scaleMax,
    }));
  }

  async setRequirements(slugOrId: string, roleId: string, dto: SetJobRoleCompetenciesDto) {
    const orgId = await this.orgsService.resolveOrgId(slugOrId);
    const role = await this.prisma.jobRole.findFirst({ where: { id: roleId, orgId } });
    if (!role) throw new NotFoundException('Job role not found');

    if (dto.requirements.length === 0) {
      await this.prisma.jobRoleCompetency.deleteMany({ where: { jobRoleId: roleId } });
      return [];
    }

    const ids = dto.requirements.map((r) => r.competencyId);
    const uniqueIds = new Set(ids);
    if (uniqueIds.size !== ids.length) {
      throw new BadRequestException('Duplicate competencyId in requirements');
    }

    const competencies = await this.prisma.competency.findMany({
      where: { id: { in: [...uniqueIds] }, orgId },
      select: { id: true, name: true, scaleMin: true, scaleMax: true },
    });

    const errors: { competencyId: string; error: string }[] = [];
    for (const req of dto.requirements) {
      const comp = competencies.find((c) => c.id === req.competencyId);
      if (!comp) {
        errors.push({ competencyId: req.competencyId, error: 'Competency not found in this org' });
        continue;
      }
      if (req.requiredLevel < comp.scaleMin || req.requiredLevel > comp.scaleMax) {
        errors.push({
          competencyId: req.competencyId,
          error: `requiredLevel ${req.requiredLevel} out of range [${comp.scaleMin},${comp.scaleMax}]`,
        });
      }
    }
    if (errors.length > 0) throw new BadRequestException({ message: 'Validation failed', errors });

    await this.prisma.$transaction([
      this.prisma.jobRoleCompetency.deleteMany({ where: { jobRoleId: roleId } }),
      this.prisma.jobRoleCompetency.createMany({
        data: dto.requirements.map((r) => ({
          jobRoleId: roleId,
          competencyId: r.competencyId,
          requiredLevel: r.requiredLevel,
        })),
      }),
    ]);

    return this.getRequirements(slugOrId, roleId);
  }
}
