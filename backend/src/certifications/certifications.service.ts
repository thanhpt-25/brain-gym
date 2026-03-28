import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCertificationDto } from './dto/create-certification.dto';
import { UpdateCertificationDto } from './dto/update-certification.dto';

@Injectable()
export class CertificationsService {
    constructor(private readonly prisma: PrismaService) { }

    async findAll(includeInactive = false) {
        const certs = await this.prisma.certification.findMany({
            where: includeInactive ? {} : { isActive: true },
            include: {
                domains: true,
                _count: {
                    select: { questions: true }
                }
            },
            orderBy: {
                createdAt: 'desc',
            },
        });

        // Map _count.questions to questionCount for frontend consistency
        return certs.map(cert => ({
            ...cert,
            questionCount: cert._count?.questions || 0,
        }));
    }

    async findOne(id: string) {
        const cert = await this.prisma.certification.findUnique({
            where: { id },
            include: {
                domains: true,
            },
        });

        if (!cert) {
            throw new NotFoundException(`Certification with ID ${id} not found`);
        }

        return cert;
    }

    async create(dto: CreateCertificationDto) {
        // Check for existing code (even inactive ones)
        const existing = await this.prisma.certification.findUnique({
            where: { code: dto.code }
        });

        if (existing) {
            throw new ConflictException(`Certification code ${dto.code} is already in use (archived or active)`);
        }

        const { domains, ...certData } = dto;

        return this.prisma.certification.create({
            data: {
                ...certData,
                domains: domains && domains.length > 0 ? {
                    create: domains.map(name => ({ name })),
                } : undefined,
            },
            include: {
                domains: true,
            },
        });
    }

    async update(id: string, dto: UpdateCertificationDto) {
        const cert = await this.findOne(id);

        if (dto.code && dto.code !== cert.code) {
            const existing = await this.prisma.certification.findUnique({
                where: { code: dto.code }
            });

            if (existing) {
                throw new ConflictException(`Certification code ${dto.code} is already in use`);
            }
        }

        const { domains, ...certData } = dto;

        // Simplify domain management: delete all existing and recreate if domains list provided
        if (domains) {
            await this.prisma.domain.deleteMany({
                where: { certificationId: id }
            });
        }

        return this.prisma.certification.update({
            where: { id },
            data: {
                ...certData,
                domains: domains && domains.length > 0 ? {
                    create: domains.map(name => ({ name })),
                } : undefined,
            },
            include: {
                domains: true,
            },
        });
    }

    async softDelete(id: string) {
        await this.findOne(id); // Ensure exists

        return this.prisma.certification.update({
            where: { id },
            data: { isActive: false },
        });
    }
}
