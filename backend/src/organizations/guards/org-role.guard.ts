import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { ORG_ROLES_KEY } from '../../common/decorators/org-roles.decorator';
import { OrgRole } from '@prisma/client';

@Injectable()
export class OrgRoleGuard implements CanActivate {
  constructor(private reflector: Reflector, private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<OrgRole[]>(ORG_ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const orgId = request.params.orgId || request.params.slug;

    if (!user) return false;
    
    if (!orgId) throw new ForbiddenException('Organization context missing');

    const membership = await this.prisma.orgMember.findFirst({
        where: {
            userId: user.id,
            isActive: true,
            OR: [
                { orgId: orgId },
                { organization: { slug: orgId } }
            ]
        }
    });

    if (!membership) {
      throw new ForbiddenException('You are not an active member of this organization');
    }

    if (!requiredRoles || requiredRoles.length === 0) {
      return true; // Any role is fine (must be member)
    }

    if (!requiredRoles.includes(membership.role)) {
      throw new ForbiddenException(`Requires one of roles: ${requiredRoles.join(', ')}`);
    }

    return true;
  }
}
