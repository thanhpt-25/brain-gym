import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { CreateOrgDto } from './dto/create-org.dto';
import { UpdateOrgDto } from './dto/update-org.dto';
import { InviteMemberDto, BulkInviteMemberDto } from './dto/invite-member.dto';
import { CreateJoinLinkDto } from './dto/create-join-link.dto';
import { CreateGroupDto, UpdateGroupDto } from './dto/create-group.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { OrgRole, OrgInviteStatus } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  private slugify(text: string): string {
    return text
      .toString()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^\w\-]+/g, '')
      .replace(/\-\-+/g, '-')
      .replace(/^-+/, '')
      .replace(/-+$/, '') + '-' + Math.random().toString(36).substring(2, 6);
  }

  async resolveOrgId(slugOrId: string): Promise<string> {
    const org = await this.prisma.organization.findFirst({
        where: { OR: [{ id: slugOrId }, { slug: slugOrId }] }
    });
    if (!org) throw new NotFoundException('Organization not found');
    return org.id;
  }

  async create(userId: string, dto: CreateOrgDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const slug = this.slugify(dto.name);

    return this.prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          name: dto.name,
          slug,
          description: dto.description,
          industry: dto.industry,
          logoUrl: dto.logoUrl,
          accentColor: dto.accentColor,
        },
      });

      await tx.orgMember.create({
        data: {
          orgId: org.id,
          userId,
          role: OrgRole.OWNER,
        },
      });

      return org;
    });
  }

  async findMyOrgs(userId: string) {
    const memberships = await this.prisma.orgMember.findMany({
      where: { userId, isActive: true },
      include: {
        organization: {
            include: {
                _count: { select: { members: { where: { isActive: true } } } }
            }
        }
      },
      orderBy: { joinedAt: 'desc' }
    });
    return memberships.map((m) => ({
      ...m.organization,
      myRole: m.role,
    }));
  }

  async findOne(slugOrId: string) {
    const org = await this.prisma.organization.findFirst({
      where: { OR: [{ id: slugOrId }, { slug: slugOrId }] },
      include: {
        _count: {
          select: { members: { where: { isActive: true } } },
        },
      },
    });
    if (!org) throw new NotFoundException('Organization not found');
    return org;
  }

  async update(slugOrId: string, dto: UpdateOrgDto) {
    const orgId = await this.resolveOrgId(slugOrId);
    return this.prisma.organization.update({
      where: { id: orgId },
      data: dto,
    });
  }

  async remove(slugOrId: string) {
    const orgId = await this.resolveOrgId(slugOrId);
    return this.prisma.organization.delete({
      where: { id: orgId },
    });
  }

  async findMembers(slugOrId: string, page = 1, limit = 20) {
    const orgId = await this.resolveOrgId(slugOrId);
    const skip = (page - 1) * limit;
    const [total, data] = await Promise.all([
      this.prisma.orgMember.count({ where: { orgId } }),
      this.prisma.orgMember.findMany({
        where: { orgId },
        include: {
          user: { select: { id: true, email: true, displayName: true, avatarUrl: true } },
          group: { select: { id: true, name: true } },
        },
        orderBy: { joinedAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);
    return { data, meta: { total, page, limit, lastPage: Math.ceil(total / limit) } };
  }

  async inviteMember(slugOrId: string, invitedByUserId: string, dto: InviteMemberDto) {
    const orgId = await this.resolveOrgId(slugOrId);
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      include: {
        _count: {
          select: { members: { where: { isActive: true } } },
        },
      },
    });
    if (!org) throw new NotFoundException('Organization not found');
    
    if (org._count.members >= org.maxSeats) {
      throw new BadRequestException('Organization has reached its maximum seats');
    }

    const invitedBy = await this.prisma.user.findUnique({ where: { id: invitedByUserId } });
    const token = uuidv4();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const invite = await this.prisma.orgInvite.create({
      data: {
        orgId,
        email: dto.email,
        role: dto.role,
        token,
        invitedBy: invitedBy?.id || '',
        expiresAt,
      },
    });

    await this.mailService.sendOrgInvite(
      dto.email,
      org.name,
      token,
      invitedBy?.displayName || 'Someone',
    );

    return invite;
  }

  async bulkInvite(slugOrId: string, invitedByUserId: string, dto: BulkInviteMemberDto) {
      const invites = [];
      for (const inv of dto.invites) {
          try {
              invites.push(await this.inviteMember(slugOrId, invitedByUserId, inv));
          } catch(e) {
              // Ignore or collect errors
          }
      }
      return invites;
  }

  async updateMemberRole(slugOrId: string, userId: string, dto: UpdateMemberRoleDto) {
    const orgId = await this.resolveOrgId(slugOrId);
    return this.prisma.orgMember.update({
      where: { orgId_userId: { orgId, userId } },
      data: { role: dto.role },
    });
  }

  async removeMember(slugOrId: string, userId: string) {
    const orgId = await this.resolveOrgId(slugOrId);
    return this.prisma.orgMember.delete({
      where: { orgId_userId: { orgId, userId } },
    });
  }

  async createJoinLink(slugOrId: string, dto: CreateJoinLinkDto) {
    const orgId = await this.resolveOrgId(slugOrId);
    const code = uuidv4().substring(0, 8);
    return this.prisma.orgJoinLink.create({
      data: {
        orgId,
        code,
        maxUses: dto.maxUses,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      },
    });
  }

  async createGroup(slugOrId: string, dto: CreateGroupDto) {
    const orgId = await this.resolveOrgId(slugOrId);
    return this.prisma.orgGroup.create({
      data: {
        orgId,
        name: dto.name,
        description: dto.description,
      },
    });
  }

  async findGroups(slugOrId: string) {
    const orgId = await this.resolveOrgId(slugOrId);
    return this.prisma.orgGroup.findMany({
      where: { orgId },
      include: {
        _count: { select: { members: true } },
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async updateGroup(slugOrId: string, groupId: string, dto: UpdateGroupDto) {
    const orgId = await this.resolveOrgId(slugOrId);
    return this.prisma.orgGroup.update({
      where: { id: groupId, orgId }, // orgId ensures it belongs to the org
      data: dto,
    });
  }

  async acceptInvite(userId: string, token: string) {
    const invite = await this.prisma.orgInvite.findUnique({
      where: { token },
      include: { organization: true },
    });

    if (!invite) throw new NotFoundException('Invalid invitation link');
    if (invite.status !== OrgInviteStatus.PENDING) throw new BadRequestException('Invitation is no longer pending');
    if (invite.expiresAt < new Date()) {
      await this.prisma.orgInvite.update({ where: { id: invite.id }, data: { status: OrgInviteStatus.EXPIRED } });
      throw new BadRequestException('Invitation has expired');
    }

    const orgCount = await this.prisma.orgMember.count({
        where: { orgId: invite.orgId, isActive: true }
    });
    if (orgCount >= invite.organization.maxSeats) {
        throw new BadRequestException('Organization has reached its maximum seats');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.orgInvite.update({
        where: { id: invite.id },
        data: { status: OrgInviteStatus.ACCEPTED },
      });

      const member = await tx.orgMember.upsert({
        where: { orgId_userId: { orgId: invite.orgId, userId } },
        create: {
          orgId: invite.orgId,
          userId,
          role: invite.role,
        },
        update: {
          isActive: true,
          role: invite.role,
        },
      });

      return member;
    });
  }

  async joinViaLink(userId: string, code: string) {
    const link = await this.prisma.orgJoinLink.findUnique({
      where: { code },
      include: { organization: true },
    });

    if (!link || !link.isActive) throw new NotFoundException('Invalid or inactive join link');
    if (link.expiresAt && link.expiresAt < new Date()) throw new BadRequestException('Join link has expired');
    if (link.maxUses && link.currentUses >= link.maxUses) throw new BadRequestException('Join link has reached usage limit');

    const orgCount = await this.prisma.orgMember.count({
        where: { orgId: link.orgId, isActive: true }
    });
    if (orgCount >= link.organization.maxSeats) {
        throw new BadRequestException('Organization has reached its maximum seats');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.orgJoinLink.update({
        where: { id: link.id },
        data: { currentUses: { increment: 1 } },
      });

      const member = await tx.orgMember.upsert({
        where: { orgId_userId: { orgId: link.orgId, userId } },
        create: {
          orgId: link.orgId,
          userId,
          role: OrgRole.MEMBER,
        },
        update: {
          isActive: true,
        },
      });

      return member;
    });
  }
}
