import { PrismaClient } from '@prisma/client';

/**
 * Truncate all tables safely by disabling FK constraints first.
 * This avoids deadlocks and FK constraint violations that can occur
 * when truncating tables with complex relationships.
 *
 * Call this in beforeEach to guarantee full isolation between tests.
 */
export async function cleanDb(prisma: PrismaClient): Promise<void> {
  try {
    // Disable foreign key checks for the entire session
    await prisma.$executeRawUnsafe('SET session_replication_role = replica');

    // Truncate all tables in arbitrary order (FK constraints are disabled)
    const tables = [
      // Scenario engine layer
      'scenario_attempts',
      'scenario_questions',
      'coach_sessions',
      'behavioral_insights',
      'pass_likelihood_surveys',
      'readiness_scores',
      'llm_usage_events',
      'moderation_audits',
      'attempt_events',
      'scenarios',

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

    // Truncate all tables (order doesn't matter with FK disabled)
    for (const table of tables) {
      try {
        await prisma.$executeRawUnsafe(
          `TRUNCATE TABLE "${table}" RESTART IDENTITY`,
        );
      } catch (error) {
        // Table might not exist, skip it
        if (!(error instanceof Error && error.message.includes('does not exist'))) {
          throw error;
        }
      }
    }
  } finally {
    // Re-enable foreign key checks
    await prisma.$executeRawUnsafe('SET session_replication_role = default');
  }
}
