import { Test, TestingModule } from '@nestjs/testing';
import { SquadsService } from './squads.service';
import { PrismaService } from '@/src/prisma/prisma.service';
import { CreateSquadDto } from './dto/create-squad.dto';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { SQUADS } from './squads.constants';

describe('SquadsService', () => {
  let service: SquadsService;
  let prisma: PrismaService;

  const mockUser = {
    id: 'user-1',
    email: 'user@example.com',
    plan: 'PREMIUM',
  };

  const mockCertification = {
    id: 'cert-1',
    name: 'AWS SAA-C03',
  };

  const mockSquad = {
    id: 'squad-1',
    name: 'AWS SAA Study Group',
    slug: 'aws-saa-study-group',
    kind: 'SQUAD',
    certificationId: 'cert-1',
    targetExamDate: null,
    ownerId: 'user-1',
    maxSeats: 50,
    createdAt: new Date(),
    members: [],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SquadsService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
            },
            certification: {
              findUnique: jest.fn(),
            },
            organization: {
              create: jest.fn(),
              findUnique: jest.fn(),
            },
            orgMember: {
              create: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
              count: jest.fn(),
            },
            orgInvite: {
              create: jest.fn(),
              findUnique: jest.fn(),
              count: jest.fn(),
              update: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<SquadsService>(SquadsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('createSquad', () => {
    it('should reject FREE users', async () => {
      const freeUser = { ...mockUser, plan: 'FREE' };
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(freeUser as any);

      const dto: CreateSquadDto = {
        name: 'Test Squad',
        certificationId: 'cert-1',
      };

      await expect(service.createSquad(freeUser.id, dto)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(service.createSquad(freeUser.id, dto)).rejects.toThrow(
        SQUADS.ERRORS.FREE_USER_CANNOT_CREATE,
      );
    });

    it('should reject if user not found', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(null);

      const dto: CreateSquadDto = {
        name: 'Test Squad',
        certificationId: 'cert-1',
      };

      await expect(service.createSquad('unknown-user', dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should reject if certification does not exist', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockUser as any);
      jest.spyOn(prisma.certification, 'findUnique').mockResolvedValue(null);

      const dto: CreateSquadDto = {
        name: 'Test Squad',
        certificationId: 'unknown-cert',
      };

      await expect(service.createSquad(mockUser.id, dto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.createSquad(mockUser.id, dto)).rejects.toThrow(
        SQUADS.ERRORS.CERTIFICATION_NOT_FOUND,
      );
    });

    it('should create squad with kind=SQUAD and add creator as OWNER', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockUser as any);
      jest
        .spyOn(prisma.certification, 'findUnique')
        .mockResolvedValue(mockCertification as any);
      jest.spyOn(prisma.organization, 'create').mockResolvedValue(mockSquad as any);
      jest.spyOn(prisma.orgMember, 'create').mockResolvedValue({} as any);

      const dto: CreateSquadDto = {
        name: 'AWS SAA Study Group',
        certificationId: 'cert-1',
      };

      const result = await service.createSquad(mockUser.id, dto);

      expect(prisma.organization.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: 'AWS SAA Study Group',
          kind: 'SQUAD',
          certificationId: 'cert-1',
          ownerId: mockUser.id,
        }),
        include: expect.any(Object),
      });

      expect(prisma.orgMember.create).toHaveBeenCalledWith({
        data: {
          orgId: mockSquad.id,
          userId: mockUser.id,
          role: 'OWNER',
          isActive: true,
        },
      });

      expect(result).toEqual(
        expect.objectContaining({
          id: mockSquad.id,
          name: 'AWS SAA Study Group',
          memberCount: 1,
        }),
      );
    });

    it('should generate slug from squad name', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockUser as any);
      jest
        .spyOn(prisma.certification, 'findUnique')
        .mockResolvedValue(mockCertification as any);
      jest.spyOn(prisma.organization, 'create').mockResolvedValue(mockSquad as any);
      jest.spyOn(prisma.orgMember, 'create').mockResolvedValue({} as any);

      const dto: CreateSquadDto = {
        name: 'AWS SAA-C03 Study Group!!!',
        certificationId: 'cert-1',
      };

      await service.createSquad(mockUser.id, dto);

      expect(prisma.organization.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          slug: expect.stringMatching(/^[a-z0-9-]+$/),
        }),
        include: expect.any(Object),
      });
    });
  });

  describe('createInviteLink', () => {
    it('should reject if squad does not exist', async () => {
      jest.spyOn(prisma.organization, 'findUnique').mockResolvedValue(null);

      await expect(
        service.createInviteLink('unknown-squad', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should enforce daily rate limit (max 10/day)', async () => {
      jest.spyOn(prisma.organization, 'findUnique').mockResolvedValue(mockSquad as any);
      jest.spyOn(prisma.orgInvite, 'count').mockResolvedValue(10); // Already at limit

      await expect(
        service.createInviteLink(mockSquad.id, 'user-1'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.createInviteLink(mockSquad.id, 'user-1'),
      ).rejects.toThrow(SQUADS.ERRORS.INVITE_LIMIT_EXCEEDED);
    });

    it('should generate token with 7-day TTL', async () => {
      jest.spyOn(prisma.organization, 'findUnique').mockResolvedValue(mockSquad as any);
      jest.spyOn(prisma.orgInvite, 'count').mockResolvedValue(5); // Within limit

      const mockInvite = {
        id: 'invite-1',
        token: 'token-123',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      };

      jest.spyOn(prisma.orgInvite, 'create').mockResolvedValue(mockInvite as any);

      const result = await service.createInviteLink(mockSquad.id, 'user-1');

      expect(prisma.orgInvite.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          orgId: mockSquad.id,
          status: 'PENDING',
          invitedByUserId: 'user-1',
          expiresAt: expect.any(Date),
        }),
      });

      expect(result.token).toBeDefined();
      expect(result.expiresAt).toBeInstanceOf(Date);

      // Verify TTL is approximately 7 days (within 1 second tolerance)
      const ttlMs = result.expiresAt.getTime() - Date.now();
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
      expect(Math.abs(ttlMs - sevenDaysMs)).toBeLessThan(1000);
    });

    it('should include full join URL in response', async () => {
      jest.spyOn(prisma.organization, 'findUnique').mockResolvedValue(mockSquad as any);
      jest.spyOn(prisma.orgInvite, 'count').mockResolvedValue(0);

      const mockInvite = {
        id: 'invite-1',
        token: 'abc-123-def',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      };

      jest.spyOn(prisma.orgInvite, 'create').mockResolvedValue(mockInvite as any);

      const result = await service.createInviteLink(mockSquad.id, 'user-1');

      expect(result.joinUrl).toMatch(/\/squads\/join\/abc-123-def/);
      expect(result.squadName).toBe(mockSquad.name);
    });
  });

  describe('joinSquad', () => {
    it('should reject expired tokens', async () => {
      const expiredInvite = {
        id: 'invite-1',
        token: 'token-123',
        status: 'PENDING',
        expiresAt: new Date(Date.now() - 1000), // 1 second in the past
      };

      jest.spyOn(prisma.orgInvite, 'findUnique').mockResolvedValue(expiredInvite as any);

      await expect(service.joinSquad('token-123', 'user-2')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.joinSquad('token-123', 'user-2')).rejects.toThrow(
        SQUADS.ERRORS.INVITE_EXPIRED,
      );
    });

    it('should reject non-PENDING invites', async () => {
      const acceptedInvite = {
        id: 'invite-1',
        token: 'token-123',
        status: 'ACCEPTED',
        expiresAt: new Date(Date.now() + 1000),
      };

      jest.spyOn(prisma.orgInvite, 'findUnique').mockResolvedValue(acceptedInvite as any);

      await expect(service.joinSquad('token-123', 'user-2')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should create OrgMember and mark invite as ACCEPTED', async () => {
      const validInvite = {
        id: 'invite-1',
        token: 'token-123',
        orgId: 'squad-1',
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 1000),
      };

      jest.spyOn(prisma.orgInvite, 'findUnique').mockResolvedValue(validInvite as any);
      jest.spyOn(prisma.organization, 'findUnique').mockResolvedValue(mockSquad as any);
      jest.spyOn(prisma.orgMember, 'findUnique').mockResolvedValue(null); // New member
      jest.spyOn(prisma.orgMember, 'create').mockResolvedValue({} as any);
      jest.spyOn(prisma.orgMember, 'count').mockResolvedValue(2); // Including new member
      jest.spyOn(prisma.orgInvite, 'update').mockResolvedValue({} as any);

      const result = await service.joinSquad('token-123', 'user-2');

      expect(prisma.orgMember.create).toHaveBeenCalledWith({
        data: {
          orgId: 'squad-1',
          userId: 'user-2',
          role: 'MEMBER',
          isActive: true,
        },
      });

      expect(prisma.orgInvite.update).toHaveBeenCalledWith({
        where: { id: 'invite-1' },
        data: { status: 'ACCEPTED' },
      });

      expect(result.memberCount).toBe(2);
    });

    it('should check squad capacity (maxSeats)', async () => {
      const fullSquad = { ...mockSquad, maxSeats: 2, members: [{}, {}] };

      const validInvite = {
        id: 'invite-1',
        token: 'token-123',
        orgId: 'squad-1',
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 1000),
      };

      jest.spyOn(prisma.orgInvite, 'findUnique').mockResolvedValue(validInvite as any);
      jest.spyOn(prisma.organization, 'findUnique').mockResolvedValue(fullSquad as any);

      await expect(service.joinSquad('token-123', 'user-3')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.joinSquad('token-123', 'user-3')).rejects.toThrow(
        SQUADS.ERRORS.SQUAD_AT_CAPACITY,
      );
    });

    it('should handle idempotent joins (user already member)', async () => {
      const validInvite = {
        id: 'invite-1',
        token: 'token-123',
        orgId: 'squad-1',
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 1000),
      };

      const existingMember = {
        orgId: 'squad-1',
        userId: 'user-2',
        role: 'MEMBER',
        isActive: false,
      };

      jest.spyOn(prisma.orgInvite, 'findUnique').mockResolvedValue(validInvite as any);
      jest.spyOn(prisma.organization, 'findUnique').mockResolvedValue(mockSquad as any);
      jest.spyOn(prisma.orgMember, 'findUnique').mockResolvedValue(existingMember as any);
      jest.spyOn(prisma.orgMember, 'update').mockResolvedValue({} as any);
      jest.spyOn(prisma.orgMember, 'count').mockResolvedValue(2);
      jest.spyOn(prisma.orgInvite, 'update').mockResolvedValue({} as any);

      const result = await service.joinSquad('token-123', 'user-2');

      // Should update (reactivate) instead of create
      expect(prisma.orgMember.update).toHaveBeenCalledWith({
        where: { orgId_userId: { orgId: 'squad-1', userId: 'user-2' } },
        data: { isActive: true },
      });

      expect(result.memberCount).toBe(2);
    });
  });
});
