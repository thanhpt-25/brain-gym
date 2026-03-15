cd backend
npx prisma migrate dev
npx prisma db seed
npm run start:dev
cd backend
npx prisma migrate dev
npx prisma db seed
npm run start:dev
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
| **Anti-cheat** | Question order randomized per attempt, choice order randomized, `isCorrect` never exposed during exam |
| **Infrastructure** | Docker Compose (PostgreSQL + Redis), Prisma migrations, Swagger docs |

### ⚠️ Partially Implemented

| Area | Gap |
|------|-----|
| **Common DTOs** | `PaginationDto` exists but not used in questions controller (manual parsing) |

### ❌ Not Implemented

| Vision Feature | Backend | Frontend |
|----------------|---------|----------|
| Comments | ❌ No comments module | ❌ No comment UI |
| Reports | ❌ No reports module | ❌ No report UI |
| Analytics / Dashboard | ❌ No analytics module | ❌ No dashboard page |
| Gamification | ❌ No points/badges logic | ❌ No leaderboard/badges UI |
| Question Review Workflow | ❌ No status management API | ❌ No moderation queue |
| User Management | ❌ Only `GET /me` | ❌ No admin panel |
| Social Sharing | ❌ No share endpoints | ❌ No share UI |
| Exam Builder UI | ✅ Backend ready | ❌ No create exam page |
| Exam Library UI | ✅ Backend ready | ❌ No browse exams page |
| Adaptive Exam | ❌ Schema ready (`isAdaptive`) | ❌ Not started |
| Tags Management | ❌ No tags CRUD | ❌ Tags in form but not persisted |

---

## Phase 1 — Exam Engine (Backend + Frontend Integration) ✅ COMPLETED

> 🔴 **Priority: P0** — Core product. The exam simulation is the primary user experience.

### 1.1 Exams Module (Backend) ✅

- [x] Create `backend/src/exams/` module, controller, service
- [x] Create DTOs: `CreateExamDto`, `UpdateExamDto`
- [x] `POST /exams` — create exam (select questions, time limit, visibility)
  - Auto-generate `shareCode` for link-shared exams
  - Create `ExamQuestion` join records with sort order
  - Auto-select random approved questions if no `questionIds` provided
- [x] `GET /exams` — list exams (filter by certificationId, visibility; paginated)
- [x] `GET /exams/:id` — get exam with questions and choices
- [x] `PUT /exams/:id` — update exam (owner only)
- [x] `DELETE /exams/:id` — delete exam (owner or admin)
- [x] `GET /exams/share/:shareCode` — access exam by share link
- [x] Register `ExamsModule` in `AppModule`

### 1.2 Exam Attempts Module (Backend) ✅

- [x] Create `backend/src/attempts/` module, controller, service
- [x] Create DTOs: `SubmitAnswerDto`, `SubmitAttemptDto`
- [x] `POST /exams/:id/start` — create `ExamAttempt`, return questions **without `isCorrect`**, randomized order
- [x] `POST /attempts/:id/answer` — save/update individual `Answer` record
- [x] `POST /attempts/:id/submit` — finalize attempt:
  - Calculate score, totalCorrect, totalQuestions
  - Calculate domainScores (JSON)
  - Set `submittedAt`, `timeSpent`, `status = SUBMITTED`
  - Increment `attemptCount` on Exam
- [x] `GET /attempts/:id` — get attempt result with full question review (include `isCorrect`)
- [x] `GET /attempts/me` — list current user's attempts (paginated, ordered by date)

### 1.3 Connect Frontend to Backend ✅

- [x] Rewrite `ExamPage.tsx` — creates exam via API, starts attempt, submits to backend, displays API results
- [x] Rewrite `StudyMode.tsx` — fetches questions from API, handles loading/error states
- [x] Connect `QuestionForm.tsx` submit to `POST /questions` API with error handling
- [x] Replace mock `certifications` import in QuestionForm with `useQuery` from API
- [x] Create frontend service functions: `src/services/exams.ts`, `src/services/attempts.ts`
- [x] Anti-cheat: question + choice order randomized, `isCorrect` stripped from exam start response

### Bug fixes applied during Phase 1

- [x] Fixed `RolesGuard` import path in `certifications.controller.ts` and `questions.controller.ts` (`common/guards/` → `auth/guards/`)
- [x] Fixed `noImplicitAny` errors on `@Req() req` parameters across all controllers

---

## Phase 2 — Community Features

> 🟠 **Priority: P1** — Community-driven content is the key differentiator.

### 2.1 Comments Module (Backend)

- [ ] Create `backend/src/comments/` module, controller, service
- [ ] Create DTOs: `CreateCommentDto`, `UpdateCommentDto`
- [ ] `POST /questions/:id/comments` — add comment (supports `parentId` for replies)
- [ ] `GET /questions/:id/comments` — list comments (threaded, include user info)
- [ ] `PUT /comments/:id` — edit own comment
- [ ] `DELETE /comments/:id` — delete own comment or admin
- [ ] Register `CommentsModule` in `AppModule`

### 2.2 Reports Module (Backend)

- [ ] Create `backend/src/reports/` module, controller, service
- [ ] Create DTOs: `CreateReportDto`, `UpdateReportDto`
- [ ] `POST /questions/:id/report` — report question (reason: WRONG_ANSWER, OUTDATED, DUPLICATE, INAPPROPRIATE)
- [ ] `GET /reports` — admin list reports (filter by status, paginated)
- [ ] `PUT /reports/:id` — resolve or dismiss report (admin only)
- [ ] Register `ReportsModule` in `AppModule`

### 2.3 Comments & Reports UI (Frontend)

- [ ] Create question detail page (`/questions/:id`) with full question view
- [ ] Build comment thread component (nested replies)
- [ ] Add comment form with submit to API
- [ ] Add report button on questions with reason selector dialog
- [ ] Add vote buttons (upvote/downvote) on question detail — connect to existing `POST /questions/:id/vote`

---

## Phase 3 — Analytics & Dashboard

> 🟡 **Priority: P2** — Analytics drives user retention and study effectiveness.

### 3.1 Analytics Module (Backend)

- [ ] Create `backend/src/analytics/` module, controller, service
- [ ] `GET /analytics/me/summary` — aggregate stats:
  - Total exams taken, average score, best score
  - Pass rate, total study time
- [ ] `GET /analytics/me/history` — exam attempt history with scores (paginated)
- [ ] `GET /analytics/me/domains` — per-domain performance across all attempts
- [ ] `GET /analytics/me/weak-topics` — domains/tags with lowest scores
- [ ] `GET /analytics/questions/:id/stats` — question-level stats (attempt count, correct rate)
- [ ] Register `AnalyticsModule` in `AppModule`

### 3.2 Dashboard Page (Frontend)

- [ ] Create `/dashboard` page and add route
- [ ] Exam history list with score, date, certification
- [ ] Score trend line chart (Recharts)
- [ ] Domain breakdown bar/radar chart
- [ ] Weak topics list with study recommendations
- [ ] Pass probability display per certification
- [ ] Add dashboard link to nav bar

---

## Phase 4 — Gamification

> 🟢 **Priority: P3** — Motivates contributors and creates engagement loop.

### 4.1 Points & Badges (Backend)

- [ ] Create `backend/src/gamification/` module, controller, service
- [ ] Points system — award points on events:
  - Create question → +10
  - Review/vote on question → +5
  - Complete exam → +3
  - Question approved → +15
- [ ] `GET /leaderboard` — top users by points (filter by certification, time range)
- [ ] `GET /badges` — list all available badges with criteria
- [ ] `GET /users/:id/badges` — user's earned badges
- [ ] Auto-award badges based on criteria:
  - "Exam Creator" — created 10+ questions
  - "Cloud Master" — passed 5+ exams with 90%+
  - "Top Contributor" — 500+ points
- [ ] Register `GamificationModule` in `AppModule`

### 4.2 Gamification UI (Frontend)

- [ ] Create `/leaderboard` page with top contributors table
- [ ] Add badge display to user profile / dashboard
- [ ] Show points in nav bar next to user name
- [ ] Add points earned toast notifications on actions

---

## Phase 5 — Quality Control & Admin

> 🟢 **Priority: P3** — Essential for content quality as community grows.

### 5.1 Question Review Workflow (Backend)

- [ ] `PUT /questions/:id/status` — change status (DRAFT → PENDING → APPROVED / REJECTED)
  - Only REVIEWER or ADMIN can approve/reject
  - Contributors can submit DRAFT → PENDING
- [ ] Add `status` filter to `GET /questions` (default: APPROVED for public, all for admin)
- [ ] Add `GET /questions/pending` — reviewer queue

### 5.2 User Management (Backend)

- [ ] `GET /users` — admin list users (paginated, searchable)
- [ ] `PUT /users/:id/role` — admin change user role
- [ ] `PUT /users/me` — update own profile (displayName, avatarUrl)
- [ ] `GET /users/:id` — public user profile (displayName, badges, stats)

### 5.3 Admin Panel (Frontend)

- [ ] Create `/admin` page (protected by ADMIN role)
- [ ] User management table with role editing
- [ ] Question moderation queue — list pending questions, approve/reject actions
- [ ] Reports management — list open reports, resolve/dismiss

---

## Phase 6 — Exam Builder & Social Sharing

> 🔵 **Priority: P4** — Enhances the platform after core features are solid.

### 6.1 Exam Builder Page (Frontend)

- [ ] Create `/exams/create` page and add route
- [ ] Certification selector
- [ ] Question pool browser — pick specific questions or random selection
- [ ] Configure: time limit, question count, difficulty distribution
- [ ] Set visibility (public / private / link-shared)
- [ ] Submit to `POST /exams` API

### 6.2 Exam Library Page (Frontend)

- [ ] Create `/exams` page — browse public exams
- [ ] Filter by certification, sort by popularity/date
- [ ] Show exam cards with stats (attempt count, avg score)

### 6.3 Social Sharing

- [ ] Shareable exam result card (OG meta tags or image generation)
- [ ] Share exam via `shareCode` link
- [ ] "Challenge a friend" flow — share exam link with pre-filled message

---

## Phase 7 — Anti-cheat & Advanced

> 🔵 **Priority: P4** — Polish and future-proofing.

### 7.1 Anti-cheat (partially done in Phase 1)

- [x] Randomize question order per attempt in `POST /exams/:id/start`
- [x] Randomize choice order per question in attempt response
- [x] Ensure `isCorrect` is **never** exposed in exam start response (only in result)
- [ ] Rate-limit exam starts per user

### 7.2 Tags Management (Backend)

- [ ] `GET /tags` — list tags (filter by certification)
- [ ] `POST /tags` — create tag (contributor+)
- [ ] Wire tag creation into question creation flow (create-or-find)

### 7.3 Adaptive Exam (Future)

- [ ] Design adaptive algorithm (item response theory or simpler bracket system)
- [ ] Track real-time difficulty during attempt
- [ ] Select next question based on running performance
- [ ] Use `isAdaptive` flag on Exam model

---

## Summary

| Phase | Focus | Priority | Est. Effort |
|-------|-------|----------|-------------|
| **Phase 1** | Exam Engine + Frontend Integration | ✅ Done | — |
| **Phase 2** | Comments, Reports, Community UI | 🟠 P1 | Medium |
| **Phase 3** | Analytics & Dashboard | 🟡 P2 | Medium |
| **Phase 4** | Gamification (Points, Badges, Leaderboard) | 🟢 P3 | Medium |
| **Phase 5** | Question Review Workflow, Admin Panel | 🟢 P3 | Medium |
| **Phase 6** | Exam Builder, Exam Library, Social Sharing | 🔵 P4 | Medium |
| **Phase 7** | Anti-cheat, Tags, Adaptive Exam | 🔵 P4 | Small–Medium |
