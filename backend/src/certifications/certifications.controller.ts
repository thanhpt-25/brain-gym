import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { CertificationsService } from './certifications.service';
import { CreateCertificationDto } from './dto/create-certification.dto';
import { UpdateCertificationDto } from './dto/update-certification.dto';
import { RolesGuard } from '../auth/guards/roles.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('certifications')
@Controller('certifications')
export class CertificationsController {
    constructor(private readonly certificationsService: CertificationsService) { }

    @Get()
    @Public()
    @ApiOperation({ summary: 'Get all active certifications' })
    @ApiQuery({ name: 'includeInactive', required: false, type: Boolean })
    findAll(@Query('includeInactive') includeInactive?: string) {
        return this.certificationsService.findAll(includeInactive === 'true');
    }

    @Get(':id')
    @Public()
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

    @Put(':id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Update a certification (Admin only)' })
    update(@Param('id') id: string, @Body() updateCertificationDto: UpdateCertificationDto) {
        return this.certificationsService.update(id, updateCertificationDto);
    }

    @Delete(':id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Soft-delete a certification (Admin only)' })
    remove(@Param('id') id: string) {
        return this.certificationsService.softDelete(id);
    }
}
