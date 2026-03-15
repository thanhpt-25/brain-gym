import { Controller, Get, Post, Put, Body, Param, UseGuards, Query, Req, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { QuestionsService } from './questions.service';
import { CreateQuestionDto } from './dto/create-question.dto';
import { UpdateQuestionStatusDto } from './dto/update-question-status.dto';
import { RolesGuard } from '../auth/guards/roles.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('questions')
@Controller('questions')
export class QuestionsController {
    constructor(private readonly questionsService: QuestionsService) { }

    @Get()
    @Public()
    @ApiOperation({ summary: 'Get paginated questions' })
    @ApiQuery({ name: 'certificationId', required: false, type: String })
    @ApiQuery({ name: 'status', required: false, type: String })
    @ApiQuery({ name: 'page', required: false, type: Number })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    findAll(
        @Query('certificationId') certificationId?: string,
        @Query('status') status?: string,
        @Query('page') page?: string,
        @Query('limit') limit?: string,
    ) {
        const pageNumber = page ? parseInt(page, 10) : 1;
        const limitNumber = limit ? parseInt(limit, 10) : 10;
        return this.questionsService.findAll(certificationId, status, pageNumber, limitNumber);
    }

    @Get('queue/pending')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.REVIEWER, UserRole.ADMIN)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get pending questions for review' })
    @ApiQuery({ name: 'page', required: false, type: Number })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    findPending(@Query('page') page?: string, @Query('limit') limit?: string) {
        return this.questionsService.findPending(page ? +page : 1, limit ? +limit : 20);
    }

    @Get(':id')
    @Public()
    @ApiOperation({ summary: 'Get a single question by ID' })
    findOne(@Param('id') id: string, @Req() req: any) {
        const userId = req.user?.sub || req.user?.id;
        return this.questionsService.findOne(id, userId);
    }

    @Post()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.CONTRIBUTOR, UserRole.REVIEWER, UserRole.ADMIN)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Create a new question (draft status by default)' })
    create(@Req() req: any, @Body() createQuestionDto: CreateQuestionDto) {
        const userId = req.user.sub || req.user.id;
        return this.questionsService.create(userId, createQuestionDto);
    }

    @Post(':id/vote')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Vote on a question (value: 1, -1, or 0 to clear)' })
    @ApiQuery({ name: 'value', required: true, type: Number, description: '1 for upvote, -1 for downvote, 0 to clear' })
    vote(@Req() req: any, @Param('id') questionId: string, @Query('value') value: string) {
        const userId = req.user.sub || req.user.id;
        const voteValue = parseInt(value, 10);
        return this.questionsService.vote(userId, questionId, voteValue);
    }

    @Put(':id/status')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.CONTRIBUTOR, UserRole.REVIEWER, UserRole.ADMIN)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Update question status (DRAFT→PENDING by contributor, APPROVE/REJECT by reviewer/admin)' })
    updateStatus(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateQuestionStatusDto) {
        const userId = req.user.sub || req.user.id;
        const userRole = req.user.role;
        return this.questionsService.updateStatus(userId, userRole, id, dto.status);
    }
}
