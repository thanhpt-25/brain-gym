# Implementation Plan: Advanced Analytics & Training

## Overview

Implement the readiness scoring engine, mistake pattern analytics, and cognitive training module (weakness training + SM-2 spaced repetition) as NestJS services backed by Prisma/PostgreSQL. Each task builds incrementally, starting with schema changes, then core pure functions, then service/controller layers, and finally wiring everything together.

## Tasks

- [ ] 1. Prisma schema migration
  - [ ] 1.1 Add MistakeType enum, mistakeType field on Answer, ReviewSchedule model, and relation fields on User and Question
    - Add `MistakeType` enum with values CONCEPT, CARELESS, TRAP, TIME_PRESSURE
    - Add optional `mistakeType MistakeType? @map("mistake_type")` field to the Answer model
    - Add `ReviewSchedule` model with id, userId, questionId, nextReviewDate, interval, easeFactor (Decimal 4,2 default 2.50), repetitions (default 0), createdAt, updatedAt, @@unique([userId, questionId]), @@map("review_schedules"), cascade deletes on user and question
    - Add `reviewSchedules ReviewSchedule[]` relation field to User and Question models
    - Run `npx prisma migrate dev --name add-analytics-training` to generate and apply migration
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 6.1, 6.2, 6.3_

- [ ] 2. Install fast-check dependency
  - Run `npm install --save-dev fast-check` in the backend directory
  - _Requirements: Testing strategy from design_

- [ ] 3. Implement readiness scoring engine in AnalyticsService
  - [ ] 3.1 Add `computeReadiness` pure function and `getReadiness(userId, certificationId)` method to AnalyticsService
    - Implement exponential time-decay weighting: weight = e^(-0.05 * daysSinceAttempt)
    - Compute recency-weighted average score using the weights
    - Compute per-domain confidence scores: round(correct / total * 100)
    - Compute composite readiness score: 0.6 * weightedAvgScore + 0.2 * minDomainConfidence + 0.2 * examCountFactor where examCountFactor = min(examsTaken / 5, 1) * 100
    - Return 0 and empty domains for zero attempts
    - Round all scores to integers, clamp to [0, 100]
    - Validate certification exists, throw NotFoundException if not
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.3_

  - [ ]* 3.2 Write property tests for readiness scoring (P1–P4)
    - **Property 1: Readiness and domain scores are bounded 0–100**
    - **Validates: Requirements 1.4, 1.5**
    - **Property 2: Time-decay weighting favors recent attempts**
    - **Validates: Requirements 1.1**
    - **Property 3: Domain confidence equals aggregated correct/total ratio**
    - **Validates: Requirements 1.2**
    - **Property 4: Lower minimum domain confidence reduces readiness score**
    - **Validates: Requirements 1.6**
    - Create `backend/src/analytics/__tests__/readiness.service.spec.ts`
    - Use fast-check arbitraries for attempt arrays with random scores and dates

  - [ ]* 3.3 Write unit tests for readiness edge cases
    - Zero attempts → readiness score 0, empty domain list
    - Non-existent certification → 404
    - _Requirements: 1.3, 2.3_

- [ ] 4. Add readiness endpoint to AnalyticsController
  - [ ] 4.1 Add `GET /analytics/readiness/:certificationId` endpoint to AnalyticsController
    - Add route handler with JwtAuthGuard, extract userId from request
    - Call `analyticsService.getReadiness(userId, certificationId)`
    - Return response shape: `{ readinessScore, domainConfidences[], totalExams, weightedAvgScore }`
    - _Requirements: 2.1, 2.2_

  - [ ]* 4.2 Write property test for readiness response shape (P5)
    - **Property 5: Readiness response contains all required fields**
    - **Validates: Requirements 2.2**

- [ ] 5. Checkpoint - Ensure readiness scoring tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Implement mistake type tracking in AnalyticsService
  - [ ] 6.1 Create UpdateMistakeTypeDto and add `updateMistakeType(userId, answerId, dto)` method to AnalyticsService
    - Create `backend/src/analytics/dto/update-mistake-type.dto.ts` with @IsEnum(MistakeType) validation
    - Fetch answer with attempt relation, verify attempt belongs to user (403 if not)
    - Verify answer isCorrect is false (400 if correct)
    - Throw NotFoundException if answer not found
    - Update answer's mistakeType field and return updated record
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [ ] 6.2 Add `PATCH /answers/:answerId/mistake-type` endpoint to AnalyticsController
    - Add route handler with JwtAuthGuard, extract userId from request
    - Call `analyticsService.updateMistakeType(userId, answerId, dto)`
    - _Requirements: 3.2_

  - [ ]* 6.3 Write property tests for mistake type tracking (P6–P8)
    - **Property 6: Mistake type update round trip**
    - **Validates: Requirements 3.3**
    - **Property 7: Mistake type tagging rejected for correct answers**
    - **Validates: Requirements 3.6**
    - **Property 8: Mistake type tagging rejected for other users' answers**
    - **Validates: Requirements 3.4**
    - Create `backend/src/analytics/__tests__/mistake-patterns.service.spec.ts`

  - [ ]* 6.4 Write unit tests for mistake type edge cases
    - Non-existent answer → 404
    - _Requirements: 3.5_

- [ ] 7. Implement mistake pattern analytics
  - [ ] 7.1 Add `getMistakePatterns(userId, certificationId?)` method to AnalyticsService
    - Query Answer records where mistakeType is not null, filtered by user's attempts
    - Optionally filter by certificationId through exam → attempt chain
    - Aggregate counts per MistakeType
    - Return `{ total, breakdown: { CONCEPT, CARELESS, TRAP, TIME_PRESSURE } }`
    - Return zero counts when no tagged mistakes exist
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [ ] 7.2 Add `GET /analytics/mistake-patterns` endpoint to AnalyticsController
    - Add route handler with JwtAuthGuard, extract userId from request
    - Accept optional `certificationId` query parameter
    - Call `analyticsService.getMistakePatterns(userId, certificationId)`
    - _Requirements: 4.1_

  - [ ]* 7.3 Write property tests for mistake patterns (P9–P10)
    - **Property 9: Mistake pattern counts are consistent**
    - **Validates: Requirements 4.2, 4.4**
    - **Property 10: Mistake pattern certification filter correctness**
    - **Validates: Requirements 4.3**

- [ ] 8. Export AnalyticsService from AnalyticsModule
  - Add `exports: [AnalyticsService]` to AnalyticsModule so TrainingModule can import it
  - _Requirements: 5.3 (design architecture: TrainingModule imports AnalyticsModule)_

- [ ] 9. Checkpoint - Ensure analytics tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. Create TrainingModule with weakness training
  - [ ] 10.1 Create TrainingModule, TrainingController, and TrainingService scaffolding
    - Create `backend/src/training/training.module.ts` importing PrismaModule and AnalyticsModule
    - Create `backend/src/training/training.controller.ts` with JWT guards
    - Create `backend/src/training/training.service.ts` injecting PrismaService and AnalyticsService
    - Create `backend/src/training/dto/start-weakness-training.dto.ts` with @IsUUID certificationId, @IsOptional @IsInt @Min(1) @Max(50) questionCount
    - _Requirements: 5.1, 5.2_

  - [ ] 10.2 Implement weakness training question selection and exam creation in TrainingService
    - Implement `startWeaknessTraining(userId, dto)` method
    - Fetch domain performance via `analyticsService.getDomains(userId, certificationId)`
    - Assign selection weights inversely proportional to domain score: weight = (100 - domainScore + 10)
    - For each question slot, pick domain via weighted random, then pick random APPROVED question from that domain
    - If no prior attempts, select uniformly at random across all domains
    - If fewer approved questions than requested, return all available
    - Validate certification exists (404), validate approved questions exist (404)
    - Create Exam record (PRIVATE visibility, isAdaptive: true) and ExamAttempt via AttemptsService-style start logic
    - Return response in same shape as `POST /exams/:id/start`
    - _Requirements: 5.3, 5.4, 5.5, 5.6, 5.7_

  - [ ] 10.3 Add `POST /training/weakness/start` endpoint to TrainingController
    - Route handler with JwtAuthGuard, extract userId, call `trainingService.startWeaknessTraining(userId, dto)`
    - _Requirements: 5.1_

  - [ ]* 10.4 Write property tests for weakness training (P11–P13)
    - **Property 11: Weakness training over-samples from weak domains**
    - **Validates: Requirements 5.3**
    - **Property 12: Weakness training selects uniformly without prior history**
    - **Validates: Requirements 5.6**
    - **Property 13: Weakness training only selects APPROVED questions**
    - **Validates: Requirements 5.7**
    - Create `backend/src/training/__tests__/weakness-training.service.spec.ts`

  - [ ]* 10.5 Write unit tests for weakness training edge cases
    - Fewer questions than requested → returns all available
    - Non-existent certification → 404
    - No approved questions → 404
    - _Requirements: 5.5_

- [ ] 11. Implement SM-2 spaced repetition in TrainingService
  - [ ] 11.1 Implement SM-2 pure function and `submitReview(userId, dto)` method
    - Create `backend/src/training/dto/submit-review.dto.ts` with @IsUUID questionId, @IsInt @Min(0) @Max(5) quality
    - Implement SM-2 algorithm as a pure function: handles interval progression (1, 6, prev*ef), quality < 3 reset, easeFactor update with 1.30 floor
    - Validate question exists (404)
    - Upsert ReviewSchedule: create with defaults if not exists, then apply SM-2 update
    - Set nextReviewDate = today + interval days
    - Return updated ReviewSchedule record
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

  - [ ]* 11.2 Write property tests for SM-2 algorithm (P14–P15)
    - **Property 14: SM-2 algorithm produces correct interval, repetitions, and nextReviewDate**
    - **Validates: Requirements 7.3, 7.4, 7.6**
    - **Property 15: EaseFactor never drops below 1.30**
    - **Validates: Requirements 7.5**
    - Create `backend/src/training/__tests__/sm2-algorithm.spec.ts`

  - [ ]* 11.3 Write unit tests for SM-2 specific examples
    - First repetition: quality=4, reps=0 → interval=1
    - Second repetition: quality=4, reps=1 → interval=6
    - Quality=2 reset: interval→1, reps→0
    - _Requirements: 7.3, 7.4_

- [ ] 12. Implement due reviews endpoint
  - [ ] 12.1 Add `getDueReviews(userId, certificationId?, limit?)` method to TrainingService
    - Query ReviewSchedule where userId matches and nextReviewDate <= today
    - Include nested Question with title, description, questionType, domain, choices (exclude isCorrect from choices)
    - Filter by certificationId if provided (through question → certification relation)
    - Order by nextReviewDate ascending
    - Apply limit if provided
    - Return empty array when no reviews are due
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

  - [ ] 12.2 Add `POST /training/review` and `GET /training/due-reviews` endpoints to TrainingController
    - `POST /training/review` with JwtAuthGuard, call `trainingService.submitReview(userId, dto)`
    - `GET /training/due-reviews` with JwtAuthGuard, accept optional certificationId and limit query params
    - _Requirements: 7.1, 8.1_

  - [ ]* 12.3 Write property tests for due reviews (P16–P19)
    - **Property 16: Due reviews returns only records with nextReviewDate on or before today**
    - **Validates: Requirements 8.2**
    - **Property 17: Due reviews include question data without isCorrect**
    - **Validates: Requirements 8.3**
    - **Property 18: Due reviews certification filter correctness**
    - **Validates: Requirements 8.4**
    - **Property 19: Due reviews respects limit and orders by nextReviewDate ascending**
    - **Validates: Requirements 8.5**
    - Create `backend/src/training/__tests__/review-scheduler.service.spec.ts`

  - [ ]* 12.4 Write unit tests for due reviews edge cases
    - No due reviews → empty array
    - _Requirements: 8.6_

- [ ] 13. Register TrainingModule in AppModule
  - Import TrainingModule in `backend/src/app.module.ts`
  - _Requirements: 5.1, 7.1, 8.1_

- [ ] 14. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The SM-2 algorithm is implemented as a pure function for easy property-based testing
- TrainingModule imports AnalyticsModule to reuse getDomains() for weakness detection
