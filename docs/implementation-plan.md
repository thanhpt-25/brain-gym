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
| **Leaderboard (FE)** | Real API-driven leaderboard with global (by points) and per-cert (by best score) modes, podium + table |
| **Infrastructure** | Docker Compose (PostgreSQL + Redis), Prisma migrations, Swagger docs |

### ⚠️ Partially Implemented

| Area | Gap |
|------|-----|
| **Common DTOs** | `PaginationDto` exists but not used in questions controller (manual parsing) |

### ❌ Not Implemented

| Vision Feature | Backend | Frontend |
|----------------|---------|----------|
| Comments | ✅ Full CRUD + threaded replies | ✅ Comment thread on question detail |
| Reports | ✅ Create + admin management | ✅ Report dialog on question detail |
| Analytics / Dashboard | ✅ Full analytics module | ✅ Dashboard with real API data |
| Gamification | ✅ Points + badges + leaderboard | ✅ Leaderboard + points in nav |
| Question Review Workflow | ✅ Status management + pending queue | ✅ Moderation queue in admin |
| User Management | ✅ Full CRUD + role management | ✅ Admin panel with user table |
| Social Sharing | ❌ No share endpoints | ❌ No share UI |
| Exam Builder UI | ✅ Backend ready | ❌ No create exam page |
| Exam Library UI | ✅ Backend ready | ❌ No browse exams page |
| Adaptive Exam | ❌ Schema ready (`isAdaptive`) | ❌ Not started |
| Tags Management | ✅ CRUD + suggestions | ✅ Tags in form + displayed in UI |

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

## Phase 2 — Community Features ✅ COMPLETED

> 🟠 **Priority: P1** — Community-driven content is the key differentiator.

### 2.1 Comments Module (Backend) ✅

- [x] Create `backend/src/comments/` module, controller, service
- [x] Create DTOs: `CreateCommentDto`, `UpdateCommentDto`
- [x] `POST /questions/:id/comments` — add comment (supports `parentId` for replies)
- [x] `GET /questions/:id/comments` — list comments (threaded, include user info)
- [x] `PUT /comments/:id` — edit own comment
- [x] `DELETE /comments/:id` — delete own comment or admin
- [x] Register `CommentsModule` in `AppModule`

### 2.2 Reports Module (Backend) ✅

- [x] Create `backend/src/reports/` module, controller, service
- [x] Create DTOs: `CreateReportDto`, `UpdateReportDto`
- [x] `POST /questions/:id/report` — report question (reason: WRONG_ANSWER, OUTDATED, DUPLICATE, INAPPROPRIATE)
- [x] `GET /reports` — admin list reports (filter by status, paginated)
- [x] `PUT /reports/:id` — resolve or dismiss report (admin only)
- [x] Register `ReportsModule` in `AppModule`

### 2.3 Comments & Reports UI (Frontend) ✅

- [x] Create question detail page (`/questions/:id`) with full question view
- [x] Build comment thread component (nested replies)
- [x] Add comment form with submit to API
- [x] Add report button on questions with reason selector dialog
- [x] Add vote buttons (upvote/downvote) on question detail — connect to existing `POST /questions/:id/vote`

### Enhancements applied during Phase 2

- [x] Enhanced `GET /questions/:id` — includes certification, tags, comment/report counts, and user's vote status
- [x] Updated `JwtAuthGuard` — optionally populates `req.user` on public routes (for vote status on question detail)
- [x] Made question cards in QuestionsBrowser clickable → navigates to `/questions/:id`
- [x] Created frontend services: `src/services/comments.ts`, `src/services/reports.ts`

---

## Phase 3 — Analytics & Dashboard ✅ COMPLETED

> 🟡 **Priority: P2** — Analytics drives user retention and study effectiveness.

### 3.1 Analytics Module (Backend) ✅

- [x] Create `backend/src/analytics/` module, controller, service
- [x] `GET /analytics/me/summary` — aggregate stats:
  - Total exams taken, average score, best score
  - Pass rate, total study time
- [x] `GET /analytics/me/history` — exam attempt history with scores (paginated)
- [x] `GET /analytics/me/domains` — per-domain performance across all attempts
- [x] `GET /analytics/me/weak-topics` — domains/tags with lowest scores
- [x] `GET /analytics/questions/:id/stats` — question-level stats (attempt count, correct rate)
- [x] Register `AnalyticsModule` in `AppModule`
- [x] All endpoints support optional `certificationId` filter

### 3.2 Dashboard Page (Frontend) ✅

- [x] Rewrite `/dashboard` page — replaced mock data with real API calls via React Query
- [x] Certification filter buttons
- [x] Stats overview cards (exams taken, passed, avg score, best score)
- [x] Score trend line chart (Recharts)
- [x] Weak topics horizontal bar chart + domain list with progress bars
- [x] Exam history list with score, date, certification, time spent
- [x] Auth guard — redirects unauthenticated users to login
- [x] Created `src/services/analytics.ts` with typed API functions
- [x] Removed dependency on `mockDashboardData.ts`

---

## Phase 4 — Gamification ✅ COMPLETED

> 🟢 **Priority: P3** — Motivates contributors and creates engagement loop.

### 4.1 Points & Badges (Backend) ✅

- [x] Create `backend/src/gamification/` module, controller, service
- [x] Points system — award points on events:
  - Create question → +10
  - Review/vote on question → +5
  - Complete exam → +3
  - Question approved → +15 (constant defined, triggered on status change)
- [x] `GET /leaderboard` — global (by points) or per-cert (by best score)
- [x] `GET /badges` — list all available badges
- [x] `GET /users/:id/badges` — user's earned badges
- [x] `GET /me/points` — current user's points
- [x] Auto-award badges based on criteria:
  - "First Steps" — completed 1+ exam
  - "Exam Creator" — created 10+ questions
  - "Cloud Master" — passed 5+ exams with 90%+
  - "Dedicated Learner" — completed 20+ exams
  - "Top Contributor" — 500+ points
- [x] Register `GamificationModule` in `AppModule`
- [x] Integrated points into QuestionsService (create + vote) and AttemptsService (submit)

### 4.2 Gamification UI (Frontend) ✅

- [x] Rewrite `/leaderboard` page — replaced mock data with real API
  - Global mode: ranked by points, shows questions created + exams completed
  - Per-cert mode: ranked by best score, shows avg score + total exams
  - Top 3 podium + full rankings table
- [x] Show points with flame icon in nav bar (Index page)
- [x] Created `src/services/gamification.ts` with typed API functions
- [x] Removed dependency on `mockLeaderboardData.ts`

---

## Phase 5 — Quality Control & Admin ✅ COMPLETED

> 🟢 **Priority: P3** — Essential for content quality as community grows.

### 5.1 Question Review Workflow (Backend) ✅

- [x] `PUT /questions/:id/status` — change status (DRAFT → PENDING → APPROVED / REJECTED)
  - Contributors can only submit DRAFT → PENDING
  - Only REVIEWER or ADMIN can approve/reject
  - Awards +15 points to author on approval
- [x] Added `status` filter to `GET /questions`
- [x] `GET /questions/queue/pending` — reviewer queue (REVIEWER/ADMIN only)

### 5.2 User Management (Backend) ✅

- [x] `GET /users` — admin list users (paginated, searchable by name/email)
- [x] `PUT /users/:id/role` — admin change user role
- [x] `PUT /users/me` — update own profile (displayName, avatarUrl)
- [x] `GET /users/:id` — public user profile (displayName, badges, stats)

### 5.3 Admin Panel (Frontend) ✅

- [x] Created `/admin` page (protected by ProtectedRoute + client-side ADMIN role check)
- [x] Users tab — searchable user table with inline role editing via dropdown
- [x] Moderation tab — pending questions queue with approve/reject buttons, shows choices
- [x] Reports tab — filterable by status (PENDING/RESOLVED/DISMISSED), resolve/dismiss actions
- [x] Added Admin link (Shield icon) to Navbar for admin users
- [x] Created `src/services/admin.ts` with typed API functions
- [x] Added route `/admin` to App.tsx

---

## Phase 6 — Exam Builder & Social Sharing ✅ COMPLETED

> 🔵 **Priority: P4** — Enhances the platform after core features are solid.

### 6.1 Backend Enhancements ✅

- [x] Added `sort` query param (`latest` | `popular`) to `GET /exams`
- [x] Added `GET /exams/me` — list current user's created exams
- [x] Added `updateAvgScore()` to ExamsService — recalculates avg score after each attempt submission
- [x] Integrated `updateAvgScore` into AttemptsService submit flow

### 6.2 Exam Builder Page (Frontend) ✅

- [x] Created `/exams/create` page (`ExamBuilder.tsx`) with ProtectedRoute
- [x] Certification selector
- [x] Two question selection modes: random (auto-pick) or manual (pick specific questions)
- [x] Configure: title, description, time limit, question count, visibility (public/private/link)
- [x] Question browser with pagination and checkbox selection in pick mode
- [x] Submit to `POST /exams` API

### 6.3 Exam Library Page (Frontend) ✅

- [x] Created `/exams` page (`ExamLibrary.tsx`) — browse public exams
- [x] Filter by certification, sort by latest/popular
- [x] Exam cards with stats (question count, time limit, attempt count, avg score, author)
- [x] "Take Exam" button starts attempt and navigates to exam simulation
- [x] Copy share link button on each exam card
- [x] Pagination

### 6.4 Social Sharing ✅

- [x] Created `/exams/share/:shareCode` page (`ExamShare.tsx`) — resolve share code, show exam info, start exam
- [x] Share exam via copy link on exam cards (uses shareCode when available)
- [x] Share exam result button on result screen (copies result summary URL)
- [x] Updated ExamPage to accept pre-started attempt data via navigation state
- [x] Added `getExamByShareCode`, `getMyExams` to frontend exams service
- [x] Added "Exams" link to Navbar
- [x] Added routes: `/exams`, `/exams/create`, `/exams/share/:shareCode`

---

## Phase 7 — Anti-cheat & Advanced

> 🔵 **Priority: P4** — Polish and future-proofing.

### 7.1 Anti-cheat (partially done in Phase 1)

- [x] Randomize question order per attempt in `POST /exams/:id/start`
- [x] Randomize choice order per question in attempt response
- [x] Ensure `isCorrect` is **never** exposed in exam start response (only in result)
- [ ] Rate-limit exam starts per user

- [x] `GET /tags` — list tags (filter by certification)
- [x] `POST /tags` (Internal/Automatic) — create tag via `upsert` in question creation
- [x] Wire tag creation into question creation flow (create-or-find)
- [x] Show tag suggestions in `QuestionForm` based on certification
- [x] Display tags in `QuestionsBrowser` and `QuestionDetail`

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
| **Phase 2** | Comments, Reports, Community UI | ✅ Done | — |
| **Phase 3** | Analytics & Dashboard | ✅ Done | — |
| **Phase 4** | Gamification (Points, Badges, Leaderboard) | ✅ Done | — |
| **Phase 5** | Question Review Workflow, Admin Panel | ✅ Done | — |
| **Phase 6** | Exam Builder, Exam Library, Social Sharing | ✅ Done | — |
| **Phase 7** | Anti-cheat, Tags, Adaptive Exam | 🔵 P4 | Small–Medium |
