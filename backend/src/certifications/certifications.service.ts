import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCertificationDto } from './dto/create-certification.dto';

@Injectable()
export class CertificationsService {
    constructor(private readonly prisma: PrismaService) { }

    async findAll() {
        return this.prisma.certification.findMany({
            include: {
                domains: true,
            },
            orderBy: {
                createdAt: 'desc',
            },
        });
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
}
