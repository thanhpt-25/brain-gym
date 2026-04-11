import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Query,
  Req,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { QuestionsService } from './questions.service';
import { CreateQuestionDto } from './dto/create-question.dto';
import { UpdateQuestionStatusDto } from './dto/update-question-status.dto';
import { AdminUpdateQuestionDto } from './dto/admin-update-question.dto';
import { RolesGuard } from '../auth/guards/roles.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import { AuditService } from '../audit/audit.service';
import { UserRole } from '@prisma/client';
import { PaginationDto } from '../common/dto/pagination.dto';

@ApiTags('questions')
@Controller('questions')
export class QuestionsController {
  constructor(
    private readonly questionsService: QuestionsService,
    private readonly auditService: AuditService,
  ) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Get paginated questions' })
  @ApiQuery({ name: 'certificationId', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'isTrapQuestion', required: false, type: Boolean })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  findAll(
    @Req() req: any,
    @Query('certificationId') certificationId?: string,
    @Query('status') status?: string,
    @Query('isTrapQuestion') isTrapQuestion?: string,
    @Query() pagination?: PaginationDto,
  ) {
    const userId = req.user?.sub || req.user?.id;
    const trapFilter =
      isTrapQuestion !== undefined ? isTrapQuestion === 'true' : undefined;
    return this.questionsService.findAll(
      certificationId,
      status,
      pagination?.page,
      pagination?.limit,
      userId,
      trapFilter,
    );
  }

  @Get('queue/pending')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.REVIEWER, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get pending questions for review' })
  findPending(@Query() pagination?: PaginationDto) {
    return this.questionsService.findPending(
      pagination?.page,
      pagination?.limit,
    );
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
  @ApiQuery({
    name: 'value',
    required: true,
    type: Number,
    description: '1 for upvote, -1 for downvote, 0 to clear',
  })
  vote(
    @Req() req: any,
    @Param('id') questionId: string,
    @Query('value') value: string,
  ) {
    const userId = req.user.sub || req.user.id;
    const voteValue = parseInt(value, 10);
    return this.questionsService.vote(userId, questionId, voteValue);
  }

  @Put(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CONTRIBUTOR, UserRole.REVIEWER, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Update question status (DRAFT→PENDING by contributor, APPROVE/REJECT by reviewer/admin)',
  })
  updateStatus(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateQuestionStatusDto,
  ) {
    const userId = req.user.sub || req.user.id;
    const userRole = req.user.role;
    return this.questionsService.updateStatus(userId, userRole, id, dto.status);
  }

  @Get('admin/all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: List all questions with filters' })
  @ApiQuery({ name: 'certificationId', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'includeDeleted', required: false, type: Boolean })
  findAllAdmin(
    @Query('certificationId') certificationId?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('includeDeleted') includeDeleted?: string,
  ) {
    return this.questionsService.findAllAdmin({
      certificationId,
      status,
      search,
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
      includeDeleted: includeDeleted === 'true',
    });
  }

  @Put(':id/admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Full edit of a question' })
  async adminUpdate(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: AdminUpdateQuestionDto,
  ) {
    const result = await this.questionsService.adminUpdate(id, dto);
    await this.auditService.log({
      userId: req.user.sub || req.user.id,
      action: 'QUESTION_EDITED',
      targetType: 'Question',
      targetId: id,
      metadata: { fields: Object.keys(dto) },
    });
    return result;
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Soft-delete a question' })
  async adminDelete(@Req() req: any, @Param('id') id: string) {
    const result = await this.questionsService.adminDelete(id);
    await this.auditService.log({
      userId: req.user.sub || req.user.id,
      action: 'QUESTION_DELETED',
      targetType: 'Question',
      targetId: id,
    });
    return result;
  }
}
