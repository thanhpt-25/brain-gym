import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto, CampaignStatus } from './dto/update-campaign.dto';
import { AssignCampaignDto } from './dto/assign-campaign.dto';

@Injectable()
export class CampaignsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orgsService: OrganizationsService,
  ) {}

  private computeNextRunAt(dueDate: Date, interval: string): Date {
    const next = new Date(dueDate);
    const months =
      interval === 'MONTHLY_3' ? 3 : interval === 'MONTHLY_6' ? 6 : 12;
    next.setMonth(next.getMonth() + months);
    return next;
  }

  private async computeProgress(campaignId: string) {
    const total = await this.prisma.orgExamAssignment.count({
      where: { campaignId },
    });
    if (total === 0) return { total: 0, completed: 0, pct: 0 };

    // Submitted count via apply links sourced from this campaign's org.
    // A direct campaignId→invite link requires a schema addition in a future
    // sprint; for now we count invites submitted through public apply links
    // belonging to the same org and assessment as this campaign.
    const campaign = await this.prisma.assessmentCampaign.findUnique({
      where: { id: campaignId },
      select: { orgId: true },
    });
    if (!campaign) return { total, completed: 0, pct: 0 };

    const submitted = await this.prisma.candidateInvite.count({
      where: {
        assessment: { orgId: campaign.orgId },
        status: 'SUBMITTED',
        applyLinkId: { not: null },
      },
    });

    const completed = Math.min(submitted, total);
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, pct };
  }

  async list(slugOrId: string, filter?: string) {
    if (filter !== undefined && filter !== 'upcoming') {
      throw new BadRequestException(`Unknown filter: "${filter}"`);
    }

    const orgId = await this.orgsService.resolveOrgId(slugOrId);
    const where: any = { orgId };

    if (filter === 'upcoming') {
      const in14Days = new Date();
      in14Days.setDate(in14Days.getDate() + 14);
      where.status = 'ACTIVE';
      where.dueDate = { lte: in14Days, gte: new Date() };
    }

    const campaigns = await this.prisma.assessmentCampaign.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        catalogItem: { select: { id: true, title: true } },
        _count: { select: { assignments: true } },
      },
    });

    if (campaigns.length === 0) return [];

    // Single query for all submitted invites in the org — avoids N+1.
    // This is an approximation; a direct campaignId FK on CandidateInvite
    // (planned for a future sprint) will give per-campaign accuracy.
    const submittedCount = await this.prisma.candidateInvite.count({
      where: {
        assessment: { orgId },
        status: 'SUBMITTED',
        applyLinkId: { not: null },
      },
    });

    return campaigns.map((c) => {
      const total = c._count.assignments;
      const completed = Math.min(submittedCount, total);
      const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
      const daysRemaining = c.dueDate
        ? Math.ceil((c.dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        : null;
      return { ...c, progress: { total, completed, pct }, daysRemaining };
    });
  }

  async get(slugOrId: string, campaignId: string) {
    const orgId = await this.orgsService.resolveOrgId(slugOrId);
    const campaign = await this.prisma.assessmentCampaign.findFirst({
      where: { id: campaignId, orgId },
      include: {
        catalogItem: { select: { id: true, title: true } },
        assignments: {
          include: {
            group: { select: { id: true, name: true } },
          },
        },
      },
    });
    if (!campaign) throw new NotFoundException('Campaign not found');
    const progress = await this.computeProgress(campaignId);
    return { ...campaign, progress };
  }

  async create(slugOrId: string, dto: CreateCampaignDto, userId: string) {
    const orgId = await this.orgsService.resolveOrgId(slugOrId);

    if (dto.recurrenceEnabled && !dto.dueDate) {
      throw new BadRequestException(
        'dueDate is required when recurrenceEnabled is true',
      );
    }
    if (dto.recurrenceEnabled && !dto.recurrenceInterval) {
      throw new BadRequestException(
        'recurrenceInterval is required when recurrenceEnabled is true',
      );
    }

    const catalogItem = await this.prisma.examCatalogItem.findFirst({
      where: { id: dto.catalogItemId, organization: { id: orgId } },
    });
    if (!catalogItem)
      throw new NotFoundException('Catalog item not found in this org');

    const dueDate = dto.dueDate ? new Date(dto.dueDate) : null;
    if (dueDate && dueDate <= new Date()) {
      throw new BadRequestException('dueDate must be in the future');
    }

    const nextRunAt =
      dto.recurrenceEnabled && dueDate && dto.recurrenceInterval
        ? this.computeNextRunAt(dueDate, dto.recurrenceInterval)
        : null;

    try {
      return await this.prisma.assessmentCampaign.create({
        data: {
          orgId,
          name: dto.name,
          description: dto.description,
          catalogItemId: dto.catalogItemId,
          dueDate,
          recurrenceEnabled: dto.recurrenceEnabled ?? false,
          recurrenceInterval: dto.recurrenceInterval ?? null,
          nextRunAt,
          createdBy: userId,
        },
      });
    } catch (e: any) {
      if (e.code === 'P2002')
        throw new ConflictException('Campaign name already exists in this org');
      throw e;
    }
  }

  async update(slugOrId: string, campaignId: string, dto: UpdateCampaignDto) {
    const orgId = await this.orgsService.resolveOrgId(slugOrId);
    const campaign = await this.prisma.assessmentCampaign.findFirst({
      where: { id: campaignId, orgId },
    });
    if (!campaign) throw new NotFoundException('Campaign not found');

    if (dto.status === CampaignStatus.DRAFT && campaign.status !== 'DRAFT') {
      throw new BadRequestException('Cannot revert status to DRAFT');
    }
    if (campaign.status === 'CLOSED' && dto.status && dto.status !== 'CLOSED') {
      throw new BadRequestException('Cannot reopen a CLOSED campaign');
    }

    const dueDate = dto.dueDate ? new Date(dto.dueDate) : undefined;
    const nextRunAt =
      dto.recurrenceEnabled && dueDate && dto.recurrenceInterval
        ? this.computeNextRunAt(dueDate, dto.recurrenceInterval)
        : undefined;

    try {
      return await this.prisma.assessmentCampaign.update({
        where: { id: campaignId },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.description !== undefined && {
            description: dto.description,
          }),
          ...(dueDate !== undefined && { dueDate }),
          ...(dto.status !== undefined && { status: dto.status }),
          ...(dto.recurrenceEnabled !== undefined && {
            recurrenceEnabled: dto.recurrenceEnabled,
          }),
          ...(dto.recurrenceInterval !== undefined && {
            recurrenceInterval: dto.recurrenceInterval,
          }),
          ...(nextRunAt !== undefined && { nextRunAt }),
        },
      });
    } catch (e: any) {
      if (e.code === 'P2002')
        throw new ConflictException('Campaign name already exists in this org');
      throw e;
    }
  }

  async remove(slugOrId: string, campaignId: string) {
    const orgId = await this.orgsService.resolveOrgId(slugOrId);
    const campaign = await this.prisma.assessmentCampaign.findFirst({
      where: { id: campaignId, orgId },
    });
    if (!campaign) throw new NotFoundException('Campaign not found');
    if (campaign.status !== 'DRAFT') {
      throw new ConflictException('Only DRAFT campaigns can be deleted');
    }
    await this.prisma.assessmentCampaign.delete({ where: { id: campaignId } });
  }

  async activate(slugOrId: string, campaignId: string) {
    const orgId = await this.orgsService.resolveOrgId(slugOrId);
    const campaign = await this.prisma.assessmentCampaign.findFirst({
      where: { id: campaignId, orgId },
      include: { _count: { select: { assignments: true } } },
    });
    if (!campaign) throw new NotFoundException('Campaign not found');
    if (campaign.status !== 'DRAFT') {
      throw new BadRequestException('Only DRAFT campaigns can be activated');
    }
    if (campaign._count.assignments === 0) {
      throw new BadRequestException(
        'Campaign must have at least one assignment before activating',
      );
    }
    return this.prisma.assessmentCampaign.update({
      where: { id: campaignId },
      data: { status: 'ACTIVE' },
    });
  }

  async assign(slugOrId: string, campaignId: string, dto: AssignCampaignDto) {
    const orgId = await this.orgsService.resolveOrgId(slugOrId);
    const campaign = await this.prisma.assessmentCampaign.findFirst({
      where: { id: campaignId, orgId },
    });
    if (!campaign) throw new NotFoundException('Campaign not found');
    if (campaign.status === 'CLOSED') {
      throw new BadRequestException('Cannot assign to a CLOSED campaign');
    }

    const existing = await this.prisma.orgExamAssignment.findMany({
      where: { campaignId },
      select: { groupId: true, memberId: true },
    });
    const existingGroupIds = new Set(
      existing.filter((e) => e.groupId).map((e) => e.groupId!),
    );
    const existingMemberIds = new Set(
      existing.filter((e) => e.memberId).map((e) => e.memberId!),
    );

    const newGroupIds = (dto.groupIds ?? []).filter(
      (id) => !existingGroupIds.has(id),
    );
    const newMemberIds = (dto.memberIds ?? []).filter(
      (id) => !existingMemberIds.has(id),
    );

    // Batch-validate groups and members belong to the org
    if (newGroupIds.length > 0) {
      const validGroups = await this.prisma.orgGroup.findMany({
        where: { id: { in: newGroupIds }, orgId },
        select: { id: true },
      });
      const validGroupSet = new Set(validGroups.map((g) => g.id));
      const invalid = newGroupIds.find((id) => !validGroupSet.has(id));
      if (invalid)
        throw new BadRequestException(`Group ${invalid} not found in org`);
    }

    if (newMemberIds.length > 0) {
      const validMembers = await this.prisma.orgMember.findMany({
        where: { id: { in: newMemberIds }, orgId },
        select: { id: true },
      });
      const validMemberSet = new Set(validMembers.map((m) => m.id));
      const invalid = newMemberIds.find((id) => !validMemberSet.has(id));
      if (invalid)
        throw new BadRequestException(`Member ${invalid} not found in org`);
    }

    const toCreate = [
      ...newGroupIds.map((groupId) => ({
        catalogItemId: campaign.catalogItemId,
        groupId,
        dueDate: campaign.dueDate ?? undefined,
        campaignId,
      })),
      ...newMemberIds.map((memberId) => ({
        catalogItemId: campaign.catalogItemId,
        memberId,
        dueDate: campaign.dueDate ?? undefined,
        campaignId,
      })),
    ];

    if (toCreate.length > 0) {
      await this.prisma.orgExamAssignment.createMany({ data: toCreate });
    }

    const skipped =
      (dto.groupIds?.length ?? 0) +
      (dto.memberIds?.length ?? 0) -
      toCreate.length;
    return { created: toCreate.length, skipped };
  }

  async getProgress(slugOrId: string, campaignId: string) {
    const orgId = await this.orgsService.resolveOrgId(slugOrId);
    const campaign = await this.prisma.assessmentCampaign.findFirst({
      where: { id: campaignId, orgId },
    });
    if (!campaign) throw new NotFoundException('Campaign not found');
    return this.computeProgress(campaignId);
  }
}
