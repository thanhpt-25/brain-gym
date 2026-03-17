# Requirements Document

## Introduction

This document specifies the backend requirements for Phase 8 (Advanced Analytics & Readiness Strategy) and Phase 9 (Cognitive Training & Spaced Repetition) of the Brain Gym application. The frontend for these features has already been built by Lovable. The backend must expose REST API endpoints that the existing frontend consumes. The work spans three areas: a readiness scoring engine that predicts exam pass probability, a mistake pattern analytics system for self-reflection, and a cognitive training module with adaptive weakness targeting and spaced repetition (SM-2 algorithm).

## Glossary

- **Readiness_Engine**: The backend service responsible for computing a user's exam readiness score and pass probability for a given certification.
- **Mistake_Analyzer**: The backend service responsible for tracking, categorizing, and aggregating mistake patterns from incorrect answers.
- **Training_Service**: The backend service responsible for generating weakness-focused mini-exams and managing spaced repetition review schedules.
- **Review_Scheduler**: The component within Training_Service that implements the SuperMemo-2 (SM-2) algorithm to schedule question reviews at optimal intervals.
- **Answer**: The existing Prisma model that records a user's response to a question within an exam attempt, including selectedChoices, isCorrect, isMarked, and timeSpent.
- **ExamAttempt**: The existing Prisma model that records a user's exam session, including domainScores (JSON), score, totalCorrect, totalQuestions, and submittedAt.
- **ReviewSchedule**: A new Prisma model that stores per-user, per-question spaced repetition state including nextReviewDate, interval, and easeFactor.
- **MistakeType**: An enumeration of mistake categories: CONCEPT, CARELESS, TRAP, TIME_PRESSURE.
- **SM-2 Algorithm**: The SuperMemo-2 spaced repetition algorithm that adjusts review intervals and ease factors based on a user's self-reported quality rating (0–5).
- **Readiness_Score**: A composite numeric score (0–100) representing a user's predicted likelihood of passing a certification exam.
- **Domain_Confidence**: A per-domain score (0–100) representing a user's mastery level in a specific certification domain.
- **Weakness_Exam**: A dynamically generated mini-exam that over-samples questions from a user's lowest-scoring domains.

## Requirements

### Requirement 1: Readiness Score Calculation

**User Story:** As a learner, I want to see a readiness score for a certification, so that I know whether I am prepared to sit the real exam.

#### Acceptance Criteria

1. WHEN a user requests a readiness score for a certification, THE Readiness_Engine SHALL compute a Readiness_Score by weighting recent ExamAttempt scores higher than older ExamAttempt scores using an exponential time-decay function.
2. WHEN a user requests a readiness score for a certification, THE Readiness_Engine SHALL compute a Domain_Confidence score for each domain within the certification based on the user's aggregated domain-level performance across all submitted ExamAttempt records.
3. IF a user has zero submitted ExamAttempt records for the requested certification, THEN THE Readiness_Engine SHALL return a Readiness_Score of 0 and an empty list of Domain_Confidence scores.
4. THE Readiness_Engine SHALL return the Readiness_Score as an integer between 0 and 100 inclusive.
5. THE Readiness_Engine SHALL return each Domain_Confidence score as an integer between 0 and 100 inclusive.
6. WHEN computing the Readiness_Score, THE Readiness_Engine SHALL factor in the number of exams completed, the recency-weighted average score, and the minimum Domain_Confidence score to penalize uneven domain coverage.

### Requirement 2: Readiness Score API Endpoint

**User Story:** As a frontend client, I want a REST endpoint to fetch readiness data, so that the existing readiness dashboard widgets can display the data.

#### Acceptance Criteria

1. THE Readiness_Engine SHALL expose a `GET /analytics/readiness/:certificationId` endpoint that requires JWT authentication.
2. WHEN a valid authenticated request is received, THE Readiness_Engine SHALL return a JSON response containing the Readiness_Score, a list of Domain_Confidence objects (domain name, score, correct count, total count), the total number of exams taken, and the recency-weighted average score.
3. IF the certificationId path parameter does not correspond to an existing certification, THEN THE Readiness_Engine SHALL return an HTTP 404 status with a descriptive error message.

### Requirement 3: Mistake Type Tracking

**User Story:** As a learner, I want to categorize my mistakes when reviewing incorrect answers, so that I can understand my failure patterns.

#### Acceptance Criteria

1. THE Answer model SHALL include an optional `mistakeType` field that accepts one of the MistakeType enum values: CONCEPT, CARELESS, TRAP, or TIME_PRESSURE.
2. THE Mistake_Analyzer SHALL expose a `PATCH /answers/:answerId/mistake-type` endpoint that requires JWT authentication.
3. WHEN a user submits a valid MistakeType for an Answer that belongs to the user's own ExamAttempt, THE Mistake_Analyzer SHALL update the mistakeType field on the Answer record.
4. IF a user attempts to tag a MistakeType on an Answer that does not belong to the user's own ExamAttempt, THEN THE Mistake_Analyzer SHALL return an HTTP 403 status.
5. IF the answerId does not correspond to an existing Answer, THEN THE Mistake_Analyzer SHALL return an HTTP 404 status.
6. WHEN a user submits a MistakeType, THE Mistake_Analyzer SHALL only accept the request for Answer records where isCorrect is false.

### Requirement 4: Mistake Pattern Analytics Endpoint

**User Story:** As a learner, I want to see aggregated mistake pattern data, so that I can identify whether I fail due to conceptual gaps, carelessness, traps, or time pressure.

#### Acceptance Criteria

1. THE Mistake_Analyzer SHALL expose a `GET /analytics/mistake-patterns` endpoint that requires JWT authentication.
2. WHEN a valid authenticated request is received, THE Mistake_Analyzer SHALL return a JSON response containing the count of each MistakeType across all of the user's tagged Answer records.
3. WHEN a `certificationId` query parameter is provided, THE Mistake_Analyzer SHALL filter the aggregation to only include Answer records from ExamAttempt records associated with exams for the specified certification.
4. THE Mistake_Analyzer SHALL return a total count of tagged mistakes alongside the per-type breakdown.
5. IF the user has zero tagged mistakes, THEN THE Mistake_Analyzer SHALL return zero counts for each MistakeType and a total of 0.

### Requirement 5: Adaptive Weakness Training

**User Story:** As a learner, I want to start a training session focused on my weakest domains, so that I can improve where I need it most.

#### Acceptance Criteria

1. THE Training_Service SHALL expose a `POST /training/weakness/start` endpoint that requires JWT authentication.
2. WHEN a user starts a weakness training session, THE Training_Service SHALL accept a certificationId and an optional questionCount (defaulting to 10) in the request body.
3. WHEN generating a Weakness_Exam, THE Training_Service SHALL select questions by over-sampling from the user's lowest-scoring domains as determined by the existing analytics getDomains data.
4. THE Training_Service SHALL create an Exam record and an ExamAttempt record for the generated Weakness_Exam, and return the attempt data in the same format as the existing `POST /exams/:id/start` endpoint.
5. IF the certification has fewer approved questions than the requested questionCount, THEN THE Training_Service SHALL return all available approved questions for that certification.
6. IF the user has no prior ExamAttempt records for the certification, THEN THE Training_Service SHALL select questions uniformly at random across all domains.
7. THE Training_Service SHALL only select questions with a status of APPROVED.

### Requirement 6: Spaced Repetition Data Model

**User Story:** As a system, I need a data model to track per-user, per-question review schedules, so that the SM-2 algorithm can persist state between sessions.

#### Acceptance Criteria

1. THE Review_Scheduler SHALL use a ReviewSchedule Prisma model with the following fields: id (UUID primary key), userId (foreign key to User), questionId (foreign key to Question), nextReviewDate (DateTime), interval (integer representing days), easeFactor (Decimal with precision 4 and scale 2, default 2.50), repetitions (integer, default 0), createdAt (DateTime), and updatedAt (DateTime).
2. THE ReviewSchedule model SHALL enforce a unique constraint on the combination of userId and questionId.
3. THE ReviewSchedule model SHALL cascade-delete when the referenced User or Question is deleted.

### Requirement 7: SM-2 Algorithm Schedule Update

**User Story:** As a learner, I want my review schedule to update automatically when I answer a question in study mode, so that I review questions at optimal intervals.

#### Acceptance Criteria

1. THE Review_Scheduler SHALL expose a `POST /training/review` endpoint that requires JWT authentication.
2. WHEN a user submits a review result, THE Review_Scheduler SHALL accept a questionId and a quality rating (integer 0 through 5 inclusive) in the request body.
3. WHEN the quality rating is 3 or higher, THE Review_Scheduler SHALL increase the interval according to the SM-2 algorithm: interval 1 for the first repetition, interval 6 for the second repetition, and previous interval multiplied by the easeFactor for subsequent repetitions.
4. WHEN the quality rating is below 3, THE Review_Scheduler SHALL reset the interval to 1 and the repetitions count to 0 while preserving the current easeFactor.
5. THE Review_Scheduler SHALL update the easeFactor using the SM-2 formula: easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)), with a minimum easeFactor of 1.30.
6. THE Review_Scheduler SHALL set the nextReviewDate to the current date plus the computed interval in days.
7. IF no ReviewSchedule record exists for the given userId and questionId, THEN THE Review_Scheduler SHALL create a new record with default values before applying the SM-2 update.

### Requirement 8: Due Reviews Endpoint

**User Story:** As a learner, I want to fetch questions that are due for review today, so that I can complete my daily spaced repetition session.

#### Acceptance Criteria

1. THE Review_Scheduler SHALL expose a `GET /training/due-reviews` endpoint that requires JWT authentication.
2. WHEN a valid authenticated request is received, THE Review_Scheduler SHALL return all ReviewSchedule records for the user where nextReviewDate is on or before the current date.
3. THE Review_Scheduler SHALL include the full Question data (title, description, choices without isCorrect, domain, questionType) for each due review item.
4. WHEN a `certificationId` query parameter is provided, THE Review_Scheduler SHALL filter due reviews to only include questions belonging to the specified certification.
5. WHEN a `limit` query parameter is provided, THE Review_Scheduler SHALL cap the number of returned due reviews to the specified limit, ordered by nextReviewDate ascending (oldest due first).
6. THE Review_Scheduler SHALL return an empty array when no reviews are due.

### Requirement 9: Prisma Schema Migration

**User Story:** As a developer, I need the database schema updated to support the new features, so that the application can persist readiness and training data.

#### Acceptance Criteria

1. THE database schema SHALL include a new `MistakeType` enum with values CONCEPT, CARELESS, TRAP, and TIME_PRESSURE.
2. THE Answer model SHALL include a new optional `mistakeType` field of type MistakeType, mapped to the column `mistake_type`.
3. THE database schema SHALL include a new `ReviewSchedule` model mapped to the table `review_schedules` with all fields specified in Requirement 6.
4. THE Prisma migration SHALL be additive and not modify or remove any existing columns or tables.
