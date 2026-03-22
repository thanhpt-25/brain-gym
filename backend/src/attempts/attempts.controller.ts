import { Controller, Get, Post, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { PaginationDto } from '../common/dto/pagination.dto';
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
    @Throttle({ default: { limit: 5, ttl: 60000 } })
    @ApiOperation({ summary: 'Start an exam attempt — returns questions without correct answers' })
    start(@Req() req: AuthenticatedRequest, @Param('examId') examId: string) {
        const userId = req.user.id;
        return this.attemptsService.start(userId, examId);
    }

    @Post('attempts/:id/answer')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @SkipThrottle()
    @ApiOperation({ summary: 'Save/update a single answer during exam' })
    saveAnswer(@Req() req: AuthenticatedRequest, @Param('id') attemptId: string, @Body() dto: SubmitAnswerDto) {
        const userId = req.user.id;
        return this.attemptsService.saveAnswer(userId, attemptId, dto);
    }

    @Post('attempts/:id/submit')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @SkipThrottle()
    @ApiOperation({ summary: 'Submit exam attempt — calculates score and returns results' })
    submit(@Req() req: AuthenticatedRequest, @Param('id') attemptId: string, @Body() dto: SubmitAttemptDto) {
        const userId = req.user.id;
        return this.attemptsService.submit(userId, attemptId, dto);
    }

    @Post('attempts/:id/finish')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @SkipThrottle()
    @ApiOperation({ summary: 'Finish an attempt using already saved answers' })
    finish(@Req() req: AuthenticatedRequest, @Param('id') attemptId: string) {
        const userId = req.user.id;
        return this.attemptsService.finish(userId, attemptId);
    }

    @Get('attempts/:id')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @SkipThrottle()
    @ApiOperation({ summary: 'Get attempt result with question review' })
    findResult(@Param('id') attemptId: string) {
        return this.attemptsService.findResult(attemptId);
    }

    @Get('attempts/me')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @SkipThrottle()
    @ApiOperation({ summary: 'List current user exam attempts' })
    findMyAttempts(
        @Req() req: AuthenticatedRequest,
        @Query() pagination?: PaginationDto,
    ) {
        const userId = req.user.id;
        return this.attemptsService.findMyAttempts(
            userId,
            pagination?.page,
            pagination?.limit,
        );
    }
}
