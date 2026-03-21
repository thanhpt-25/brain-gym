import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDeckDto } from './dto/create-deck.dto';
import { UpdateDeckDto } from './dto/update-deck.dto';
import { CreateFlashcardDto } from './dto/create-flashcard.dto';
import { UpdateFlashcardDto } from './dto/update-flashcard.dto';

@Injectable()
export class FlashcardsService {
  constructor(private readonly prisma: PrismaService) {}

  // ==================== DECKS ====================

  async createDeck(userId: string, dto: CreateDeckDto) {
    return this.prisma.deck.create({
      data: {
        ...dto,
        userId,
      },
      include: {
        _count: { select: { flashcards: true } },
      },
    });
  }

  async getDecks(userId: string) {
    return this.prisma.deck.findMany({
      where: { userId },
      include: {
        _count: { select: { flashcards: true } },
        certification: { select: { name: true, code: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getDeck(userId: string, id: string) {
    const deck = await this.prisma.deck.findUnique({
      where: { id },
      include: {
        flashcards: {
          include: { schedule: true },
          orderBy: { createdAt: 'desc' },
        },
        certification: { select: { name: true, code: true } },
      },
    });

    if (!deck) throw new NotFoundException('Deck not found');
    if (deck.userId !== userId) throw new ForbiddenException('Access denied');

    return deck;
  }

  async updateDeck(userId: string, id: string, dto: UpdateDeckDto) {
    await this.getDeck(userId, id); // validates ownership
    return this.prisma.deck.update({
      where: { id },
      data: dto,
    });
  }

  async deleteDeck(userId: string, id: string) {
    await this.getDeck(userId, id); // validates ownership
    return this.prisma.deck.delete({
      where: { id },
    });
  }

  // ==================== FLASHCARDS ====================

  async createFlashcard(userId: string, dto: CreateFlashcardDto) {
    const deck = await this.prisma.deck.findUnique({ where: { id: dto.deckId } });
    if (!deck) throw new NotFoundException('Deck not found');
    if (deck.userId !== userId) throw new ForbiddenException('Access denied');

    return this.prisma.flashcard.create({
      data: dto,
    });
  }

  async getFlashcard(userId: string, id: string) {
    const card = await this.prisma.flashcard.findUnique({
      where: { id },
      include: { deck: true, schedule: true },
    });

    if (!card) throw new NotFoundException('Flashcard not found');
    if (card.deck.userId !== userId) throw new ForbiddenException('Access denied');

    return card;
  }

  async updateFlashcard(userId: string, id: string, dto: UpdateFlashcardDto) {
    await this.getFlashcard(userId, id); // validates ownership
    return this.prisma.flashcard.update({
      where: { id },
      data: dto,
    });
  }

  async deleteFlashcard(userId: string, id: string) {
    await this.getFlashcard(userId, id); // validates ownership
    return this.prisma.flashcard.delete({
      where: { id },
    });
  }

  async toggleStar(userId: string, id: string) {
    const card = await this.getFlashcard(userId, id);
    return this.prisma.flashcard.update({
      where: { id },
      data: { isStarred: !card.isStarred },
    });
  }

  // ==================== SRS ====================

  private calculateSM2(
    quality: number,
    prevInterval: number,
    prevReps: number,
    prevEF: number,
  ) {
    let interval: number;
    let repetitions: number;
    let easeFactor: number;

    if (quality >= 3) {
      if (prevReps === 0) {
        interval = 1;
      } else if (prevReps === 1) {
        interval = 6;
      } else {
        interval = Math.round(prevInterval * prevEF);
      }
      repetitions = prevReps + 1;
      easeFactor = prevEF + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    } else {
      repetitions = 0;
      interval = 1;
      easeFactor = prevEF;
    }

    if (easeFactor < 1.3) {
      easeFactor = 1.3;
    }

    return { interval, repetitions, easeFactor };
  }

  async submitReview(userId: string, flashcardId: string, quality: number) {
    await this.getFlashcard(userId, flashcardId); // validates ownership

    const schedule = await this.prisma.flashcardReviewSchedule.findUnique({
      where: { userId_flashcardId: { userId, flashcardId } },
    });

    const prevInterval = schedule?.interval ?? 0;
    const prevReps = schedule?.repetitions ?? 0;
    const prevEF = Number(schedule?.easeFactor ?? 2.5);

    const { interval, repetitions, easeFactor } = this.calculateSM2(
      quality,
      prevInterval,
      prevReps,
      prevEF,
    );

    const nextReviewDate = new Date();
    nextReviewDate.setDate(nextReviewDate.getDate() + interval);
    
    // Determine mastery level
    let mastery: 'NEW' | 'LEARNING' | 'REVIEW' | 'MASTERED' = 'NEW';
    if (repetitions === 0) mastery = 'NEW';
    else if (repetitions < 3) mastery = 'LEARNING';
    else if (repetitions < 6) mastery = 'REVIEW';
    else mastery = 'MASTERED';

    return this.prisma.flashcardReviewSchedule.upsert({
      where: { userId_flashcardId: { userId, flashcardId } },
      update: {
        interval,
        repetitions,
        easeFactor,
        nextReviewDate,
        mastery,
      },
      create: {
        userId,
        flashcardId,
        interval,
        repetitions,
        easeFactor,
        nextReviewDate,
        mastery,
      },
    });
  }

  async getDueReviews(userId: string, deckId?: string) {
    const today = new Date();
    
    // 1. Get scheduled due cards
    const scheduledWhere: any = {
      userId,
      nextReviewDate: { lte: today },
    };

    if (deckId) {
      scheduledWhere.flashcard = { deckId };
    }

    const scheduledReviews = await this.prisma.flashcardReviewSchedule.findMany({
      where: scheduledWhere,
      include: {
        flashcard: {
          include: { deck: true },
        },
      },
      orderBy: { nextReviewDate: 'asc' },
      take: 20, // max 20 due cards per session to avoid overwhelming
    });

    // 2. Get NEW cards (cards that have NO schedule at all)
    const newCardsWhere: any = {
      deck: { userId },
      schedule: null,
    };
    
    if (deckId) {
      newCardsWhere.deckId = deckId;
    }

    const newCards = await this.prisma.flashcard.findMany({
      where: newCardsWhere,
      include: { deck: true },
      take: Math.max(0, 20 - scheduledReviews.length), // fill the rest of the session with new cards
    });

    // 3. Format new cards to match the expected return type
    const newReviews = newCards.map(flashcard => ({
      id: `new-${flashcard.id}`,
      userId,
      flashcardId: flashcard.id,
      interval: 0,
      repetitions: 0,
      easeFactor: 2.5,
      nextReviewDate: today,
      mastery: 'NEW' as const,
      createdAt: new Date(),
      updatedAt: new Date(),
      flashcard,
    }));

    return [...scheduledReviews, ...newReviews];
  }

  async getFlashcardStats(userId: string) {
    const [totalFlashcards, dueToday, masteryBreakdown] = await Promise.all([
      this.prisma.flashcard.count({
        where: { deck: { userId } },
      }),
      this.prisma.flashcardReviewSchedule.count({
        where: { userId, nextReviewDate: { lte: new Date() } },
      }),
      this.prisma.flashcardReviewSchedule.groupBy({
        by: ['mastery'],
        where: { userId },
        _count: true,
      }),
    ]);

    return {
      totalFlashcards,
      dueToday,
      masteryBreakdown: masteryBreakdown.reduce((acc, curr) => {
        acc[curr.mastery] = curr._count;
        return acc;
      }, {} as Record<string, number>),
    };
  }
}

