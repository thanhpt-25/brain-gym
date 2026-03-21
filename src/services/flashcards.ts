import api from './api';
import {
  Deck,
  Flashcard,
  FlashcardReviewSchedule,
  CapturedWord,
} from '@/types/api-types';

export type { Deck, Flashcard, FlashcardReviewSchedule, CapturedWord };

// ==================== DECKS ====================

export const getDecks = async (): Promise<Deck[]> => {
  const response = await api.get<Deck[]>('/decks');
  return response.data;
};

export const getDeck = async (id: string): Promise<Deck> => {
  const response = await api.get<Deck>(`/decks/${id}`);
  return response.data;
};

export const createDeck = async (data: { name: string; description?: string; certificationId?: string }): Promise<Deck> => {
  const response = await api.post<Deck>('/decks', data);
  return response.data;
};

export const updateDeck = async (id: string, data: Partial<Deck>): Promise<Deck> => {
  const response = await api.put<Deck>(`/decks/${id}`, data);
  return response.data;
};

export const deleteDeck = async (id: string): Promise<void> => {
  await api.delete(`/decks/${id}`);
};

// ==================== FLASHCARDS ====================

export const createFlashcard = async (data: { deckId: string; front: string; back: string; hint?: string; tags?: string[] }): Promise<Flashcard> => {
  const response = await api.post<Flashcard>('/flashcards', data);
  return response.data;
};

export const updateFlashcard = async (id: string, data: Partial<Flashcard>): Promise<Flashcard> => {
  const response = await api.put<Flashcard>(`/flashcards/${id}`, data);
  return response.data;
};

export const deleteFlashcard = async (id: string): Promise<void> => {
  await api.delete(`/flashcards/${id}`);
};

export const toggleStarFlashcard = async (id: string): Promise<Flashcard> => {
  const response = await api.post<Flashcard>(`/flashcards/${id}/star`);
  return response.data;
};

// ==================== SRS ====================

export const submitFlashcardReview = async (id: string, quality: number): Promise<FlashcardReviewSchedule> => {
  const response = await api.post<FlashcardReviewSchedule>(`/flashcards/${id}/review`, { quality });
  return response.data;
};

export const getDueFlashcardReviews = async (deckId?: string): Promise<{ flashcard: Flashcard; nextReviewDate: string }[]> => {
  const params = new URLSearchParams();
  if (deckId) params.append('deckId', deckId);
  const response = await api.get<{ flashcard: Flashcard; nextReviewDate: string }[]>(`/flashcards/srs/due?${params}`);
  return response.data;
};

export const getFlashcardStats = async (): Promise<{
  totalFlashcards: number;
  dueToday: number;
  masteryBreakdown: Record<string, number>;
}> => {
  const response = await api.get('/flashcards/srs/stats');
  return response.data;
};


// ==================== WORD CAPTURE ====================

export const captureWord = async (data: { word: string; context?: string; examAttemptId?: string; questionId?: string }): Promise<CapturedWord> => {
  const response = await api.post<CapturedWord>('/capture', data);
  return response.data;
};

export const getPendingCaptures = async (): Promise<CapturedWord[]> => {
  const response = await api.get<CapturedWord[]>('/capture');
  return response.data;
};

export const updateCaptureStatus = async (id: string, status: 'processed' | 'discarded'): Promise<CapturedWord> => {
  const response = await api.put<CapturedWord>(`/capture/${id}/status`, { status });
  return response.data;
};

export const deleteCapture = async (id: string): Promise<void> => {
  await api.delete(`/capture/${id}`);
};

