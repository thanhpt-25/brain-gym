import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSquadDto } from './dto/create-squad.dto';
import { SquadDto } from './dto/squad.dto';
import { InviteLinkDto } from './dto/invite-link.dto';
import { SQUADS } from './squads.constants';

@Injectable()
export class SquadsService {
  private readonly logger = new Logger(SquadsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new squad (Organization with kind='SQUAD')
   * Only PREMIUM/ENTERPRISE users can create squads
   */
  async createSquad(userId: string, dto: CreateSquadDto): Promise<SquadDto> {
    // 1. Validate user plan (no FREE users)
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.plan === 'FREE') {
      throw new ForbiddenException(SQUADS.ERRORS.FREE_USER_CANNOT_CREATE);
    }

    // 2. Validate certification exists
    const certification = await this.prisma.certification.findUnique({
      where: { id: dto.certificationId },
    });

    if (!certification) {
      throw new BadRequestException(SQUADS.ERRORS.CERTIFICATION_NOT_FOUND);
    }

    // 3. Create Organization with kind='SQUAD'
    const slug = this.generateSlug(dto.name);

    const organization = await this.prisma.organization.create({
      data: {
        name: dto.name,
        slug,
        kind: SQUADS.ORG_KIND as any, // 'SQUAD'
        certificationId: dto.certificationId,
        targetExamDate: dto.targetExamDate
          ? new Date(dto.targetExamDate)
          : null,
        maxSeats: 50, // Default squad capacity
      },
      include: {
        members: true,
      },
    });

    // 4. Add creator as OWNER via OrgMember
    await this.prisma.orgMember.create({
      data: {
        orgId: organization.id,
        userId,
        role: 'OWNER',
        isActive: true,
      },
    });

    this.logger.log(`Squad created: ${organization.id} by user ${userId}`);

    // 5. Return SquadDto
    return new SquadDto({
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      certificationId: organization.certificationId || '',
      targetExamDate: organization.targetExamDate || undefined,
      memberCount: 1, // Creator is the first member
      createdAt: organization.createdAt,
    });
  }

  /**
   * Generate invite link for squad
   * Enforces daily rate limit (max 10 invites per owner per day)
   */
  async createInviteLink(
    squadId: string,
    ownerId: string,
  ): Promise<InviteLinkDto> {
    // 1. Verify caller is OWNER/ADMIN (assumed to be checked by guard)
    const squad = await this.prisma.organization.findUnique({
      where: { id: squadId },
    });

    if (!squad) {
      throw new NotFoundException(SQUADS.ERRORS.SQUAD_NOT_FOUND);
    }

    if (squad.kind !== SQUADS.ORG_KIND) {
      throw new BadRequestException('Organization is not a squad');
    }

    // 2. Enforce daily limit (max 10/day per owner)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const inviteCount = await this.prisma.orgInvite.count({
      where: {
        orgId: squadId,
        invitedBy: ownerId,
        createdAt: {
          gte: oneDayAgo,
        },
        status: 'PENDING',
      },
    });

    if (inviteCount >= SQUADS.INVITE_LINK_DAILY_LIMIT) {
      throw new BadRequestException(SQUADS.ERRORS.INVITE_LIMIT_EXCEEDED);
    }

    // 3. Generate signed UUID token (7-day TTL)
    const token = randomUUID();
    const expiresAt = new Date(Date.now() + SQUADS.INVITE_TOKEN_TTL_MS);

    // 4. Create OrgInvite with token
    const invite = await this.prisma.orgInvite.create({
      data: {
        orgId: squadId,
        email: '', // Token-based invite (no email required for squads)
        token,
        status: 'PENDING',
        invitedBy: ownerId,
        expiresAt,
      },
    });

    this.logger.log(`Invite link created for squad ${squadId} by ${ownerId}`);

    // 5. Return InviteLinkDto with full join URL
    const appUrl = process.env.APP_URL || 'https://brain-gym.com';
    const joinUrl = `${appUrl}/squads/join/${token}`;

    return new InviteLinkDto({
      token,
      expiresAt,
      squadName: squad.name,
      joinUrl,
    });
  }

  /**
   * Join squad via invite token
   * Validates token, checks capacity, adds user as MEMBER
   */
  async joinSquad(token: string, userId: string): Promise<SquadDto> {
    // 1. Find OrgInvite by token
    const invite = await this.prisma.orgInvite.findUnique({
      where: { token },
    });

    if (!invite) {
      throw new BadRequestException(SQUADS.ERRORS.INVITE_EXPIRED);
    }

    // 2. Validate not expired, status=PENDING
    if (invite.status !== 'PENDING') {
      throw new BadRequestException(SQUADS.ERRORS.INVITE_ALREADY_ACCEPTED);
    }

    if (invite.expiresAt < new Date()) {
      throw new BadRequestException(SQUADS.ERRORS.INVITE_EXPIRED);
    }

    // Fetch squad
    const squad = await this.prisma.organization.findUnique({
      where: { id: invite.orgId },
      include: {
        members: true,
      },
    });

    if (!squad) {
      throw new NotFoundException(SQUADS.ERRORS.SQUAD_NOT_FOUND);
    }

    // 3. Check squad capacity (org.maxSeats vs current members)
    if (squad.members.length >= squad.maxSeats) {
      throw new BadRequestException(SQUADS.ERRORS.SQUAD_AT_CAPACITY);
    }

    // 4. Upsert OrgMember (idempotent - if already exists, update, else create)
    const existingMember = await this.prisma.orgMember.findUnique({
      where: {
        orgId_userId: {
          orgId: squad.id,
          userId,
        },
      },
    });

    if (!existingMember) {
      await this.prisma.orgMember.create({
        data: {
          orgId: squad.id,
          userId,
          role: 'MEMBER',
          isActive: true,
        },
      });
    } else {
      // Reactivate if previously inactive
      await this.prisma.orgMember.update({
        where: {
          orgId_userId: {
            orgId: squad.id,
            userId,
          },
        },
        data: {
          isActive: true,
        },
      });
    }

    // 5. Update OrgInvite status to ACCEPTED
    await this.prisma.orgInvite.update({
      where: { id: invite.id },
      data: {
        status: 'ACCEPTED',
      },
    });

    this.logger.log(`User ${userId} joined squad ${squad.id}`);

    // Fetch updated member count
    const updatedMembers = await this.prisma.orgMember.count({
      where: {
        orgId: squad.id,
        isActive: true,
      },
    });

    // Return SquadDto
    return new SquadDto({
      id: squad.id,
      name: squad.name,
      slug: squad.slug,
      certificationId: squad.certificationId || '',
      targetExamDate: squad.targetExamDate || undefined,
      memberCount: updatedMembers,
      createdAt: squad.createdAt,
    });
  }

  /**
   * Get squad by slug
   * (Used by frontend dashboard)
   */
  async getSquadBySlug(slug: string): Promise<SquadDto> {
    const squad = await this.prisma.organization.findUnique({
      where: { slug },
      include: {
        members: true,
      },
    });

    if (!squad) {
      throw new NotFoundException(SQUADS.ERRORS.SQUAD_NOT_FOUND);
    }

    if (squad.kind !== SQUADS.ORG_KIND) {
      throw new BadRequestException('Organization is not a squad');
    }

    return new SquadDto({
      id: squad.id,
      name: squad.name,
      slug: squad.slug,
      certificationId: squad.certificationId || '',
      targetExamDate: squad.targetExamDate || undefined,
      memberCount: squad.members.length,
      createdAt: squad.createdAt,
    });
  }

  /**
   * Generate URL-friendly slug from squad name
   */
  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }
}
