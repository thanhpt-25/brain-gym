import { Test, TestingModule } from '@nestjs/testing';
import { SquadsController } from './squads.controller';
import { SquadsService } from './squads.service';
import { CreateSquadDto } from './dto/create-squad.dto';
import { BadRequestException } from '@nestjs/common';

describe('SquadsController', () => {
  let controller: SquadsController;
  let service: SquadsService;

  const mockUser = {
    id: 'user-1',
    email: 'user@example.com',
  };

  const mockSquadDto = {
    id: 'squad-1',
    name: 'AWS SAA Study Group',
    slug: 'aws-saa-study-group',
    certificationId: 'cert-1',
    targetExamDate: undefined,
    memberCount: 1,
    createdAt: new Date(),
  };

  const mockInviteLinkDto = {
    token: 'abc-123-def',
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    squadName: 'AWS SAA Study Group',
    joinUrl: 'https://brain-gym.com/squads/join/abc-123-def',
  };

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
    it('should create squad and return SquadDto', async () => {
      const dto: CreateSquadDto = {
        name: 'AWS SAA Study Group',
        certificationId: 'cert-1',
      };

      jest.spyOn(service, 'createSquad').mockResolvedValue(mockSquadDto);

      const result = await controller.createSquad(mockUser as any, dto);

      expect(service.createSquad).toHaveBeenCalledWith(mockUser.id, dto);
      expect(result).toEqual(mockSquadDto);
    });

    it('should reject if FREE user', async () => {
      const dto: CreateSquadDto = {
        name: 'AWS SAA Study Group',
        certificationId: 'cert-1',
      };

      jest
        .spyOn(service, 'createSquad')
        .mockRejectedValue(
          new BadRequestException('Free users cannot create squads'),
        );

      await expect(controller.createSquad(mockUser as any, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject if certification not found', async () => {
      const dto: CreateSquadDto = {
        name: 'Test Squad',
        certificationId: 'unknown-cert',
      };

      jest
        .spyOn(service, 'createSquad')
        .mockRejectedValue(new BadRequestException('Certification not found'));

      await expect(controller.createSquad(mockUser as any, dto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('POST /squads/:id/invites', () => {
    it('should create invite link and return InviteLinkDto', async () => {
      jest.spyOn(service, 'createInviteLink').mockResolvedValue(mockInviteLinkDto);

      const result = await controller.createInviteLink('squad-1', mockUser as any);

      expect(service.createInviteLink).toHaveBeenCalledWith('squad-1', mockUser.id);
      expect(result).toEqual(mockInviteLinkDto);
    });

    it('should reject if daily invite limit exceeded', async () => {
      jest
        .spyOn(service, 'createInviteLink')
        .mockRejectedValue(
          new BadRequestException('Daily invite limit reached (max 10 per day)'),
        );

      await expect(
        controller.createInviteLink('squad-1', mockUser as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject if squad not found', async () => {
      jest
        .spyOn(service, 'createInviteLink')
        .mockRejectedValue(new BadRequestException('Squad not found'));

      await expect(
        controller.createInviteLink('unknown-squad', mockUser as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('POST /squads/join/:token', () => {
    it('should accept invite and return SquadDto', async () => {
      jest.spyOn(service, 'joinSquad').mockResolvedValue(mockSquadDto);

      const result = await controller.joinSquad('abc-123-def', mockUser as any);

      expect(service.joinSquad).toHaveBeenCalledWith('abc-123-def', mockUser.id);
      expect(result).toEqual(mockSquadDto);
    });

    it('should reject if token expired', async () => {
      jest
        .spyOn(service, 'joinSquad')
        .mockRejectedValue(new BadRequestException('Invite link has expired'));

      await expect(controller.joinSquad('expired-token', mockUser as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject if squad at capacity', async () => {
      jest
        .spyOn(service, 'joinSquad')
        .mockRejectedValue(new BadRequestException('Squad is at full capacity'));

      await expect(controller.joinSquad('abc-123-def', mockUser as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should handle already-joined users (idempotent)', async () => {
      jest.spyOn(service, 'joinSquad').mockResolvedValue(mockSquadDto);

      const result = await controller.joinSquad('abc-123-def', mockUser as any);

      // Should succeed without error
      expect(result).toEqual(mockSquadDto);
    });
  });
});
