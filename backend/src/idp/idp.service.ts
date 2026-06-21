import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface UpsertReviewDto {
  note: string;
  direction?: string;
}

export interface CreateIdpDto {
  competencyId: string;
  trackId: string;
  targetLevel: number;
  dueDate?: string;
}

@Injectable()
export class IdpService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Campaign Member Reviews (US-B4) ─────────────────────────────

  async upsertReview(
    orgId: string,
    campaignId: string,
    memberId: string,
    reviewedBy: string,
    dto: UpsertReviewDto,
  ) {
    const campaign = await this.prisma.assessmentCampaign.findFirst({
      where: { id: campaignId, orgId },
    });
    if (!campaign) throw new NotFoundException('Campaign not found');

    const member = await this.prisma.orgMember.findFirst({
      where: { id: memberId, orgId },
    });
    if (!member) throw new NotFoundException('Member not found');

    return this.prisma.campaignMemberReview.upsert({
      where: { campaignId_memberId: { campaignId, memberId } },
      create: {
        orgId,
        campaignId,
        memberId,
        reviewedBy,
        note: dto.note,
        direction: dto.direction,
      },
      update: {
        note: dto.note,
        direction: dto.direction,
        reviewedBy,
      },
    });
  }

  async getReview(orgId: string, campaignId: string, memberId: string) {
    const review = await this.prisma.campaignMemberReview.findUnique({
      where: { campaignId_memberId: { campaignId, memberId } },
      include: {
        member: { include: { user: { select: { displayName: true } } } },
      },
    });
    if (!review) throw new NotFoundException('Review not found');
    if (review.orgId !== orgId) throw new NotFoundException('Review not found');
    return review;
  }

  async listCampaignReviews(orgId: string, campaignId: string) {
    const campaign = await this.prisma.assessmentCampaign.findFirst({
      where: { id: campaignId, orgId },
    });
    if (!campaign) throw new NotFoundException('Campaign not found');

    const reviews = await this.prisma.campaignMemberReview.findMany({
      where: { campaignId, orgId },
      include: {
        member: {
          include: { user: { select: { displayName: true, email: true } } },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return reviews.map((r) => ({
      memberId: r.memberId,
      memberName: r.member.user.displayName,
      memberEmail: r.member.user.email,
      note: r.note,
      direction: r.direction,
      reviewedBy: r.reviewedBy,
      updatedAt: r.updatedAt,
    }));
  }

  // ─── Member IDPs (US-B4) ─────────────────────────────────────────

  async createIdp(
    orgId: string,
    memberId: string,
    createdBy: string,
    dto: CreateIdpDto,
  ) {
    const member = await this.prisma.orgMember.findFirst({
      where: { id: memberId, orgId },
    });
    if (!member) throw new NotFoundException('Member not found');

    const track = await this.prisma.learningTrack.findFirst({
      where: { id: dto.trackId, orgId },
    });
    if (!track) throw new NotFoundException('Learning track not found');

    const existing = await this.prisma.memberIdp.findFirst({
      where: { memberId, competencyId: dto.competencyId, trackId: dto.trackId },
    });
    if (existing)
      throw new ConflictException(
        'IDP already exists for this competency + track',
      );

    return this.prisma.memberIdp.create({
      data: {
        orgId,
        memberId,
        competencyId: dto.competencyId,
        trackId: dto.trackId,
        targetLevel: dto.targetLevel,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        createdBy,
      },
      include: {
        competency: { select: { name: true } },
        track: { select: { name: true } },
      },
    });
  }

  async listIdps(
    orgId: string,
    memberId: string,
    requesterId: string,
    requesterRole: string,
  ) {
    const member = await this.prisma.orgMember.findFirst({
      where: { id: memberId, orgId },
    });
    if (!member) throw new NotFoundException('Member not found');

    if (requesterRole === 'MEMBER') {
      const requesterMember = await this.prisma.orgMember.findFirst({
        where: { orgId, userId: requesterId },
      });
      if (!requesterMember || requesterMember.id !== memberId)
        throw new ForbiddenException();
    }

    const idps = await this.prisma.memberIdp.findMany({
      where: { memberId, orgId },
      include: {
        competency: { select: { name: true, scaleMin: true, scaleMax: true } },
        track: { select: { name: true } },
      },
      orderBy: { dueDate: 'asc' },
    });

    return idps.map((idp) => ({
      id: idp.id,
      competencyId: idp.competencyId,
      competencyName: idp.competency.name,
      trackId: idp.trackId,
      trackName: idp.track.name,
      targetLevel: idp.targetLevel,
      scaleMax: idp.competency.scaleMax,
      dueDate: idp.dueDate,
      completedAt: idp.completedAt,
      status: idp.completedAt
        ? 'COMPLETED'
        : idp.dueDate && idp.dueDate < new Date()
          ? 'OVERDUE'
          : 'PENDING',
    }));
  }

  async completeIdp(orgId: string, memberId: string, idpId: string) {
    const idp = await this.prisma.memberIdp.findFirst({
      where: { id: idpId, memberId, orgId },
    });
    if (!idp) throw new NotFoundException('IDP not found');

    return this.prisma.memberIdp.update({
      where: { id: idpId },
      data: { completedAt: new Date() },
    });
  }

  async deleteIdp(orgId: string, memberId: string, idpId: string) {
    const idp = await this.prisma.memberIdp.findFirst({
      where: { id: idpId, memberId, orgId },
    });
    if (!idp) throw new NotFoundException('IDP not found');

    await this.prisma.memberIdp.delete({ where: { id: idpId } });
  }
}
