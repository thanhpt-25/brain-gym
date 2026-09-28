import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CompetencyDomainSource } from '@prisma/client';
import { CreateCompetencyDto } from './dto/create-competency.dto';
import { UpdateCompetencyDto } from './dto/update-competency.dto';
import { ListCompetenciesDto } from './dto/list-competencies.dto';
import { LinkQuestionDto } from './dto/link-question.dto';
import { AddDomainDto } from './dto/add-domain.dto';

@Injectable()
export class CompetencyService {
  constructor(private readonly prisma: PrismaService) {}

  async create(orgId: string, dto: CreateCompetencyDto) {
    const scaleMin = dto.scaleMin ?? 1;
    const scaleMax = dto.scaleMax ?? 5;
    if (scaleMin >= scaleMax) {
      throw new BadRequestException('scaleMin must be less than scaleMax');
    }
    try {
      return await this.prisma.competency.create({
        data: { orgId, name: dto.name, description: dto.description, scaleMin, scaleMax },
      });
    } catch (e: any) {
      if (e?.code === 'P2002') throw new ConflictException('Competency name already exists in this org');
      throw e;
    }
  }

  findAll(orgId: string, query: ListCompetenciesDto) {
    return this.prisma.competency.findMany({
      where: { orgId, ...(query.isActive !== undefined ? { isActive: query.isActive } : {}) },
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
    const existing = await this.findOne(orgId, id);
    const scaleMin = dto.scaleMin ?? existing.scaleMin;
    const scaleMax = dto.scaleMax ?? existing.scaleMax;
    if (scaleMin >= scaleMax) {
      throw new BadRequestException('scaleMin must be less than scaleMax');
    }
    try {
      return await this.prisma.competency.update({ where: { id }, data: dto });
    } catch (e: any) {
      if (e?.code === 'P2002') throw new ConflictException('Competency name already exists in this org');
      throw e;
    }
  }

  async toggleActive(orgId: string, id: string) {
    const existing = await this.findOne(orgId, id);
    return this.prisma.competency.update({
      where: { id },
      data: { isActive: !existing.isActive },
    });
  }

  async remove(orgId: string, id: string) {
    await this.findOne(orgId, id);
    return this.prisma.competency.delete({ where: { id } });
  }

  // ── Questions ─────────────────────────────────────────────────────────────

  async listQuestions(orgId: string, competencyId: string) {
    await this.findOne(orgId, competencyId);
    return this.prisma.questionCompetency.findMany({
      where: { competencyId },
      include: {
        orgQuestion: { select: { id: true, title: true, category: true } },
      },
    });
  }

  async linkQuestion(orgId: string, competencyId: string, dto: LinkQuestionDto) {
    await this.findOne(orgId, competencyId);
    const question = await this.prisma.orgQuestion.findFirst({
      where: { id: dto.orgQuestionId, orgId },
    });
    if (!question) throw new BadRequestException('Question not found in this org');
    try {
      return await this.prisma.questionCompetency.create({
        data: { competencyId, orgQuestionId: dto.orgQuestionId, weight: dto.weight ?? 1 },
      });
    } catch (e: any) {
      if (e?.code === 'P2002') throw new ConflictException('Question already linked to this competency');
      throw e;
    }
  }

  async unlinkQuestion(orgId: string, competencyId: string, questionId: string) {
    await this.findOne(orgId, competencyId);
    const link = await this.prisma.questionCompetency.findFirst({
      where: { competencyId, orgQuestionId: questionId },
    });
    if (!link) throw new NotFoundException('Question link not found');
    await this.prisma.questionCompetency.delete({ where: { id: link.id } });
  }

  // ── Domains ───────────────────────────────────────────────────────────────

  async listDomains(orgId: string, competencyId: string) {
    await this.findOne(orgId, competencyId);
    return this.prisma.competencyDomain.findMany({ where: { competencyId } });
  }

  async addDomain(orgId: string, competencyId: string, dto: AddDomainDto) {
    await this.findOne(orgId, competencyId);
    const source = dto.source ?? CompetencyDomainSource.ORG_QUESTION_CATEGORY;
    try {
      return await this.prisma.competencyDomain.create({
        data: { competencyId, domainName: dto.domainName, source },
      });
    } catch (e: any) {
      if (e?.code === 'P2002') throw new ConflictException('Domain already mapped to this competency');
      throw e;
    }
  }

  async removeDomain(orgId: string, competencyId: string, domainId: string) {
    await this.findOne(orgId, competencyId);
    const domain = await this.prisma.competencyDomain.findFirst({
      where: { id: domainId, competencyId },
    });
    if (!domain) throw new NotFoundException('Domain not found');
    await this.prisma.competencyDomain.delete({ where: { id: domainId } });
  }
}
