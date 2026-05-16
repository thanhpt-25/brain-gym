import { Test, TestingModule } from '@nestjs/testing';
import { SquadsService } from './squads.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { OrgRole, OrgKind, UserPlan, User, Organization, OrgInviteStatus } from '@prisma/client';

describe('SquadsService', () => {
  let service: SquadsService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SquadsService,
        {
          provide: PrismaService,
          useValue: {
            user: { findUnique: jest.fn() },
            certification: { findUnique: jest.fn() },
            organization: {
              create: jest.fn(),
              findUnique: jest.fn(),
            },
            orgMember: {
              create: jest.fn(),
              findUnique: jest.fn(),
              count: jest.fn(),
            },
            orgInvite: {
              create: jest.fn(),
              findUnique: jest.fn(),
              count: jest.fn(),
              update: jest.fn(),
            },
            $transaction: jest.fn((callback) => callback({
              organization: { create: jest.fn() },
              orgMember: { create: jest.fn(), findUnique: jest.fn(), count: jest.fn() },
              orgInvite: { update: jest.fn() },
            })),
          },
        },
      ],
    }).compile();

    service = module.get<SquadsService>(SquadsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('createSquad', () => {
    it('should reject FREE users', async () => {
      const freeUser: User = {
        id: 'user-1',
        email: 'free@example.com',
        passwordHash: 'hash',
        displayName: 'Free User',
        avatarUrl: null,
        role: 'LEARNER',
        status: 'ACTIVE',
        plan: UserPlan.FREE,
        points: 0,
        suspendedUntil: null,
        banReason: null,
        featureFlags: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      jest.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce(freeUser);

      await expect(
        service.createSquad('user-1', {
          name: 'Test Squad',
          certificationId: 'cert-1',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should validate certification exists', async () => {
      const premiumUser: User = {
        id: 'user-1',
        email: 'premium@example.com',
        passwordHash: 'hash',
        displayName: 'Premium User',
        avatarUrl: null,
        role: 'LEARNER',
        status: 'ACTIVE',
        plan: UserPlan.PREMIUM,
        points: 0,
        suspendedUntil: null,
        banReason: null,
        featureFlags: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      jest.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce(premiumUser);
      jest.spyOn(prisma.certification, 'findUnique').mockResolvedValueOnce(null);

      await expect(
        service.createSquad('user-1', {
          name: 'Test Squad',
          certificationId: 'nonexistent-cert',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should create squad with kind=SQUAD', async () => {
      const premiumUser: User = {
        id: 'user-1',
        email: 'premium@example.com',
        passwordHash: 'hash',
        displayName: 'Premium User',
        avatarUrl: null,
        role: 'LEARNER',
        status: 'ACTIVE',
        plan: UserPlan.PREMIUM,
        points: 0,
        suspendedUntil: null,
        banReason: null,
        featureFlags: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const certification = {
        id: 'cert-1',
        name: 'AWS SAA',
        providerId: 'provider-1',
        code: 'aws-saa',
        description: null,
        examFormat: null,
        isActive: true,
        createdAt: new Date(),
      };

      const mockOrg: Organization = {
        id: 'squad-1',
        kind: OrgKind.SQUAD,
        name: 'Test Squad',
        slug: 'test-squad-abc1',
        logoUrl: null,
        description: null,
        industry: null,
        accentColor: null,
        maxSeats: 10,
        isActive: true,
        llmDailyUsdCap: null,
        certificationId: 'cert-1',
        targetExamDate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      jest.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce(premiumUser);
      jest.spyOn(prisma.certification, 'findUnique').mockResolvedValueOnce(certification);

      const mockTx = {
        organization: { create: jest.fn().mockResolvedValueOnce(mockOrg) },
        orgMember: { create: jest.fn().mockResolvedValueOnce({}) },
      };

      jest.spyOn(prisma, '$transaction').mockImplementationOnce(async (callback) => {
        return callback(mockTx);
      });

      const result = await service.createSquad('user-1', {
        name: 'Test Squad',
        certificationId: 'cert-1',
      });

      expect(result).toMatchObject({
        id: 'squad-1',
        name: 'Test Squad',
        slug: 'test-squad-abc1',
        memberCount: 1,
      });
    });
  });

  describe('createInviteLink', () => {
    it('should enforce daily rate limit (max 10/day)', async () => {
      const mockSquad: Organization = {
        id: 'squad-1',
        kind: OrgKind.SQUAD,
        name: 'Test Squad',
        slug: 'test-squad',
        logoUrl: null,
        description: null,
        industry: null,
        accentColor: null,
        maxSeats: 10,
        isActive: true,
        llmDailyUsdCap: null,
        certificationId: 'cert-1',
        targetExamDate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      jest.spyOn(prisma.organization, 'findUnique').mockResolvedValueOnce({
        ...mockSquad,
        _count: { members: 5 },
      });

      jest.spyOn(prisma.orgMember, 'findUnique').mockResolvedValueOnce({
        id: 'member-1',
        orgId: 'squad-1',
        userId: 'user-1',
        role: OrgRole.OWNER,
        groupId: null,
        joinedAt: new Date(),
        isActive: true,
      });

      jest.spyOn(prisma.orgInvite, 'count').mockResolvedValueOnce(10); // 10 invites already created today

      await expect(
        service.createInviteLink('squad-1', 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should generate token with 7-day TTL', async () => {
      const mockSquad: Organization = {
        id: 'squad-1',
        kind: OrgKind.SQUAD,
        name: 'Test Squad',
        slug: 'test-squad',
        logoUrl: null,
        description: null,
        industry: null,
        accentColor: null,
        maxSeats: 10,
        isActive: true,
        llmDailyUsdCap: null,
        certificationId: 'cert-1',
        targetExamDate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      jest.spyOn(prisma.organization, 'findUnique').mockResolvedValueOnce({
        ...mockSquad,
        _count: { members: 5 },
      });

      jest.spyOn(prisma.orgMember, 'findUnique').mockResolvedValueOnce({
        id: 'member-1',
        orgId: 'squad-1',
        userId: 'user-1',
        role: OrgRole.OWNER,
        groupId: null,
        joinedAt: new Date(),
        isActive: true,
      });

      jest.spyOn(prisma.orgInvite, 'count').mockResolvedValueOnce(5); // 5 invites today (under limit)

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);

      jest.spyOn(prisma.orgInvite, 'create').mockResolvedValueOnce({
        id: 'invite-1',
        orgId: 'squad-1',
        email: 'squad_token_abc@squad.internal',
        role: OrgRole.MEMBER,
        token: 'abc-123-token',
        status: OrgInviteStatus.PENDING,
        invitedBy: 'user-1',
        expiresAt: futureDate,
        createdAt: new Date(),
      });

      const result = await service.createInviteLink('squad-1', 'user-1');

      expect(result.token).toBe('abc-123-token');
      expect(result.squadName).toBe('Test Squad');
      expect(result.expiresAt.getTime()).toBeGreaterThan(new Date().getTime());
    });
  });

  describe('joinSquad', () => {
    it('should reject expired tokens', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      jest.spyOn(prisma.orgInvite, 'findUnique').mockResolvedValueOnce({
        id: 'invite-1',
        orgId: 'squad-1',
        email: 'squad_token@squad.internal',
        role: OrgRole.MEMBER,
        token: 'expired-token',
        status: OrgInviteStatus.PENDING,
        invitedBy: 'user-1',
        expiresAt: pastDate,
        createdAt: new Date(),
        organization: {
          id: 'squad-1',
          kind: OrgKind.SQUAD,
          name: 'Test Squad',
          slug: 'test-squad',
          logoUrl: null,
          description: null,
          industry: null,
          accentColor: null,
          maxSeats: 10,
          isActive: true,
          llmDailyUsdCap: null,
          certificationId: 'cert-1',
          targetExamDate: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      await expect(
        service.joinSquad('expired-token', 'new-user'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should add user to squad and mark invite as ACCEPTED', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);

      const mockSquad: Organization = {
        id: 'squad-1',
        kind: OrgKind.SQUAD,
        name: 'Test Squad',
        slug: 'test-squad',
        logoUrl: null,
        description: null,
        industry: null,
        accentColor: null,
        maxSeats: 10,
        isActive: true,
        llmDailyUsdCap: null,
        certificationId: 'cert-1',
        targetExamDate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      jest.spyOn(prisma.orgInvite, 'findUnique').mockResolvedValueOnce({
        id: 'invite-1',
        orgId: 'squad-1',
        email: 'squad_token@squad.internal',
        role: OrgRole.MEMBER,
        token: 'valid-token',
        status: OrgInviteStatus.PENDING,
        invitedBy: 'user-1',
        expiresAt: futureDate,
        createdAt: new Date(),
        organization: mockSquad,
      });

      const mockTx = {
        orgMember: {
          findUnique: jest.fn().mockResolvedValueOnce(null),
          create: jest.fn().mockResolvedValueOnce({}),
          count: jest.fn().mockResolvedValueOnce(2),
        },
        orgInvite: {
          update: jest.fn().mockResolvedValueOnce({}),
        },
      };

      jest.spyOn(prisma, '$transaction').mockImplementationOnce(async (callback) => {
        return callback(mockTx);
      });

      const result = await service.joinSquad('valid-token', 'new-user');

      expect(result).toMatchObject({
        id: 'squad-1',
        name: 'Test Squad',
        memberCount: 2,
      });
    });
  });
});
