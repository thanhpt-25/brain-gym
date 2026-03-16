import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TagsService {
    constructor(private readonly prisma: PrismaService) { }

    async findAll(certificationId?: string) {
        return this.prisma.tag.findMany({
            where: {
                certificationId: certificationId || undefined,
            },
            orderBy: {
                name: 'asc',
            },
        });
    }
}
