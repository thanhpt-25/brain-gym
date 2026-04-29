import { PrismaClient } from '@prisma/client';

/**
 * Truncate all tables in FK-safe order (children before parents).
 * Uses CASCADE to handle any remaining FK references within the set.
 *
 * Call this in beforeEach to guarantee full isolation between tests.
 */
export async function cleanDb(prisma: PrismaClient): Promise<void> {
  // Deepest children first, root tables last.
  // Order derived from schema.prisma FK relationships.
  const tables = [
    // Leaf / deep children
    'candidate_answers',
    'candidate_invites',
    'assessment_questions',
    'assessments',
    'exam_catalog_questions',
    'org_exam_assignments',
    'exam_catalog_items',
    'learning_tracks',
    'org_question_choices',
    'org_questions',
    'org_join_links',
    'org_invites',
    'org_groups',
    'org_members',
    'organizations',

    // Answer / attempt layer
    'answers',
    'exam_attempts',
    'exam_questions',
    'exams',

    // Review / flashcard layer
    'flashcard_review_schedules',
    'flashcards',
    'decks',
    'review_schedules',

    // Interaction layer
    'captured_words',
    'audit_logs',
    'badge_awards',
    'badges',
    'reports',
    'votes',
    'comments',
    'question_tags',
    'tags',
    'choices',

    // AI generation layer
    'questions',
    'source_chunks',
    'source_materials',
    'question_generation_jobs',
    'domains',

    // Config layer
    'user_llm_configs',

    // Top-level entities
    'certifications',
    'providers',
    'users',
  ];

  for (const table of tables) {
    await prisma.$executeRawUnsafe(
      `TRUNCATE TABLE "${table}" RESTART IDENTITY CASCADE`,
    );
  }
}
