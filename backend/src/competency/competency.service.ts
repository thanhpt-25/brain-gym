import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCompetencyDto } from './dto/create-competency.dto';
import { UpdateCompetencyDto } from './dto/update-competency.dto';
import { ListCompetenciesDto } from './dto/list-competencies.dto';

@Injectable()
export class CompetencyService {
  constructor(private readonly prisma: PrismaService) {}

  create(orgId: string, dto: CreateCompetencyDto) {
    return this.prisma.competency.create({
      data: {
        orgId,
        name: dto.name,
        description: dto.description,
        scaleMin: dto.scaleMin ?? 1,
        scaleMax: dto.scaleMax ?? 5,
      },
    });
  }

  findAll(orgId: string, query: ListCompetenciesDto) {
    return this.prisma.competency.findMany({
      where: {
        orgId,
        ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(orgId: string, id: string) {
    const competency = await this.prisma.competency.findFirst({
      where: { id, orgId },
      include: { domains: true },
    });
    if (!competency) throw new NotFoundException('Competency not found');
    return competency;
  }

  async update(orgId: string, id: string, dto: UpdateCompetencyDto) {
    await this.findOne(orgId, id);
    return this.prisma.competency.update({
      where: { id },
      data: dto,
    });
  }

  async remove(orgId: string, id: string) {
    await this.findOne(orgId, id);
    return this.prisma.competency.delete({ where: { id } });
  }
}
