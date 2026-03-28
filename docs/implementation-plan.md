# Brain Gym — Implementation Plan

> Gap analysis between the [vision document](./vision.md) and current codebase, with a phased task list for remaining work.

---

## Current Status

### ✅ Implemented

| Area | Details |
|------|---------|
| **Auth (BE)** | Login, register, refresh token, JWT guards, roles guard, `@Public()` / `@Roles()` decorators |
| **Users (BE)** | `GET /users/me`, create, findByEmail, findById |
| **Certifications (BE)** | `GET /certifications`, `GET /certifications/:id`, `POST /certifications` (admin), domains included |
| **Questions (BE)** | `GET /questions` (paginated), `GET /questions/:id`, `POST /questions`, `POST /questions/:id/vote` |
| **Exams (BE)** | `POST /exams`, `GET /exams`, `GET /exams/:id`, `GET /exams/share/:code`, `PUT /exams/:id`, `DELETE /exams/:id` — auto-random question selection, share code generation |
| **Attempts (BE)** | `POST /exams/:id/start` (randomized, `isCorrect` stripped), `POST /attempts/:id/answer`, `POST /attempts/:id/submit` (scoring + domain breakdown), `GET /attempts/:id`, `GET /attempts/me` |
| **DB Schema** | All 16 Prisma models defined — User, Certification, Domain, Question, Choice, Tag, QuestionTag, Exam, ExamQuestion, ExamAttempt, Answer, Comment, Vote, Report, Badge, BadgeAward |
| **Seed Data** | Users (admin + contributor), 5 certifications with domains, 3 sample questions |
| **Landing Page (FE)** | Hero, certification cards (from API), features section, stats, nav with auth state |
| **Auth Page (FE)** | Login/register form, Zustand persist, redirect after login |
| **Questions Browser (FE)** | Browse questions from API, filter by certification, pagination |
| **Question Form (FE)** | Create question with live preview — connected to `POST /questions` API, certifications from API |
| **Exam Simulation (FE)** | Full exam UI — creates exam via API, starts attempt, submits to backend, displays API results with domain breakdown |
| **Study Mode (FE)** | Fetches questions from API, random order, reveal answer, explanation, session stats |
| **API Layer (FE)** | Axios instance with JWT interceptor, token refresh, service functions for auth/certifications/questions/exams/attempts |
| **Analytics (BE)** | `GET /analytics/me/summary`, `GET /analytics/me/history`, `GET /analytics/me/domains`, `GET /analytics/me/weak-topics`, `GET /analytics/questions/:id/stats` |
| **Dashboard (FE)** | Real API-driven dashboard with cert filter, stats overview, score trend chart, weak topics chart, exam history list |
| **Anti-cheat** | Question order randomized per attempt, choice order randomized, `isCorrect` never exposed during exam |
| **Comments (BE)** | `GET /questions/:id/comments` (threaded), `POST /questions/:id/comments` (with replies), `PUT /comments/:id`, `DELETE /comments/:id` |
| **Reports (BE)** | `POST /questions/:id/report`, `GET /reports` (admin, paginated), `PUT /reports/:id` (admin resolve/dismiss) |
| **Question Detail (FE)** | Full question view with choices, explanation, voting (up/down), threaded comments, report dialog |
| **Question Review (BE)** | `PUT /questions/:id/status` (role-based), `GET /questions/queue/pending`, status filter on `GET /questions` |
| **User Management (BE)** | `GET /users` (admin, searchable), `PUT /users/:id/role` (admin), `PUT /users/me` (profile), `GET /users/:id` (public profile with badges) |
| **Admin Panel (FE)** | `/admin` page with Users tab (role editing), Moderation tab (approve/reject queue), Reports tab (resolve/dismiss) |
| **Gamification (BE)** | Points system (+10 create question, +5 vote, +3 complete exam), auto-badge awards, `GET /leaderboard`, `GET /badges`, `GET /users/:id/badges`, `GET /me/points` |
| **Flashcards (BE/FE)** | Full SRS Flashcard system with decks, in-exam word capture, and training hub integration |
| **Leaderboard (FE)** | Real API-driven leaderboard with global (by points) and per-cert (by best score) modes, podium + table |
| **Infrastructure** | Docker Compose (PostgreSQL + Redis) with parameterized environment variables, Prisma migrations, Swagger docs, Nginx reverse proxy |
| **UI/UX Performance** | Route-level lazy loading, infinite scroll, search debouncing, error boundaries, scroll restoration |
| **Optimistic UI** | Instant feedback for voting and quick actions |
| **Gamification** | Points system (+10 create/vote), auto-badge awards, leaderboard (global/per-cert) |
| **Admin & Workflow** | Question moderation queue, report resolution, user role management |
| **Exam Engine** | Builder (custom count/time), library browsing, social sharing (share codes) |
| **System Polish** | Standardized `PaginationDto` across all controllers, `@nestjs/throttler` rate limiting |
| **Questions UI** | Full support for multi-paragraph Scenario questions with distinct styling |
| **Adaptive Training** | SM-2 SRS reviews, weak-topic targeting, readiness prediction |
| **Community** | Threaded comments, question reports, voting, public profiles |
| **Resistance training** | Accelerated timer mode, red timer UI hints, time-per-question analytics |
| **Trap Question Library** | `isTrapQuestion` flag, dedicated UI module for "tricky" questions |

### ⚠️ Partially Implemented
*(No major technical gaps remaining in core features.)*

### ❌ Not Implemented

| Vision Feature | Priority | Missing Components |
|----------------|----------|--------------------|
| **Social Squads** | P3 | `Squad` model, collaborative leaderboards, private squad chats |
| **AI Coach (NotebookLM)** | P3 | ELI5 explanation rewriter, automated semantic duplicate detection |
| **Burnout Detection** | P4 | AI monitoring of response time variance during sessions |
| **Cross-Cert Knowledge Graph** | P4 | Mapping overlapping domains across different cloud providers |
| **Dynamic Difficulty Scaling** | P4 | Automated modification of distractors/values to prevent rote memorization |

---

## Phase 1 to Phase 6 ✅ COMPLETED
*(Exam Engine, Community Features, Analytics, Gamification, Admin Panel, Builder & Sharing are complete.)*

---

## Phase 7 — Anti-cheat & System Polish

> 🔵 **Priority: P4** — Polish and future-proofing.

### 7.1 Anti-cheat & Security
- [x] Randomize question order per attempt
- [x] Randomize choice order per question in attempt response
- [x] Ensure `isCorrect` is never exposed during test
- [x] Rate-limit exam starts per user (5/min via `@nestjs/throttler`)
- [x] Standardize `PaginationDto` usage across all core controllers

### 7.2 Tags & Categories
- [x] `GET /tags` & `POST /tags`
- [x] Wire Tag creation into Question Creation
- [x] Display Tags in UI

---

## Phase 8 — Advanced Analytics & Readiness Strategy ✅ COMPLETED

> 🟠 **Priority: P1** — Gives users a clear signal of when they are ready to sit the real exam.

### 8.1 Readiness Scoring Engine (Backend)
- [x] Create `backend/src/readiness/` logic within `AnalyticsModule`.
- [x] Implement `calculateReadinessScore(userId, certificationId)`:
  - Weight recent exams heavier than older exams.
  - Calculate domain-specific confidence scores.
- [x] Expose `GET /analytics/readiness/:certificationId` endpoint.

### 8.2 Mistake Pattern Analytics (Backend)
- [x] Extend `Answer` model to track `mistakeType` (Concept, Careless, Trap, Time Pressure).
- [x] Allow users to self-tag mistakes in Exam Results page.
- [x] Expose `GET /analytics/mistake-patterns`.

### 8.3 Readiness Dashboard (Frontend)
- [x] Add "Exam Readiness Score" widget to Dashboard (Real data).
- [x] Show pass probability and focus areas.
- [x] Add "Mistake Pattern" pie chart to Dashboard.

---

## Phase 9 — Cognitive Training & Spaced Repetition ✅ COMPLETED

> 🟠 **Priority: P1** — Transitions platform from a question bank to a memory reinforcement engine.

### 9.1 Adaptive Weakness Training (Backend)
- [x] Implement `POST /training/weakness/start` — generates adaptive mini-exams.
- [x] Fixed 400 Bad Request by allowing slug-based `certificationId` and relaxing UUID validation.

### 9.2 Spaced Repetition System (SRS) (Backend)
- [x] Create `ReviewSchedule` model (SM-2 algorithm).
- [x] Update schedule based on SuperMemo-2 when a user answers in Training Hub.
- [x] `GET /training/due-reviews` — fetch questions due for review.

### 9.3 Training Modes UI (Frontend)
- [x] Implement "Weakness Targeting" mode.
- [x] Implement "Daily Review" (SRS) mode.
- [x] Track "Daily Streak" via local store.

---

## Phase 10 — High-Pressure Simulation & Exam Tactics ✅ COMPLETED

> 🟡 **Priority: P2** — Focus on time pressure and scenario reasoning matching real exam conditions.

### 10.1 Resistance Training Mode
- [x] Add `timerMode` enum (`STRICT`, `ACCELERATED`, `RELAXED`) to Prisma schema and `CreateExamDto`.
- [x] Frontend: Timer mode selector in ExamIntro and ExamBuilder. Mode-aware visual cues (orange at 50%, red+pulse at 25% for ACCELERATED; muted for RELAXED).
- [x] Backend: `GET /analytics/me/hesitation` — detects questions where avg time > 2× per-question budget.

### 10.2 Trap Question Library & Scenarios
- [x] Add `isTrapQuestion` boolean to `Question` model (migration applied).
- [x] Scenario Questions: Visual support for multi-paragraph context in Detail/Browser/Form.
- [x] Trap Question Library: `/trap-questions` page with cert filter, infinite scroll, trap badges. Nav link added. Question form toggle for contributors.

---

## Phase 11 — Social Squads & AI Coaching

> 🔵 **Priority: P3** — Long-term growth and retention mechanisms.

### 11.1 Training Squads (Collaborative Learning)
- [ ] `Squad` model (name, leader, members, certificationTarget).
- [ ] `GET /squads`, `POST /squads`, `POST /squads/:id/join`.
- [ ] Squad Leaderboards: Aggregate points of members to rank squads against each other.

### 11.2 Cross-Certification Knowledge Graph
- [ ] Map overlapping domains across certifications (e.g., AWS VPC -> Azure VNet).
- [ ] "Skill Translation" UI showing how close a user is to secondary certs.

### 11.3 AI-Supported Question Banks ⚙️ IN PROGRESS
- [x] Prisma schema: `UserLlmConfig`, `SourceMaterial`, `SourceChunk`, `QuestionGenerationJob` models + `LlmProvider`, `GenerationJobStatus`, `QualityTier`, `MaterialContentType` enums
- [x] `Question` model extended: `isAiGenerated`, `generationJobId`, `qualityTier`, `sourceChunkId`
- [x] `backend/src/ai-question-bank/` module: encryption service (AES-256-GCM), LLM provider adapters (OpenAI/Anthropic/Gemini), ingestion service (PDF/URL/text chunking), generation pipeline, two-pass quality gate (critic LLM), MCP intake endpoint
- [x] API Key mode: users BYOK for OpenAI / Anthropic / Gemini; keys encrypted at rest
- [x] MCP mode: `POST /ai-questions/mcp/intake` for Claude Desktop / NotebookLM to push questions
- [x] Quality gate: score ≥ 0.85 → auto-APPROVED, 0.60–0.84 → PENDING review queue, <0.60 → discarded
- [x] Frontend: `AiQuestionGenerator` page with settings, material library, generation form, review UI, history
- [ ] Run `prisma migrate dev --name ai_question_bank && prisma generate` (requires DB)
- [ ] Add `pdf-parse` and `@nestjs/platform-express` multer to backend dependencies

### 11.4 AI Coaching (future)
- [ ] Integrate with personal NotebookLM
- [ ] Coach feature: automatically suggest simplifications for dense explanations.
- [ ] Dynamic Difficulty Scaling (DDS): AI tweaks question numbers/details slightly on retries.

---

## Phase 12 — Flashcards & In-Exam Smart Capture ✅ COMPLETED

> 🟠 **Priority: P1** — Bridges the gap between exam-taking and vocabulary/concept memorization.

- [x] Backend: Create `Deck`, `Flashcard`, `CapturedWord` models.
- [x] Backend: Implement SRS logic for custom flashcards (SM-2 parallel).
- [x] Backend: Create `CaptureModule` for in-exam words.
- [x] Frontend: Implement Deck Management & Flashcard Creator UI.
- [x] Frontend: Implement In-Exam Text Selection & Capture UX.
- [x] Frontend: Create Capture Processing Queue.
- [x] Integration: Show due flashcards in Training Hub & Dashboard.

---

## Phase 13 — UI/UX Performance & Resilience ✅ COMPLETED

> 🟠 **Priority: P1** — Ensures a smooth, professional, and reliable user experience.

- [x] **Route-level Lazy Loading**: Implemented via `React.lazy` and `Suspense` for all main pages.
- [x] **Infinite Scroll**: Added to Questions Browser with Intersection Observer and `useInfiniteQuery`.
- [x] **Search Debouncing**: Optimized API calls in search inputs (400ms delay).
- [x] **Global Error Boundary**: Graceful error handling for React rendering crashes.
- [x] **Scroll Restoration**: Automatically resets scroll position on navigation.
- [x] **Optimistic UI**: Implemented for voting to provide instant feedback.

---

## Phase 14 — Infrastructure DevSecOps ✅ COMPLETED

> 🔵 **Priority: P3** — Robust deployment and configuration management.

- [x] **Parameterized Environment Variables**: Full parameterization of `docker-compose.yml` with intelligent defaults.
- [x] **Config Management**: Centralized `.env.example` and secret separation.
- [x] **Container Security**: Read-only volumes for Nginx config, non-root alpine images.
- [x] **Health Checks**: Redis and PostgreSQL health monitoring in orchestration.

---

## Phase 15 — System Polish & Security Verification ✅ COMPLETED

> 🔵 **Priority: P4** — Finalizing core security and standardization.

- [x] **Pagination Standardization**: Unified `PaginationDto` across Questions, Users, Reports, and Attempts controllers.
- [x] **Rate Limiting**: Integrated `@nestjs/throttler` with multi-tier limits (Global: 60/min, Exam Start: 5/min).
- [x] **Scenario UI**: Visual support for multi-paragraph technical context with premium styling and icons.
- [x] **Testing & Verification**: Successful execution of Unit (UT) and Integration (IT) tests for the new security layers.

---

## Summary

| Phase | Focus | Priority | Est. Effort |
|-------|-------|----------|-------------|
| **Phase 1-6** | Core Platform Features | ✅ Done | — |
| **Phase 7** | Anti-cheat & Security | ✅ Done | Small |
| **Phase 8** | Advanced Analytics & Readiness Strategy | ✅ Done | Medium |
| **Phase 9** | Cognitive Training & Spaced Repetition | ✅ Done | Large |
| **Phase 10** | High-Pressure Simulation & Exam Tactics | ✅ Done | Medium |
| **Phase 11** | Social Squads & AI Coaching | 🔵 P3 | Large |
| **Phase 12** | Flashcards & Word Capture | ✅ Done | Large |
| **Phase 13** | UI/UX Performance & Resilience | ✅ Done | Medium |
| **Phase 14** | Infrastructure DevSecOps | ✅ Done | Small |
| **Phase 15** | System Polish & Security Verification | ✅ Done | Small |

