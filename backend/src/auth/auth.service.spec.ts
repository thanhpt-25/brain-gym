import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { UserStatus } from '@prisma/client';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { OAuthProviderRegistry } from './oauth/oauth-provider.registry';

const MOCK_TOKENS = { accessToken: 'acc', refreshToken: 'ref' };

const mockUser = {
  id: 'user-1',
  email: 'test@example.com',
  displayName: 'Test User',
  role: 'LEARNER',
  plan: 'FREE',
  featureFlags: {},
  status: UserStatus.ACTIVE,
  suspendedUntil: null,
  passwordHash: 'hash',
};

describe('AuthService', () => {
  let service: AuthService;
  let usersService: jest.Mocked<UsersService>;
  let prisma: any;
  let oauthRegistry: any;

  const mockOAuthProvider = {
    name: 'google',
    verify: jest.fn(),
  };

  beforeEach(async () => {
    prisma = {
      orgMember: { findMany: jest.fn().mockResolvedValue([]) },
      oAuthAccount: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      user: { create: jest.fn() },
    };

    oauthRegistry = {
      get: jest.fn().mockReturnValue(mockOAuthProvider),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: {
            findByEmail: jest.fn(),
            findById: jest.fn(),
            create: jest.fn(),
            reactivateUser: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: { signAsync: jest.fn().mockResolvedValue('token') },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('secret') },
        },
        { provide: PrismaService, useValue: prisma },
        { provide: OAuthProviderRegistry, useValue: oauthRegistry },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersService = module.get(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('socialLogin', () => {
    const oauthInfo = {
      providerUserId: 'google-sub-123',
      email: 'test@example.com',
      displayName: 'Test User',
      avatarUrl: 'https://example.com/avatar.png',
    };

    beforeEach(() => {
      mockOAuthProvider.verify.mockResolvedValue(oauthInfo);
    });

    it('throws NotFoundException for unsupported provider', async () => {
      oauthRegistry.get.mockImplementation(() => {
        throw new NotFoundException('OAuth provider "facebook" is not supported');
      });
      await expect(service.socialLogin('facebook', 'token')).rejects.toThrow(NotFoundException);
    });

    it('returns tokens for existing linked account', async () => {
      prisma.oAuthAccount.findUnique.mockResolvedValue({
        user: mockUser,
      });

      const result = await service.socialLogin('google', 'token');

      expect(prisma.oAuthAccount.create).not.toHaveBeenCalled();
      expect(result).toHaveProperty('accessToken');
    });

    it('auto-links to existing user with same email', async () => {
      prisma.oAuthAccount.findUnique.mockResolvedValue(null);
      (usersService.findByEmail as jest.Mock).mockResolvedValue(mockUser);

      await service.socialLogin('google', 'token');

      expect(prisma.user.create).not.toHaveBeenCalled();
      expect(prisma.oAuthAccount.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: mockUser.id,
          provider: 'google',
          providerUserId: 'google-sub-123',
        }),
      });
    });

    it('creates new user when email does not exist', async () => {
      prisma.oAuthAccount.findUnique.mockResolvedValue(null);
      (usersService.findByEmail as jest.Mock).mockResolvedValue(null);
      const newUser = { ...mockUser, id: 'user-new' };
      prisma.user.create.mockResolvedValue(newUser);

      await service.socialLogin('google', 'token');

      expect(prisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: oauthInfo.email,
          displayName: oauthInfo.displayName,
        }),
      });
      expect(prisma.oAuthAccount.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ userId: newUser.id }),
      });
    });

    it('throws ForbiddenException for BANNED user', async () => {
      prisma.oAuthAccount.findUnique.mockResolvedValue({
        user: { ...mockUser, status: UserStatus.BANNED },
      });

      await expect(service.socialLogin('google', 'token')).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException for SUSPENDED user within suspension period', async () => {
      const futureDate = new Date(Date.now() + 86400000); // tomorrow
      prisma.oAuthAccount.findUnique.mockResolvedValue({
        user: { ...mockUser, status: UserStatus.SUSPENDED, suspendedUntil: futureDate },
      });

      await expect(service.socialLogin('google', 'token')).rejects.toThrow(ForbiddenException);
    });

    it('reactivates SUSPENDED user whose suspension has expired', async () => {
      const pastDate = new Date(Date.now() - 86400000); // yesterday
      prisma.oAuthAccount.findUnique.mockResolvedValue({
        user: { ...mockUser, status: UserStatus.SUSPENDED, suspendedUntil: pastDate },
      });
      (usersService.reactivateUser as jest.Mock).mockResolvedValue(undefined);
      (usersService.findById as jest.Mock).mockResolvedValue(mockUser);

      const result = await service.socialLogin('google', 'token');

      expect(usersService.reactivateUser).toHaveBeenCalledWith(mockUser.id);
      expect(result).toHaveProperty('accessToken');
    });
  });
});
