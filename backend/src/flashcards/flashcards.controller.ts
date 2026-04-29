import {
  Controller,
  Get,
  Post,
  Body,
  Put,
  Param,
  Delete,
  UseGuards,
  Req,
  Query,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { FlashcardsService } from './flashcards.service';
import { CreateDeckDto } from './dto/create-deck.dto';
import { UpdateDeckDto } from './dto/update-deck.dto';
import { CreateFlashcardDto } from './dto/create-flashcard.dto';
import { UpdateFlashcardDto } from './dto/update-flashcard.dto';
import { SubmitReviewDto } from './dto/submit-review.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedRequest } from '../common/interfaces/request.interface';

@ApiTags('flashcards')
@Controller()
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class FlashcardsController {
  constructor(private readonly flashcardsService: FlashcardsService) {}

  // ==================== DECKS ====================

  @Post('decks')
  @ApiOperation({ summary: 'Create a new deck' })
  createDeck(@Req() req: AuthenticatedRequest, @Body() dto: CreateDeckDto) {
    const userId = req.user.id;
    return this.flashcardsService.createDeck(userId, dto);
  }

  @Get('decks')
  @ApiOperation({ summary: 'Get all decks for user' })
  getDecks(@Req() req: AuthenticatedRequest) {
    const userId = req.user.id;
    return this.flashcardsService.getDecks(userId);
  }

  @Get('decks/:id')
  @ApiOperation({ summary: 'Get deck details by id' })
  getDeck(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    const userId = req.user.id;
    return this.flashcardsService.getDeck(userId, id);
  }

  @Put('decks/:id')
  @ApiOperation({ summary: 'Update a deck' })
  updateDeck(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateDeckDto,
  ) {
    const userId = req.user.id;
    return this.flashcardsService.updateDeck(userId, id, dto);
  }

  @Delete('decks/:id')
  @ApiOperation({ summary: 'Delete a deck' })
  deleteDeck(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    const userId = req.user.id;
    return this.flashcardsService.deleteDeck(userId, id);
  }

  // ==================== FLASHCARDS ====================

  @Post('flashcards')
  @ApiOperation({ summary: 'Create a flashcard' })
  createFlashcard(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateFlashcardDto,
  ) {
    const userId = req.user.id;
    return this.flashcardsService.createFlashcard(userId, dto);
  }

  @Get('flashcards/:id')
  @ApiOperation({ summary: 'Get a flashcard' })
  getFlashcard(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    const userId = req.user.id;
    return this.flashcardsService.getFlashcard(userId, id);
  }

  @Put('flashcards/:id')
  @ApiOperation({ summary: 'Update a flashcard' })
  updateFlashcard(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateFlashcardDto,
  ) {
    const userId = req.user.id;
    return this.flashcardsService.updateFlashcard(userId, id, dto);
  }

  @Delete('flashcards/:id')
  @ApiOperation({ summary: 'Delete a flashcard' })
  deleteFlashcard(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    const userId = req.user.id;
    return this.flashcardsService.deleteFlashcard(userId, id);
  }

  @Post('flashcards/:id/star')
  @ApiOperation({ summary: 'Toggle star on flashcard' })
  toggleStar(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    const userId = req.user.id;
    return this.flashcardsService.toggleStar(userId, id);
  }

  // ==================== SRS ====================

  @Post('flashcards/:id/review')
  @ApiOperation({ summary: 'Submit SRS review for a custom flashcard' })
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  submitReview(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: SubmitReviewDto,
  ) {
    const userId = req.user.id;
    return this.flashcardsService.submitReview(userId, id, dto);
  }

  @Get('flashcards/srs/due')
  @ApiOperation({ summary: 'Get due custom flashcards for review' })
  @ApiQuery({ name: 'deckId', required: false })
  getDueReviews(
    @Req() req: AuthenticatedRequest,
    @Query('deckId') deckId?: string,
  ) {
    const userId = req.user.id;
    return this.flashcardsService.getDueReviews(userId, deckId);
  }

  @Get('flashcards/srs/stats')
  @ApiOperation({ summary: 'Get aggregate SRS stats for flashcards' })
  getStats(@Req() req: AuthenticatedRequest) {
    const userId = req.user.id;
    return this.flashcardsService.getFlashcardStats(userId);
  }
}
