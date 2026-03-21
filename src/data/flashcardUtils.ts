import { Question } from '@/types/exam';

export interface Flashcard {
  id: string;
  front: string;
  back: string;
  tags: string[];
  certificationId: string;
  difficulty: string;
}

/** Convert MCQ questions into flashcards */
export function questionsToFlashcards(questions: Question[]): Flashcard[] {
  return questions.map(q => {
    const correct = q.choices.find(c => c.isCorrect);
    return {
      id: q.id,
      front: q.title,
      back: `✅ ${correct?.content ?? 'N/A'}\n\n${q.explanation ?? ''}`,
      tags: q.tags ?? [],
      certificationId: q.certificationId ?? '',
      difficulty: q.difficulty,
    };
  });
}
