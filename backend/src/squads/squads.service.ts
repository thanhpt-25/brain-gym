import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
  GoneException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrgKind, OrgRole, OrgMember } from '@prisma/client';
import { CreateSquadDto } from './dto/create-squad.dto';
import {
  FF_SQUADS_BETA,
  SQUAD_INVITE_TTL_DAYS,
  SQUAD_INVITE_DAILY_LIMIT,
} from './squads.constants';

@Injectable()
export class SquadsService {
  constructor(private readonly prisma: PrismaService) {}

  assertFlagEnabled(): void {
    if (process.env[FF_SQUADS_BETA] !== 'true') {
      throw new NotFoundException('Squads beta not enabled');
    }
  }

  /**
   * Create a new Squad (Organization with kind=SQUAD) and assign the creator as OWNER.
   *
   * Constraint note: Squads cannot own Catalog or Assessment resources. This constraint
   * is enforced in the Catalog and Assessment services by checking org.kind !== SQUAD.
   * No DB enforcement is required here.
   */
  async create(
    userId: string,
    dto: CreateSquadDto,
  ): Promise<{ org: any; member: OrgMember }> {
    const slug = this.slugify(dto.name);

    const org = await this.prisma.organization.create({
      data: {
        name: dto.name,
        slug,
        kind: OrgKind.SQUAD,
        certificationId: dto.certificationId,
        targetExamDate: dto.targetExamDate
          ? new Date(dto.targetExamDate)
          : null,
      },
    });

    const member = await this.prisma.orgMember.create({
      data: {
        userId,
        orgId: org.id,
        role: OrgRole.OWNER,
        isActive: true,
      },
    });

    return { org, member };
  }

  async createInvite(
    userId: string,
    squadId: string,
  ): Promise<{ inviteUrl: string; code: string; expiresAt: Date }> {
    const membership = await this.prisma.orgMember.findFirst({
      where: { userId, orgId: squadId, isActive: true },
    });

    if (!membership || membership.role !== OrgRole.OWNER) {
      throw new ForbiddenException('Only squad owners can create invites');
    }

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const dailyCount = await this.prisma.orgJoinLink.count({
      where: {
        orgId: squadId,
        createdAt: { gte: startOfDay },
      },
    });

    if (dailyCount >= SQUAD_INVITE_DAILY_LIMIT) {
      throw new BadRequestException(
        `Daily invite limit of ${SQUAD_INVITE_DAILY_LIMIT} reached for this squad`,
      );
    }

    const code = this.generateCode();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + SQUAD_INVITE_TTL_DAYS);

    const link = await this.prisma.orgJoinLink.create({
      data: {
        orgId: squadId,
        code,
        maxUses: 1,
        currentUses: 0,
        expiresAt,
        isActive: true,
      },
    });

    return {
      inviteUrl: `/squads/join/${link.code}`,
      code: link.code,
      expiresAt: link.expiresAt,
    };
  }

  async join(userId: string, code: string): Promise<OrgMember> {
    return this.prisma.$transaction(async (tx) => {
      const link = await tx.orgJoinLink.findUnique({ where: { code } });

      if (!link || !link.isActive) {
        throw new NotFoundException('Invite link not found or inactive');
      }

      if (link.expiresAt && link.expiresAt < new Date()) {
        throw new GoneException('Invite link has expired');
      }

      if (link.maxUses !== null && link.currentUses >= link.maxUses) {
        throw new BadRequestException('Invite link has already been used');
      }

      const existing = await tx.orgMember.findFirst({
        where: { userId, orgId: link.orgId, isActive: true },
      });

      if (existing) {
        throw new ConflictException('User is already a member of this squad');
      }

      const member = await tx.orgMember.create({
        data: {
          userId,
          orgId: link.orgId,
          role: OrgRole.MEMBER,
          isActive: true,
        },
      });

      await tx.orgJoinLink.update({
        where: { id: link.id },
        data: { currentUses: { increment: 1 } },
      });

      return member;
    });
  }

  private slugify(text: string): string {
    const base = text
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^\w-]/g, '');
    const suffix = Math.random().toString(36).substring(2, 6);
    return `${base}-${suffix}`;
  }

  private generateCode(): string {
    return (
      Math.random().toString(36).substring(2, 10) +
      Math.random().toString(36).substring(2, 10)
    );
  }
}
