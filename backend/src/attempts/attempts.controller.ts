import { Controller, Get, Post, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AttemptsService } from './attempts.service';
import { SubmitAnswerDto } from './dto/submit-answer.dto';
import { SubmitAttemptDto } from './dto/submit-attempt.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedRequest } from '../common/interfaces/request.interface';

@ApiTags('attempts')
@Controller()
export class AttemptsController {
    constructor(private readonly attemptsService: AttemptsService) { }

    @Post('exams/:examId/start')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Start an exam attempt — returns questions without correct answers' })
    start(@Req() req: AuthenticatedRequest, @Param('examId') examId: string) {
        const userId = req.user.id;
        return this.attemptsService.start(userId, examId);
    }

    @Post('attempts/:id/answer')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Save/update a single answer during exam' })
    saveAnswer(@Req() req: AuthenticatedRequest, @Param('id') attemptId: string, @Body() dto: SubmitAnswerDto) {
        const userId = req.user.id;
        return this.attemptsService.saveAnswer(userId, attemptId, dto);
    }

    @Post('attempts/:id/submit')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Submit exam attempt — calculates score and returns results' })
    submit(@Req() req: AuthenticatedRequest, @Param('id') attemptId: string, @Body() dto: SubmitAttemptDto) {
        const userId = req.user.id;
        return this.attemptsService.submit(userId, attemptId, dto);
    }

    @Post('attempts/:id/finish')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Finish an attempt using already saved answers' })
    finish(@Req() req: AuthenticatedRequest, @Param('id') attemptId: string) {
        const userId = req.user.id;
        return this.attemptsService.finish(userId, attemptId);
    }

    @Get('attempts/:id')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get attempt result with question review' })
    findResult(@Param('id') attemptId: string) {
        return this.attemptsService.findResult(attemptId);
    }

    @Get('attempts/me')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'List current user exam attempts' })
    @ApiQuery({ name: 'page', required: false })
    @ApiQuery({ name: 'limit', required: false })
    findMyAttempts(
        @Req() req: AuthenticatedRequest,
        @Query('page') page?: string,
        @Query('limit') limit?: string,
    ) {
        const userId = req.user.id;
        return this.attemptsService.findMyAttempts(
            userId,
            page ? parseInt(page, 10) : 1,
            limit ? parseInt(limit, 10) : 10,
        );
    }
}
