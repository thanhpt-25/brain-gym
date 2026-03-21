import { Test, TestingModule } from '@nestjs/testing';
import { FlashcardsController } from './flashcards.controller';
import { FlashcardsService } from './flashcards.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

describe('FlashcardsController', () => {
  let controller: FlashcardsController;
  let service: FlashcardsService;

  const mockFlashcardsService = {
    createDeck: jest.fn(),
    getDecks: jest.fn(),
    getDeck: jest.fn(),
    updateDeck: jest.fn(),
    deleteDeck: jest.fn(),
    createFlashcard: jest.fn(),
    submitReview: jest.fn(),
    getDueReviews: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FlashcardsController],
      providers: [
        { provide: FlashcardsService, useValue: mockFlashcardsService },
      ],
    })
    .overrideGuard(JwtAuthGuard)
    .useValue({ canActivate: () => true })
    .compile();

    controller = module.get<FlashcardsController>(FlashcardsController);
    service = module.get<FlashcardsService>(FlashcardsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('Decks', () => {
    it('should create a deck', async () => {
      const dto = { name: 'Test Deck' };
      const req = { user: { id: 'user-1' } };
      mockFlashcardsService.createDeck.mockResolvedValue({ id: 'deck-1', ...dto });

      const result = await controller.createDeck(req, dto);
      expect(result).toEqual({ id: 'deck-1', ...dto });
      expect(mockFlashcardsService.createDeck).toHaveBeenCalledWith('user-1', dto);
    });

    it('should list user decks', async () => {
      const req = { user: { id: 'user-1' } };
      mockFlashcardsService.getDecks.mockResolvedValue([]);

      const result = await controller.getDecks(req);
      expect(result).toEqual([]);
      expect(mockFlashcardsService.getDecks).toHaveBeenCalledWith('user-1');
    });
  });

  describe('Flashcards', () => {
    it('should create a flashcard', async () => {
      const dto = { deckId: 'deck-1', front: 'Q', back: 'A' };
      const req = { user: { id: 'user-1' } };
      mockFlashcardsService.createFlashcard.mockResolvedValue({ id: 'card-1', ...dto });

      const result = await controller.createFlashcard(req, dto);
      expect(result).toEqual({ id: 'card-1', ...dto });
      expect(mockFlashcardsService.createFlashcard).toHaveBeenCalledWith('user-1', dto);
    });

    it('should submit an SRS review', async () => {
      const req = { user: { id: 'user-1' } };
      const flashcardId = 'card-1';
      const quality = 5;
      mockFlashcardsService.submitReview.mockResolvedValue({ status: 'updated' });

      const result = await controller.submitReview(req, flashcardId, quality);
      expect(result).toEqual({ status: 'updated' });
      expect(mockFlashcardsService.submitReview).toHaveBeenCalledWith('user-1', flashcardId, quality);
    });

    it('should get due flashcard reviews', async () => {
      const req = { user: { id: 'user-1' } };
      mockFlashcardsService.getDueReviews.mockResolvedValue([]);

      const result = await controller.getDueReviews(req, 'deck-1');
      expect(result).toEqual([]);
      expect(mockFlashcardsService.getDueReviews).toHaveBeenCalledWith('user-1', 'deck-1');
    });
  });
});
