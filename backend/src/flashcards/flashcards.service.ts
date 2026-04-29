import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateDeckDto } from './dto/create-deck.dto';
import { UpdateDeckDto } from './dto/update-deck.dto';
import { CreateFlashcardDto } from './dto/create-flashcard.dto';
import { UpdateFlashcardDto } from './dto/update-flashcard.dto';
import { SubmitReviewDto } from './dto/submit-review.dto';
import { calculateSM2 } from './sm2';

// TODO: Replace with Redis SETNX once ioredis / @nestjs/cache-manager is wired in.
// Key: `flashcard:review:idempotency:<userId>:<flashcardId>:<idempotencyKey>`
// TTL: 300 seconds (5 minutes)
const idempotencyStore = new Map<
  string,
  { expiresAt: number; scheduleId: string }
>();

function idempotencyKey(
  userId: string,
  flashcardId: string,
  key: string,
): string {
  return `flashcard:review:idempotency:${userId}:${flashcardId}:${key}`;
}

function checkAndSetIdempotency(
  userId: string,
  flashcardId: string,
  key: string,
  scheduleId: string,
): boolean {
  const storeKey = idempotencyKey(userId, flashcardId, key);
  const now = Date.now();
  const existing = idempotencyStore.get(storeKey);
  if (existing && existing.expiresAt > now) {
    return false; // already processed
  }
  idempotencyStore.set(storeKey, { expiresAt: now + 300_000, scheduleId });
  return true; // newly processed
}

function getIdempotencyEntry(
  userId: string,
  flashcardId: string,
  key: string,
): { scheduleId: string } | undefined {
  const storeKey = idempotencyKey(userId, flashcardId, key);
  const now = Date.now();
  const existing = idempotencyStore.get(storeKey);
  if (existing && existing.expiresAt > now) return existing;
  return undefined;
}

@Injectable()
export class FlashcardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

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
    const deck = await this.prisma.deck.findUnique({
      where: { id: dto.deckId },
    });
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
    if (card.deck.userId !== userId)
      throw new ForbiddenException('Access denied');

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

  async submitReview(
    userId: string,
    flashcardId: string,
    dto: SubmitReviewDto,
  ) {
    await this.getFlashcard(userId, flashcardId); // validates ownership / 403

    // Idempotency check
    if (dto.idempotencyKey) {
      const existing = getIdempotencyEntry(
        userId,
        flashcardId,
        dto.idempotencyKey,
      );
      if (existing) {
        // Return cached schedule from DB
        const cached = await this.prisma.flashcardReviewSchedule.findUnique({
          where: { id: existing.scheduleId },
        });
        if (cached) return cached;
        // If somehow deleted, fall through to re-process
      }
    }

    const schedule = await this.prisma.flashcardReviewSchedule.findUnique({
      where: { userId_flashcardId: { userId, flashcardId } },
    });

    const prevInterval = schedule?.interval ?? 0;
    const prevReps = schedule?.repetitions ?? 0;
    const prevEF = Number(schedule?.easeFactor ?? 2.5);
    const prevLapses = 0; // schema does not yet have lapses column; defaulting to 0

    const sm2 = calculateSM2({
      quality: dto.quality,
      prevInterval,
      prevRepetitions: prevReps,
      prevEaseFactor: prevEF,
      prevLapses,
    });

    const nextReviewDate = new Date();
    nextReviewDate.setDate(nextReviewDate.getDate() + sm2.intervalDays);

    const updated = await this.prisma.flashcardReviewSchedule.upsert({
      where: { userId_flashcardId: { userId, flashcardId } },
      update: {
        interval: sm2.intervalDays,
        repetitions: sm2.repetitions,
        easeFactor: sm2.easeFactor,
        nextReviewDate,
        mastery: sm2.mastery,
      },
      create: {
        userId,
        flashcardId,
        interval: sm2.intervalDays,
        repetitions: sm2.repetitions,
        easeFactor: sm2.easeFactor,
        nextReviewDate,
        mastery: sm2.mastery,
      },
    });

    // Store idempotency entry after successful write
    if (dto.idempotencyKey) {
      checkAndSetIdempotency(
        userId,
        flashcardId,
        dto.idempotencyKey,
        updated.id,
      );
    }

    // Audit log — fire-and-forget; failures should not surface to the caller
    this.audit
      .log({
        userId,
        action: 'FLASHCARD_REVIEW_SUBMITTED',
        targetType: 'FlashcardReviewSchedule',
        targetId: updated.id,
        metadata: {
          flashcardId,
          quality: dto.quality,
          intervalDays: sm2.intervalDays,
          repetitions: sm2.repetitions,
          mastery: sm2.mastery,
        },
      })
      .catch(() => {
        // intentionally swallowed — audit failure must not break review flow
      });

    return updated;
  }

  async getDueReviews(
    userId: string,
    deckId?: string,
    limit = 20,
    cursor?: string,
  ) {
    const today = new Date();

    // 1. Get scheduled due cards (cursor-based pagination)
    const scheduledWhere: Record<string, unknown> = {
      userId,
      nextReviewDate: { lte: today },
    };

    if (deckId) {
      scheduledWhere.flashcard = { deckId };
    }

    const scheduledReviews = await this.prisma.flashcardReviewSchedule.findMany(
      {
        where: scheduledWhere,
        include: {
          flashcard: {
            include: { deck: true },
          },
        },
        take: limit,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        orderBy: { nextReviewDate: 'asc' },
      },
    );

    // 2. Get NEW cards (cards that have NO schedule at all)
    const newCardsWhere: Record<string, unknown> = {
      deck: { userId },
      schedule: null,
    };

    if (deckId) {
      newCardsWhere.deckId = deckId;
    }

    const newCards = await this.prisma.flashcard.findMany({
      where: newCardsWhere,
      include: { deck: true },
      take: Math.max(0, limit - scheduledReviews.length),
    });

    // 3. Format new cards to match the expected return type
    const newReviews = newCards.map((flashcard) => ({
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
      masteryBreakdown: masteryBreakdown.reduce(
        (acc, curr) => {
          acc[curr.mastery] = curr._count;
          return acc;
        },
        {} as Record<string, number>,
      ),
    };
  }
}
