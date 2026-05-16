import { Test, TestingModule } from '@nestjs/testing';
import { SquadsController } from './squads.controller';
import { SquadsService } from './squads.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { User, UserPlan } from '@prisma/client';

describe('SquadsController', () => {
  let controller: SquadsController;
  let service: SquadsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SquadsController],
      providers: [
        {
          provide: SquadsService,
          useValue: {
            createSquad: jest.fn(),
            createInviteLink: jest.fn(),
            joinSquad: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<SquadsController>(SquadsController);
    service = module.get<SquadsService>(SquadsService);
  });

  describe('POST /squads', () => {
    it('should require AuthGuard (return error without user)', async () => {
      const dto = {
        name: 'Test Squad',
        certificationId: 'cert-1',
      };

      await expect(
        controller.createSquad(null, dto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create squad and return SquadDto', async () => {
      const user: User = {
        id: 'user-1',
        email: 'test@example.com',
        passwordHash: 'hash',
        displayName: 'Test User',
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

      const dto = {
        name: 'Test Squad',
        certificationId: 'cert-1',
      };

      const expectedResult = {
        id: 'squad-1',
        name: 'Test Squad',
        slug: 'test-squad-abc1',
        certificationId: 'cert-1',
        memberCount: 1,
        createdAt: new Date(),
      };

      jest.spyOn(service, 'createSquad').mockResolvedValueOnce(expectedResult);

      const result = await controller.createSquad(user, dto);

      expect(result).toEqual(expectedResult);
      expect(service.createSquad).toHaveBeenCalledWith('user-1', dto);
    });
  });

  describe('POST /squads/:id/invites', () => {
    it('should require AuthGuard (return error without user)', async () => {
      await expect(
        controller.createInviteLink('squad-1', null),
      ).rejects.toThrow(BadRequestException);
    });

    it('should return InviteLinkDto with full joinUrl', async () => {
      const user: User = {
        id: 'user-1',
        email: 'test@example.com',
        passwordHash: 'hash',
        displayName: 'Test User',
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

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);

      const expectedResult = {
        token: 'token-123',
        expiresAt: futureDate,
        squadName: 'Test Squad',
        joinUrl: 'http://localhost:8080/squads/join/token-123',
      };

      jest.spyOn(service, 'createInviteLink').mockResolvedValueOnce(expectedResult);

      const result = await controller.createInviteLink('squad-1', user);

      expect(result).toEqual(expectedResult);
      expect(service.createInviteLink).toHaveBeenCalledWith('squad-1', 'user-1');
    });
  });

  describe('POST /squads/join/:token', () => {
    it('should require AuthGuard (return error without user)', async () => {
      await expect(
        controller.joinSquad('token-123', null),
      ).rejects.toThrow(BadRequestException);
    });

    it('should add user to squad and return SquadDto', async () => {
      const user: User = {
        id: 'new-user',
        email: 'newuser@example.com',
        passwordHash: 'hash',
        displayName: 'New User',
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

      const expectedResult = {
        id: 'squad-1',
        name: 'Test Squad',
        slug: 'test-squad',
        certificationId: 'cert-1',
        memberCount: 2,
        createdAt: new Date(),
      };

      jest.spyOn(service, 'joinSquad').mockResolvedValueOnce(expectedResult);

      const result = await controller.joinSquad('token-123', user);

      expect(result).toEqual(expectedResult);
      expect(service.joinSquad).toHaveBeenCalledWith('token-123', 'new-user');
    });
  });
});
