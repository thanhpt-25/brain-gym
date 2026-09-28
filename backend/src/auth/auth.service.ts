import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { UserStatus } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { CreateUserDto } from '../users/dto/create-user.dto';
import * as bcrypt from 'bcryptjs';
import { TokenResponseDto } from './dto/token-response.dto';
import { OAuthProviderRegistry } from './oauth/oauth-provider.registry';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private prisma: PrismaService,
    private oauthRegistry: OAuthProviderRegistry,
  ) {}

  async validateUser(email: string, pass: string): Promise<any> {
    const user = await this.usersService.findByEmail(email);
    if (user && user.passwordHash && (await bcrypt.compare(pass, user.passwordHash))) {
      const { passwordHash, ...result } = user;
      return result;
    }
    return null;
  }

  async login(loginDto: LoginDto): Promise<TokenResponseDto> {
    const user = await this.validateUser(loginDto.email, loginDto.password);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.status === UserStatus.BANNED) {
      throw new ForbiddenException('Your account has been banned');
    }

    if (user.status === UserStatus.SUSPENDED) {
      if (user.suspendedUntil && new Date(user.suspendedUntil) > new Date()) {
        throw new ForbiddenException(
          'Your account is suspended until ' +
            new Date(user.suspendedUntil).toISOString(),
        );
      }
      // Suspension expired — reactivate before issuing tokens
      await this.usersService.reactivateUser(user.id);
    }

    return this.generateTokens(user);
  }

  async register(createUserDto: CreateUserDto): Promise<TokenResponseDto> {
    const existingUser = await this.usersService.findByEmail(
      createUserDto.email,
    );
    if (existingUser) {
      throw new BadRequestException('Email already in use');
    }
    const user = await this.usersService.create(createUserDto);
    return this.generateTokens(user);
  }

  async socialLogin(
    providerName: string,
    token: string,
  ): Promise<TokenResponseDto> {
    const provider = this.oauthRegistry.get(providerName);
    const info = await provider.verify(token);

    // Find existing OAuth account link
    let oauthAccount = await this.prisma.oAuthAccount.findUnique({
      where: {
        provider_providerUserId: {
          provider: providerName,
          providerUserId: info.providerUserId,
        },
      },
      include: { user: true },
    });

    let user: any;

    if (oauthAccount) {
      user = oauthAccount.user;
    } else {
      // Auto-link to existing user with same email, or create new user
      user = await this.usersService.findByEmail(info.email);
      if (!user) {
        user = await this.prisma.user.create({
          data: {
            email: info.email,
            displayName: info.displayName,
            avatarUrl: info.avatarUrl,
          },
        });
      }
      await this.prisma.oAuthAccount.create({
        data: {
          userId: user.id,
          provider: providerName,
          providerUserId: info.providerUserId,
          email: info.email,
        },
      });
    }

    if (user.status === UserStatus.BANNED) {
      throw new ForbiddenException('Your account has been banned');
    }
    if (user.status === UserStatus.SUSPENDED) {
      if (user.suspendedUntil && new Date(user.suspendedUntil) > new Date()) {
        throw new ForbiddenException(
          'Your account is suspended until ' +
            new Date(user.suspendedUntil).toISOString(),
        );
      }
      await this.usersService.reactivateUser(user.id);
      user = await this.usersService.findById(user.id);
    }

    return this.generateTokens(user);
  }

  async refresh(refreshToken: string): Promise<TokenResponseDto> {
    try {
      const payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });
      const user = await this.usersService.findById(payload.sub);
      if (!user) {
        throw new UnauthorizedException('User not found');
      }
      return this.generateTokens(user);
    } catch (e) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  private async generateTokens(user: any): Promise<TokenResponseDto> {
    const payload = { sub: user.id, email: user.email, role: user.role };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>('JWT_SECRET'),
      expiresIn: this.configService.get<string>('JWT_EXPIRES_IN', '15m') as any,
    });

    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.configService.get<string>(
        'JWT_REFRESH_EXPIRES_IN',
        '7d',
      ) as any,
    });

    const memberships = await this.prisma.orgMember.findMany({
      where: { userId: user.id, isActive: true },
      include: { organization: { select: { slug: true, name: true } } },
    });

    const orgMemberships = memberships.map((m) => ({
      orgId: m.orgId,
      slug: m.organization.slug,
      name: m.organization.name,
      role: m.role,
    }));

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        plan: user.plan,
        featureFlags: user.featureFlags,
        orgMemberships,
      },
    };
  }
}
