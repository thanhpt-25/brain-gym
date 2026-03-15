import { Controller, Get, Post, Put, Delete, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ExamsService } from './exams.service';
import { CreateExamDto } from './dto/create-exam.dto';
import { UpdateExamDto } from './dto/update-exam.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('exams')
@Controller('exams')
export class ExamsController {
    constructor(private readonly examsService: ExamsService) { }

    @Post()
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Create a new exam' })
    create(@Req() req: any, @Body() dto: CreateExamDto) {
        const userId = req.user.sub || req.user.id;
        return this.examsService.create(userId, dto);
    }

    @Get()
    @Public()
    @ApiOperation({ summary: 'List public exams' })
    @ApiQuery({ name: 'certificationId', required: false })
    @ApiQuery({ name: 'page', required: false })
    @ApiQuery({ name: 'limit', required: false })
    @ApiQuery({ name: 'sort', required: false, enum: ['latest', 'popular'] })
    findAll(
        @Query('certificationId') certificationId?: string,
        @Query('page') page?: string,
        @Query('limit') limit?: string,
        @Query('sort') sort?: 'latest' | 'popular',
    ) {
        return this.examsService.findAll(
            certificationId,
            page ? parseInt(page, 10) : 1,
            limit ? parseInt(limit, 10) : 10,
            sort ?? 'latest',
        );
    }

    @Get('me')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'List my exams' })
    findMyExams(@Req() req: any, @Query('page') page?: string, @Query('limit') limit?: string) {
        const userId = req.user.sub || req.user.id;
        return this.examsService.findMyExams(userId, page ? parseInt(page, 10) : 1, limit ? parseInt(limit, 10) : 10);
    }

    @Get('share/:shareCode')
    @Public()
    @ApiOperation({ summary: 'Get exam by share code' })
    findByShareCode(@Param('shareCode') shareCode: string) {
        return this.examsService.findByShareCode(shareCode);
    }

    @Get(':id')
    @Public()
    @ApiOperation({ summary: 'Get exam by ID' })
    findOne(@Param('id') id: string) {
        return this.examsService.findOne(id);
    }

    @Put(':id')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Update an exam (owner only)' })
    update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateExamDto) {
        const userId = req.user.sub || req.user.id;
        return this.examsService.update(userId, id, dto);
    }

    @Delete(':id')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Delete an exam (owner or admin)' })
    remove(@Req() req: any, @Param('id') id: string) {
        const userId = req.user.sub || req.user.id;
        const userRole = req.user.role;
        return this.examsService.remove(userId, userRole, id);
    }
}
