import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { User, UserRole, UserStatus, AttemptStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const publicSelect = {
  id: true,
  email: true,
  displayName: true,
  avatarUrl: true,
  role: true,
  status: true,
  points: true,
  suspendedUntil: true,
  banReason: true,
  createdAt: true,
};

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    const salt = await bcrypt.genSalt();
    const hashedPassword = await bcrypt.hash(createUserDto.password, salt);
    return this.prisma.user.create({
      data: {
        email: createUserDto.email,
        passwordHash: hashedPassword,
        displayName: createUserDto.displayName,
      },
    });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async findAll(search?: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const where: any = {};
    if (search) {
      where.OR = [
        { displayName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, users] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        select: {
          ...publicSelect,
          _count: {
            select: {
              questions: true,
              examAttempts: { where: { status: AttemptStatus.SUBMITTED } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return { data: users, meta: { total, page, limit, lastPage: Math.ceil(total / limit) } };
  }

  async updateRole(userId: string, role: UserRole) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    return this.prisma.user.update({
      where: { id: userId },
      data: { role },
      select: publicSelect,
    });
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const data: any = {};
    if (dto.displayName !== undefined) data.displayName = dto.displayName;
    if (dto.avatarUrl !== undefined) data.avatarUrl = dto.avatarUrl;

    return this.prisma.user.update({
      where: { id: userId },
      data,
      select: publicSelect,
    });
  }

  async getPublicProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        ...publicSelect,
        _count: {
          select: {
            questions: true,
            examAttempts: { where: { status: AttemptStatus.SUBMITTED } },
          },
        },
        badgeAwards: {
          include: { badge: true },
          orderBy: { awardedAt: 'desc' },
        },
      },
    });

    if (!user) throw new NotFoundException('User not found');

    return {
      ...user,
      badges: user.badgeAwards.map(a => ({
        id: a.badge.id,
        name: a.badge.name,
        description: a.badge.description,
        awardedAt: a.awardedAt,
      })),
      badgeAwards: undefined,
    };
  }

  async suspendUser(userId: string, reason: string, suspendedUntil?: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.role === UserRole.ADMIN) {
      throw new ForbiddenException('Cannot suspend an admin user');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        status: UserStatus.SUSPENDED,
        banReason: reason,
        suspendedUntil: suspendedUntil ? new Date(suspendedUntil) : null,
      },
      select: publicSelect,
    });
  }

  async banUser(userId: string, reason: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.role === UserRole.ADMIN) {
      throw new ForbiddenException('Cannot ban an admin user');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        status: UserStatus.BANNED,
        banReason: reason,
        suspendedUntil: null,
      },
      select: publicSelect,
    });
  }

  async reactivateUser(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        status: UserStatus.ACTIVE,
        banReason: null,
        suspendedUntil: null,
      },
      select: publicSelect,
    });
  }

  async adjustPoints(userId: string, amount: number) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    return this.prisma.user.update({
      where: { id: userId },
      data: { points: { increment: amount } },
      select: publicSelect,
    });
  }
}
