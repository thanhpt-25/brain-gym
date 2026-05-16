import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSquadDto } from './dto/create-squad.dto';
import { SquadDto } from './dto/squad.dto';
import { InviteLinkDto } from './dto/invite-link.dto';
import { OrgRole, OrgInviteStatus, UserPlan, OrgKind } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class SquadsService {
  constructor(private readonly prisma: PrismaService) {}

  private slugify(text: string): string {
    return (
      text
        .toString()
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^\w-]+/g, '')
        .replace(/--+/g, '-')
        .replace(/^-+/, '')
        .replace(/-+$/, '') +
      '-' +
      Math.random().toString(36).substring(2, 6)
    );
  }

  async createSquad(
    userId: string,
    dto: CreateSquadDto,
  ): Promise<SquadDto> {
    // 1. Validate user exists and get user details
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) throw new NotFoundException('User not found');

    // 2. Validate user plan (no FREE users can create squads)
    if (user.plan === UserPlan.FREE) {
      throw new ForbiddenException(
        'Upgrade to Premium or Enterprise to create a squad.',
      );
    }

    // 3. Validate certification exists
    const certification = await this.prisma.certification.findUnique({
      where: { id: dto.certificationId },
    });
    if (!certification) {
      throw new NotFoundException('Certification not found');
    }

    // 4. Create organization with kind='SQUAD'
    const slug = this.slugify(dto.name);
    const maxSeats =
      user.plan === UserPlan.ENTERPRISE ? 50 : 10;

    return this.prisma.$transaction(async (tx) => {
      // Create the squad (Organization with kind=SQUAD)
      const org = await tx.organization.create({
        data: {
          kind: OrgKind.SQUAD,
          name: dto.name,
          slug,
          maxSeats,
          certificationId: dto.certificationId,
          targetExamDate: dto.targetExamDate
            ? new Date(dto.targetExamDate)
            : undefined,
        },
      });

      // Add creator as OWNER
      await tx.orgMember.create({
        data: {
          orgId: org.id,
          userId,
          role: OrgRole.OWNER,
        },
      });

      // Return SquadDto
      return {
        id: org.id,
        name: org.name,
        slug: org.slug,
        certificationId: org.certificationId!,
        targetExamDate: org.targetExamDate || undefined,
        memberCount: 1, // Creator
        createdAt: org.createdAt,
      };
    });
  }

  async createInviteLink(
    squadId: string,
    ownerId: string,
  ): Promise<InviteLinkDto> {
    // 1. Verify squad exists
    const squad = await this.prisma.organization.findUnique({
      where: { id: squadId },
      include: {
        _count: {
          select: { members: { where: { isActive: true } } },
        },
      },
    });
    if (!squad) {
      throw new NotFoundException('Squad not found');
    }

    // Verify it's actually a squad
    if (squad.kind !== OrgKind.SQUAD) {
      throw new BadRequestException('Organization is not a squad');
    }

    // 2. Verify caller is OWNER/ADMIN (this is enforced by guard, but double-check)
    const memberRole = await this.prisma.orgMember.findUnique({
      where: { orgId_userId: { orgId: squadId, userId: ownerId } },
    });
    if (
      !memberRole ||
      ![OrgRole.OWNER, OrgRole.ADMIN].includes(memberRole.role)
    ) {
      throw new ForbiddenException(
        'Only squad owners and admins can generate invite links',
      );
    }

    // 3. Enforce daily rate limit (max 10/day per owner)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const invitesCreatedToday = await this.prisma.orgInvite.count({
      where: {
        orgId: squadId,
        invitedBy: ownerId,
        createdAt: { gte: today },
      },
    });

    if (invitesCreatedToday >= 10) {
      throw new BadRequestException(
        'You have reached the daily invite limit (10 per day)',
      );
    }

    // 4. Generate token and create OrgInvite
    const token = uuidv4();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7-day TTL

    // Use a placeholder email for squad invites (token-based)
    const placeholderEmail = `squad_${token.substring(0, 8)}@squad.internal`;

    const invite = await this.prisma.orgInvite.create({
      data: {
        orgId: squadId,
        email: placeholderEmail,
        token,
        status: OrgInviteStatus.PENDING,
        invitedBy: ownerId,
        expiresAt,
      },
    });

    // 5. Return InviteLinkDto with full URL
    const appUrl = process.env.APP_URL || 'http://localhost:8080';
    return {
      token: invite.token,
      expiresAt: invite.expiresAt,
      squadName: squad.name,
      joinUrl: `${appUrl}/squads/join/${token}`,
    };
  }

  async joinSquad(token: string, userId: string): Promise<SquadDto> {
    // 1. Find OrgInvite by token
    const invite = await this.prisma.orgInvite.findUnique({
      where: { token },
      include: { organization: true },
    });

    if (!invite) {
      throw new NotFoundException('Invite not found or expired');
    }

    // 2. Validate not expired and status is PENDING
    if (invite.status !== OrgInviteStatus.PENDING) {
      throw new BadRequestException('Invite is no longer valid');
    }

    if (new Date() > invite.expiresAt) {
      // Mark as expired
      await this.prisma.orgInvite.update({
        where: { id: invite.id },
        data: { status: OrgInviteStatus.EXPIRED },
      });
      throw new BadRequestException('Invite has expired');
    }

    // 3. Verify it's a squad
    if (invite.organization.kind !== OrgKind.SQUAD) {
      throw new BadRequestException('Organization is not a squad');
    }

    // 4. Check squad capacity
    const memberCount = await this.prisma.orgMember.count({
      where: { orgId: invite.orgId, isActive: true },
    });

    if (memberCount >= invite.organization.maxSeats) {
      throw new BadRequestException('Squad is at capacity');
    }

    // 5. Upsert OrgMember and update invite status
    return this.prisma.$transaction(async (tx) => {
      // Check if user is already a member
      const existingMember = await tx.orgMember.findUnique({
        where: { orgId_userId: { orgId: invite.orgId, userId } },
      });

      if (!existingMember) {
        // Add as MEMBER
        await tx.orgMember.create({
          data: {
            orgId: invite.orgId,
            userId,
            role: OrgRole.MEMBER,
          },
        });
      }

      // Update invite status to ACCEPTED
      await tx.orgInvite.update({
        where: { id: invite.id },
        data: { status: OrgInviteStatus.ACCEPTED },
      });

      // Get updated member count
      const updatedMemberCount = await tx.orgMember.count({
        where: { orgId: invite.orgId, isActive: true },
      });

      // Return SquadDto
      return {
        id: invite.organization.id,
        name: invite.organization.name,
        slug: invite.organization.slug,
        certificationId: invite.organization.certificationId!,
        targetExamDate: invite.organization.targetExamDate || undefined,
        memberCount: updatedMemberCount,
        createdAt: invite.organization.createdAt,
      };
    });
  }
}
