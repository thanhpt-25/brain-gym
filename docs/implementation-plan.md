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
| Social Sharing | ✅ Full share endpoints | ✅ Full share UI |
| Exam Builder UI | ✅ Backend ready | ✅ Full create exam page |
| Exam Library UI | ✅ Backend ready | ✅ Browse exams page |
| Adaptive Exam | ✅ Full implementation (Phase 9) | ✅ Training Hub integration |
| Tags Management | ✅ CRUD + suggestions | ✅ Tags in form + displayed in UI |

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
- [ ] Rate-limit exam starts per user

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

## Phase 10 — High-Pressure Simulation & Exam Tactics

> 🟡 **Priority: P2** — Focus on time pressure and scenario reasoning matching real exam conditions.

### 10.1 Resistance Training Mode
- [ ] Add `timerMode` option to `CreateExamDto` (`STRICT`, `ACCELERATED`, `RELAXED`).
- [ ] Frontend: Implement visual cues (red timer, warnings) in Accelerated Mode.
- [ ] Backend: Track "time per question" in analytics to detect hesitation.

### 10.2 Trap Question Library & Scenarios
- [ ] Add `isTrapQuestion` boolean to `Question` model.
- [ ] Add `scenarioText` to `Question` model for multi-paragraph context.
- [ ] Create UI view "Trap Question Training" that specifically serves high-failure-rate tricky questions.

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

### 11.3 AI Coaching Integration
- [ ] Integrate with personal NotebookLM
- [ ] Coach feature: automatically suggest simplifications for dense explanations.
- [ ] Dynamic Difficulty Scaling (DDS): AI tweaks question numbers/details slightly on retries.

---

## Summary

| Phase | Focus | Priority | Est. Effort |
|-------|-------|----------|-------------|
| **Phase 1-6** | Core Platform Features | ✅ Done | — |
| **Phase 7** | Anti-cheat | 🔵 P4 | Small |
| **Phase 8** | Advanced Analytics & Readiness Strategy | 🟠 P1 | Medium |
| **Phase 9** | Cognitive Training & Spaced Repetition | 🟠 P1 | Large |
| **Phase 10** | High-Pressure Simulation & Exam Tactics | 🟡 P2 | Medium |
| **Phase 11** | Social Squads & AI Coaching | 🔵 P3 | Large |
