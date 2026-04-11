import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProviderDto } from './dto/create-provider.dto';
import { UpdateProviderDto } from './dto/update-provider.dto';

@Injectable()
export class ProvidersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(includeInactive = false) {
    return this.prisma.provider.findMany({
      where: includeInactive ? {} : { isActive: true },
      include: {
        _count: { select: { certifications: true } },
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async findOne(id: string) {
    const provider = await this.prisma.provider.findUnique({
      where: { id },
      include: {
        certifications: {
          where: { isActive: true },
          select: { id: true, name: true, code: true },
        },
        _count: { select: { certifications: true } },
      },
    });

    if (!provider) {
      throw new NotFoundException(`Provider with ID ${id} not found`);
    }

    return provider;
  }

  async create(dto: CreateProviderDto) {
    const existingName = await this.prisma.provider.findUnique({
      where: { name: dto.name },
    });
    if (existingName) {
      throw new ConflictException(
        `Provider name "${dto.name}" is already in use`,
      );
    }

    const existingSlug = await this.prisma.provider.findUnique({
      where: { slug: dto.slug },
    });
    if (existingSlug) {
      throw new ConflictException(
        `Provider slug "${dto.slug}" is already in use`,
      );
    }

    return this.prisma.provider.create({
      data: dto,
      include: {
        _count: { select: { certifications: true } },
      },
    });
  }

  async update(id: string, dto: UpdateProviderDto) {
    const provider = await this.findOne(id);

    if (dto.name && dto.name !== provider.name) {
      const existing = await this.prisma.provider.findUnique({
        where: { name: dto.name },
      });
      if (existing) {
        throw new ConflictException(
          `Provider name "${dto.name}" is already in use`,
        );
      }
    }

    if (dto.slug && dto.slug !== provider.slug) {
      const existing = await this.prisma.provider.findUnique({
        where: { slug: dto.slug },
      });
      if (existing) {
        throw new ConflictException(
          `Provider slug "${dto.slug}" is already in use`,
        );
      }
    }

    return this.prisma.provider.update({
      where: { id },
      data: dto,
      include: {
        _count: { select: { certifications: true } },
      },
    });
  }

  async softDelete(id: string) {
    await this.findOne(id);

    const activeCerts = await this.prisma.certification.count({
      where: { providerId: id, isActive: true },
    });

    if (activeCerts > 0) {
      throw new ConflictException(
        `Cannot deactivate provider with ${activeCerts} active certification(s). Deactivate or reassign them first.`,
      );
    }

    return this.prisma.provider.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
