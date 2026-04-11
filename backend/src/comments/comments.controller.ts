import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('comments')
@Controller()
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Get('questions/:questionId/comments')
  @Public()
  @ApiOperation({ summary: 'Get threaded comments for a question' })
  findByQuestion(@Param('questionId') questionId: string) {
    return this.commentsService.findByQuestion(questionId);
  }

  @Post('questions/:questionId/comments')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add a comment (supports replies via parentId)' })
  create(
    @Req() req: any,
    @Param('questionId') questionId: string,
    @Body() dto: CreateCommentDto,
  ) {
    const userId = req.user.sub || req.user.id;
    return this.commentsService.create(userId, questionId, dto);
  }

  @Put('comments/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Edit own comment' })
  update(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateCommentDto,
  ) {
    const userId = req.user.sub || req.user.id;
    return this.commentsService.update(userId, id, dto);
  }

  @Delete('comments/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete own comment (or admin)' })
  remove(@Req() req: any, @Param('id') id: string) {
    const userId = req.user.sub || req.user.id;
    const userRole = req.user.role;
    return this.commentsService.remove(userId, userRole, id);
  }
}
