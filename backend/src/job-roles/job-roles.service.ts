import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { CreateJobRoleDto } from './dto/create-job-role.dto';
import { UpdateJobRoleDto } from './dto/update-job-role.dto';

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
      include: {
        _count: { select: { assessments: true } },
      },
    });
  }

  async create(slugOrId: string, dto: CreateJobRoleDto) {
    const orgId = await this.orgsService.resolveOrgId(slugOrId);
    return this.prisma.jobRole.create({
      data: {
        orgId,
        title: dto.title,
        department: dto.department,
        description: dto.description,
      },
    });
  }

  async update(slugOrId: string, roleId: string, dto: UpdateJobRoleDto) {
    const orgId = await this.orgsService.resolveOrgId(slugOrId);
    const existing = await this.prisma.jobRole.findFirst({
      where: { id: roleId, orgId },
    });
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
    const existing = await this.prisma.jobRole.findFirst({
      where: { id: roleId, orgId },
    });
    if (!existing) throw new NotFoundException('Job role not found');
    return this.prisma.jobRole.delete({ where: { id: roleId } });
  }
}
