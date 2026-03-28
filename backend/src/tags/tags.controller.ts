import { Controller, Get, Post, Put, Delete, Query, Param, Body, UseGuards } from '@nestjs/common';
import { TagsService } from './tags.service';
import { ApiTags, ApiOperation, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('tags')
@Controller('tags')
export class TagsController {
    constructor(private readonly tagsService: TagsService) { }

    @Public()
    @Get()
    @ApiOperation({ summary: 'Get all tags, optionally filtered by certification' })
    @ApiQuery({ name: 'certificationId', required: false })
    findAll(@Query('certificationId') certificationId?: string) {
        return this.tagsService.findAll(certificationId);
    }

    @Post()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Create a tag (admin)' })
    create(@Body() body: { name: string; certificationId?: string }) {
        return this.tagsService.create(body.name, body.certificationId);
    }

    @Put(':id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Update a tag (admin)' })
    update(@Param('id') id: string, @Body() body: { name: string }) {
        return this.tagsService.update(id, body.name);
    }

    @Delete(':id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Delete a tag (admin)' })
    remove(@Param('id') id: string) {
        return this.tagsService.remove(id);
    }

    @Post('merge')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Merge tags into one (admin)' })
    merge(@Body() body: { sourceIds: string[]; targetId: string }) {
        return this.tagsService.merge(body.sourceIds, body.targetId);
    }
}
