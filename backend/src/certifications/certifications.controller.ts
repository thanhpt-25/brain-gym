import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CertificationsService } from './certifications.service';
import { CreateCertificationDto } from './dto/create-certification.dto';
import { RolesGuard } from '../common/guards/roles.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('certifications')
@Controller('certifications')
export class CertificationsController {
    constructor(private readonly certificationsService: CertificationsService) { }

    @Get()
    @ApiOperation({ summary: 'Get all certifications' })
    findAll() {
        return this.certificationsService.findAll();
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get a certification by ID' })
    findOne(@Param('id') id: string) {
        return this.certificationsService.findOne(id);
    }

    @Post()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Create a new certification (Admin only)' })
    create(@Body() createCertificationDto: CreateCertificationDto) {
        return this.certificationsService.create(createCertificationDto);
    }
}
