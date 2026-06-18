# 03 - API Design

CertGym exposes a RESTful API powered by NestJS. This document is generated from the actual controller files and reflects the routes, HTTP methods, and guards that exist in the codebase.

## 1. Core Conventions

- **Global prefix**: Every endpoint is prefixed with `/api/v1`. Route paths in the tables below omit this prefix.
- **Authentication**: JWT Bearer token in the `Authorization` header. The global `JwtAuthGuard` is applied by default; routes decorated with `@Public()` bypass it.
- **Data exchange**: JSON for all request and response bodies. File uploads use `multipart/form-data` where noted.
- **Validation**: Global `ValidationPipe` using `class-validator` and `class-transformer`.
- **Swagger**: Interactive docs available at `/api/docs` in development.

### Guard reference

| Decorator / Guard | Meaning |
|---|---|
| `@Public()` | No authentication required. |
| `JwtAuthGuard` | Valid JWT required. |
| `RolesGuard` + `@Roles(...)` | Caller's global `UserRole` must match. Global roles: `ADMIN`, `REVIEWER`, `CONTRIBUTOR`, `LEARNER`. |
| `OrgRoleGuard` + `@OrgRoles(...)` | Caller must be a member of the org with one of the listed `OrgRole` values: `OWNER`, `ADMIN`, `MANAGER`, `RECRUITER`, `MEMBER`. |
| `AuthGuard('jwt')` | Passport JWT strategy — functionally equivalent to `JwtAuthGuard`. |

## 2. Standardized Responses

Successful responses return objects or arrays directly. Errors use standard HTTP status codes:

| Code | Meaning |
|---|---|
| `400 Bad Request` | Validation errors, malformed payloads. |
| `401 Unauthorized` | Missing or expired JWT. |
| `403 Forbidden` | Valid JWT but insufficient role or plan access. |
| `404 Not Found` | Resource does not exist. |
| `429 Too Many Requests` | Rate limit exceeded (Throttler). |
| `500 Internal Server Error` | Unhandled exception. |

---

## 3. Route Tables

Routes are grouped by functional area. The path column shows the path after `/api/v1`.

---

### Auth

| Method | Route | Guard / Auth | Description |
|---|---|---|---|
| POST | `/auth/login` | `@Public()` | Authenticate with email + password; returns `accessToken` and `refreshToken`. |
| POST | `/auth/register` | `@Public()` | Create a new user account; returns tokens. |
| POST | `/auth/oauth/:provider` | `@Public()` | Login or register via OAuth provider (e.g. `google`); body: `{ token }`. |
| POST | `/auth/refresh` | `@Public()` | Exchange a valid refresh token for new tokens; body: `{ refreshToken }`. |

---

### Users

| Method | Route | Guard / Auth | Description |
|---|---|---|---|
| GET | `/users/me` | JWT | Get the authenticated user's profile. |
| GET | `/users/me/overview` | JWT | Profile overview with stats, badges, activity, and certifications. |
| PUT | `/users/me` | JWT | Update own profile (`displayName`, `avatarUrl`). |
| POST | `/users/me/avatar/presign` | JWT | Get a presigned S3 PUT URL for avatar upload. |
| POST | `/users/me/avatar/confirm` | JWT | Confirm avatar upload by saving the object key to the profile. |
| POST | `/users/me/avatar/upload-local` | JWT | Local-dev avatar upload via multipart form (disk storage). |
| PUT | `/users/me/password` | JWT | Change own password. |
| GET | `/users` | JWT + `ADMIN` | List all users with optional `search`, `page`, `limit` query params. |
| PUT | `/users/:id/role` | JWT + `ADMIN` | Change a user's global role. |
| PUT | `/users/:id/plan` | JWT + `ADMIN` | Change a user's subscription plan. |
| PUT | `/users/:id/suspend` | JWT + `ADMIN` | Suspend a user (with reason and optional end date). |
| PUT | `/users/:id/ban` | JWT + `ADMIN` | Permanently ban a user. |
| PUT | `/users/:id/reactivate` | JWT + `ADMIN` | Reactivate a suspended or banned user. |
| PUT | `/users/:id/points` | JWT + `ADMIN` | Adjust a user's points balance. |
| GET | `/users/:id` | `@Public()` | Get a public user profile with badges and stats. |

---

### Admin

All routes in this section require `JwtAuthGuard` + `RolesGuard` + `@Roles(ADMIN)`.

| Method | Route | Description |
|---|---|---|
| GET | `/admin/dashboard` | Platform-wide admin dashboard statistics. |
| GET | `/admin/exams` | List all exams with optional `page`, `limit`, `visibility` filters. |
| GET | `/admin/generation-jobs` | List all AI generation jobs with optional `page`, `limit`, `status` filters. |
| GET | `/admin/domains` | List domains with stats; filter by `certificationId`, `page`, `limit`. |
| POST | `/admin/domains` | Create a domain for a certification. |
| PUT | `/admin/domains/:id` | Update a domain. |
| DELETE | `/admin/domains/:id` | Delete a domain (only if no questions are assigned). |
| PUT | `/admin/domains/reorder` | Reorder domains within a certification. |
| PATCH | `/admin/exams/:id/visibility` | Update exam visibility (`PUBLIC`, `PRIVATE`, `LINK`). |
| GET | `/admin/source-materials` | List all source materials. |
| DELETE | `/admin/source-materials/:id` | Delete a source material. |
| GET | `/admin/badges` | List all badges with award counts. |
| POST | `/admin/badges` | Create a badge. |
| PUT | `/admin/badges/:id` | Update a badge. |
| DELETE | `/admin/badges/:id` | Delete a badge. |
| POST | `/admin/badges/:id/award` | Manually award a badge to a user. |
| DELETE | `/admin/badges/:id/awards/:userId` | Revoke a badge from a user. |
| POST | `/admin/questions/bulk-status` | Bulk approve or reject questions by ID list. |
| POST | `/admin/users/bulk-role` | Bulk update user roles. |
| PATCH | `/admin/users/:userId/plan` | Change a user's subscription plan. |
| GET | `/admin/organizations` | List all organizations; filter by `page`, `limit`, `search`. |
| GET | `/admin/organizations/:orgId` | Get organization detail. |
| PATCH | `/admin/organizations/:orgId` | Update an organization. |
| DELETE | `/admin/organizations/:orgId` | Delete an organization. |
| GET | `/admin/organizations/:orgId/members` | List members of an organization. |
| PATCH | `/admin/organizations/:orgId/members/:userId` | Change a member's org role. |
| DELETE | `/admin/organizations/:orgId/members/:userId` | Remove a member from an organization. |
| GET | `/admin/export/users` | Export all users as CSV. |
| GET | `/admin/export/questions` | Export all questions as CSV. |
| GET | `/admin/export/analytics` | Export exam analytics as CSV. |
| GET | `/admin/review-queue` | List questions pending review; filter: `flagged`, `new`, `ambiguous`. |
| POST | `/admin/review-queue/:questionId/accept` | Accept a question (sets status to `APPROVED`). |
| POST | `/admin/review-queue/:questionId/reject` | Reject a question (requires `reason` ≥ 10 chars). |
| GET | `/admin/review-queue/:questionId/history` | Get moderation audit history for a question. |
| GET | `/admin/audit-logs` | List audit log entries; filter by `action`, `targetType`, `userId`, `page`, `limit`. |

---

### Content Catalog

#### Providers

| Method | Route | Guard / Auth | Description |
|---|---|---|---|
| GET | `/providers` | `@Public()` | List active providers; `?includeInactive=true` for all. |
| GET | `/providers/:id` | `@Public()` | Get a provider by ID. |
| POST | `/providers` | JWT + `ADMIN` | Create a provider. |
| PUT | `/providers/:id` | JWT + `ADMIN` | Update a provider. |
| DELETE | `/providers/:id` | JWT + `ADMIN` | Soft-delete a provider. |

#### Certifications

| Method | Route | Guard / Auth | Description |
|---|---|---|---|
| GET | `/certifications` | `@Public()` | List active certifications; `?includeInactive=true` for all. |
| GET | `/certifications/:id` | `@Public()` | Get a certification by ID. |
| POST | `/certifications` | JWT + `ADMIN` | Create a certification. |
| PUT | `/certifications/:id` | JWT + `ADMIN` | Update a certification. |
| DELETE | `/certifications/:id` | JWT + `ADMIN` | Soft-delete a certification. |

#### Tags

| Method | Route | Guard / Auth | Description |
|---|---|---|---|
| GET | `/tags` | `@Public()` | List tags; optional `?certificationId` filter. |
| POST | `/tags` | JWT + `ADMIN` | Create a tag. |
| PUT | `/tags/:id` | JWT + `ADMIN` | Update a tag name. |
| DELETE | `/tags/:id` | JWT + `ADMIN` | Delete a tag. |
| POST | `/tags/merge` | JWT + `ADMIN` | Merge source tags into a target tag. |

---

### Questions

| Method | Route | Guard / Auth | Description |
|---|---|---|---|
| GET | `/questions` | `@Public()` | Paginated question list; filter by `certificationId`, `status`, `isTrapQuestion`. |
| GET | `/questions/stats` | `@Public()` | APPROVED question counts by difficulty and domain for a certification (throttled 30 req/min). |
| GET | `/questions/queue/pending` | JWT + `REVIEWER` or `ADMIN` | Questions awaiting review. |
| GET | `/questions/admin/all` | JWT + `ADMIN` | Admin list with full filters (`certificationId`, `status`, `search`, `includeDeleted`). |
| GET | `/questions/:id` | `@Public()` | Get a single question by ID. |
| POST | `/questions` | JWT + `CONTRIBUTOR`, `REVIEWER`, or `ADMIN` | Create a question (draft status by default). |
| POST | `/questions/:id/vote` | JWT | Vote on a question; `?value=1`, `-1`, or `0` to clear. |
| PUT | `/questions/:id/status` | JWT + `CONTRIBUTOR`, `REVIEWER`, or `ADMIN` | Transition question status (`DRAFT`→`PENDING`, approve/reject). |
| PUT | `/questions/:id/admin` | JWT + `ADMIN` | Admin full edit of a question. |
| DELETE | `/questions/:id` | JWT | Soft-delete a question (author or admin). |

#### Question Comments

| Method | Route | Guard / Auth | Description |
|---|---|---|---|
| GET | `/questions/:questionId/comments` | `@Public()` | Get threaded comments for a question. |
| POST | `/questions/:questionId/comments` | JWT | Add a comment; supports replies via `parentId`. |
| PUT | `/comments/:id` | JWT | Edit own comment. |
| DELETE | `/comments/:id` | JWT | Delete own comment (or admin). |

#### Question Reports

| Method | Route | Guard / Auth | Description |
|---|---|---|---|
| POST | `/questions/:questionId/report` | JWT | Report a question. |
| GET | `/reports` | JWT + `ADMIN` | List reports; filter by `status`. |
| PUT | `/reports/:id` | JWT + `ADMIN` | Resolve or dismiss a report. |

---

### Exams and Attempts

#### Exams

| Method | Route | Guard / Auth | Description |
|---|---|---|---|
| GET | `/exams` | `@Public()` | List public exams; filter by `certificationId`; sort by `latest` or `popular`. |
| GET | `/exams/me` | JWT | List the authenticated user's own exams. |
| GET | `/exams/share/:shareCode` | `@Public()` | Get exam by share code (throttled 10 req/min). |
| GET | `/exams/:id` | `@Public()` | Get exam by ID. |
| POST | `/exams` | JWT | Create a new exam. |
| PUT | `/exams/:id` | JWT | Update an exam (owner only). |
| DELETE | `/exams/:id` | JWT | Delete an exam (owner or admin). |

#### Exam Day Planner

| Method | Route | Guard / Auth | Description |
|---|---|---|---|
| POST | `/exams/exam-day/schedule` | JWT | Schedule an exam date for an exam the user owns or is attempting. |
| GET | `/exams/exam-day/checklist/:examId` | JWT | Get a standard pre-exam-day checklist for an exam. |
| GET | `/exams/exam-day/upcoming` | JWT | List exams scheduled within the next 7 days. |

#### Attempts

| Method | Route | Guard / Auth | Description |
|---|---|---|---|
| POST | `/exams/:examId/start` | JWT | Start an exam attempt; returns questions without correct answers (throttled 5 req/min). |
| POST | `/attempts/:id/answer` | JWT | Save or update a single answer during an attempt. |
| POST | `/attempts/:id/submit` | JWT | Submit an attempt; calculates score and returns results. |
| POST | `/attempts/:id/finish` | JWT | Finish an attempt using already-saved answers. |
| GET | `/attempts/:id` | JWT | Get attempt result with question review data. |
| GET | `/attempts/me` | JWT | List the current user's exam attempts. |

#### Attempt Events (Telemetry)

| Method | Route | Guard / Auth | Description |
|---|---|---|---|
| POST | `/events/attempt` | JWT | Ingest a batch of attempt telemetry events (max 50 per call). |

---

### Training and Spaced Repetition

#### Training (SRS on exam questions)

| Method | Route | Guard / Auth | Description |
|---|---|---|---|
| POST | `/training/weakness/start` | JWT | Start a weakness-targeted training session. |
| POST | `/training/review` | JWT | Submit a spaced repetition review quality score (SM-2). |
| GET | `/training/due-reviews` | JWT | Get questions due for SRS review; filter by `certificationId`, `limit`. |

#### Coach (AI Study Coach)

Tier-gated: free tier is blocked (403); Pro allows 10 sessions/day; Elite is unlimited.

| Method | Route | Guard / Auth | Description |
|---|---|---|---|
| GET | `/training/coach/session/:userId` | JWT | Get or create a coach session for a user. |
| GET | `/training/coach/session-count` | JWT | Get the caller's coach session count for today. |
| POST | `/training/coach/session/:sessionId/message` | JWT | Send a message to the coach; response is streamed via Server-Sent Events. |
| GET | `/training/coach/analytics` | JWT | Get aggregated analytics for all caller's coach sessions. |
| GET | `/training/coach/session/:sessionId/analysis` | JWT | Get effectiveness analysis for a single coach session. |

#### Burnout Detection

| Method | Route | Guard / Auth | Description |
|---|---|---|---|
| GET | `/training/burnout/current` | JWT | Get unacknowledged burnout signals from the last 24 hours. |
| GET | `/training/burnout/history` | JWT | Get last 10 burnout signal records for the caller. |
| POST | `/training/burnout/:signalId/acknowledge` | JWT | Acknowledge a burnout signal. |
| POST | `/training/burnout/check-now` | JWT | Trigger an immediate burnout check for the caller. |

#### Flashcards (Custom Decks + SRS)

| Method | Route | Guard / Auth | Description |
|---|---|---|---|
| POST | `/decks` | JWT | Create a flashcard deck. |
| GET | `/decks` | JWT | List all decks for the caller. |
| GET | `/decks/:id` | JWT | Get deck details. |
| PUT | `/decks/:id` | JWT | Update a deck. |
| DELETE | `/decks/:id` | JWT | Delete a deck. |
| POST | `/flashcards` | JWT | Create a flashcard. |
| GET | `/flashcards/:id` | JWT | Get a flashcard. |
| PUT | `/flashcards/:id` | JWT | Update a flashcard. |
| DELETE | `/flashcards/:id` | JWT | Delete a flashcard. |
| POST | `/flashcards/:id/star` | JWT | Toggle the star/bookmark on a flashcard. |
| POST | `/flashcards/:id/review` | JWT | Submit an SRS review for a custom flashcard. |
| GET | `/flashcards/srs/due` | JWT | Get custom flashcards due for SRS review; optional `?deckId`. |
| GET | `/flashcards/srs/stats` | JWT | Get aggregate SRS stats for the caller's flashcards. |

#### Capture (Word Highlight During Exam)

| Method | Route | Guard / Auth | Description |
|---|---|---|---|
| POST | `/capture` | JWT | Capture a highlighted word or phrase from an exam. |
| GET | `/capture` | JWT | List pending captures for the caller. |
| PUT | `/capture/:id/status` | JWT | Set capture status to `processed` or `discarded`. |
| DELETE | `/capture/:id` | JWT | Delete a capture. |

---

### Analytics and Insights

#### Personal Analytics

| Method | Route | Guard / Auth | Description |
|---|---|---|---|
| GET | `/analytics/me/summary` | JWT | Aggregate stats for the caller; optional `?certificationId`. |
| GET | `/analytics/me/history` | JWT | Exam attempt history with scores; filter by `certificationId`, `page`, `limit`. |
| GET | `/analytics/me/hesitation` | JWT | Questions where the caller takes more than twice the per-question time budget. |
| GET | `/analytics/me/domains` | JWT | Per-domain performance across all attempts; optional `?certificationId`. |
| GET | `/analytics/me/weak-topics` | JWT | Weakest domains/topics; optional `?certificationId`, `?topN`. |
| GET | `/analytics/readiness/:certificationId` | JWT | Readiness score for a specific certification. |
| GET | `/analytics/mistake-patterns` | JWT | Mistake-type aggregation; optional `?certificationId`. |
| PATCH | `/analytics/answers/:answerId/mistake-type` | JWT | Update the mistake type tag on a specific answer. |
| GET | `/analytics/platform/stats` | `@Public()` | Platform-wide totals (questions, certifications, users). |
| GET | `/analytics/questions/:id/stats` | `@Public()` | Per-question attempt count and correct rate. |

#### Benchmark

| Method | Route | Guard / Auth | Description |
|---|---|---|---|
| GET | `/analytics/benchmark` | JWT | Caller's percentile rank vs cohort for a certification; requires `?certificationId`. Cohort stats hidden when cohort < 10 users (k-anonymity). |
| GET | `/analytics/benchmark/all` | JWT | Benchmarks for every certification the caller has a score in. |

#### Mastery

| Method | Route | Guard / Auth | Description |
|---|---|---|---|
| GET | `/mastery/:certificationId` | JWT | Per-domain mastery data for the caller. Returns `isEmpty: true` when fewer than 10 attempts exist. |

#### Insights and Readiness

| Method | Route | Guard / Auth | Description |
|---|---|---|---|
| GET | `/insights/next-topic` | JWT | Adaptive next-topic suggestion based on domain weakness; requires `?certificationId`. |
| GET | `/readiness/:certificationId` | JWT | Readiness score for a certification. Returns `{ score: null, reason: "not_enough_attempts" }` if insufficient data. |

#### Surveys

| Method | Route | Guard / Auth | Description |
|---|---|---|---|
| POST | `/surveys/pass-likelihood` | JWT | Submit a pass-likelihood self-report (1–10) for predictor validation. |
| GET | `/surveys/pass-likelihood` | JWT | Check whether the caller has already responded for a certification; requires `?certificationId`. |

---

### Organizations

#### Organization Management

| Method | Route | Guard / Auth | Description |
|---|---|---|---|
| POST | `/organizations` | JWT | Create an organization (caller becomes OWNER). |
| GET | `/organizations/my` | JWT | List organizations the caller belongs to. |
| POST | `/organizations/accept-invite/:token` | JWT | Accept an email invitation. |
| GET | `/organizations/join/:code` | JWT | Join an organization via a join link code. |
| GET | `/organizations/:orgId` | JWT + `OrgRoleGuard` (any role) | Get organization details. |
| PATCH | `/organizations/:orgId` | JWT + `OrgRoleGuard` `OWNER` or `ADMIN` | Update organization settings. |
| DELETE | `/organizations/:orgId` | JWT + `OrgRoleGuard` `OWNER` | Delete the organization. |
| GET | `/organizations/:orgId/members` | JWT + `OrgRoleGuard` (any role) | List organization members (paginated). |
| POST | `/organizations/:orgId/members/invite` | JWT + `OrgRoleGuard` `OWNER` or `ADMIN` | Invite a member by email. |
| POST | `/organizations/:orgId/members/bulk-invite` | JWT + `OrgRoleGuard` `OWNER` or `ADMIN` | Bulk invite members. |
| PATCH | `/organizations/:orgId/members/:userId` | JWT + `OrgRoleGuard` `OWNER` or `ADMIN` | Change a member's org role. |
| DELETE | `/organizations/:orgId/members/:userId` | JWT + `OrgRoleGuard` `OWNER` or `ADMIN` | Remove a member. |
| POST | `/organizations/:orgId/join-links` | JWT + `OrgRoleGuard` `OWNER` or `ADMIN` | Generate a join link. |
| GET | `/organizations/:orgId/groups` | JWT + `OrgRoleGuard` (any role) | List groups. |
| POST | `/organizations/:orgId/groups` | JWT + `OrgRoleGuard` `OWNER`, `ADMIN`, or `MANAGER` | Create a group. |
| PATCH | `/organizations/:orgId/groups/:groupId` | JWT + `OrgRoleGuard` `OWNER`, `ADMIN`, or `MANAGER` | Update a group. |
| DELETE | `/organizations/:orgId/groups/:groupId` | JWT + `OrgRoleGuard` `OWNER`, `ADMIN`, or `MANAGER` | Delete a group. |
| GET | `/organizations/:orgId/invites` | JWT + `OrgRoleGuard` (any role) | List pending member invites. |
| PATCH | `/organizations/:orgId/invites/:inviteId` | JWT + `OrgRoleGuard` `OWNER` or `ADMIN` | Update an invite. |
| DELETE | `/organizations/:orgId/invites/:inviteId` | JWT + `OrgRoleGuard` `OWNER` or `ADMIN` | Cancel an invite. |

#### Org Question Bank

| Method | Route | Guard / Auth | Description |
|---|---|---|---|
| GET | `/organizations/:orgId/questions` | JWT + `OrgRoleGuard` (any role) | List org questions (paginated, filtered). |
| GET | `/organizations/:orgId/questions/:questionId` | JWT + `OrgRoleGuard` (any role) | Get a single org question. |
| POST | `/organizations/:orgId/questions` | JWT + `OrgRoleGuard` (any role) | Create an org question (DRAFT status). |
| PATCH | `/organizations/:orgId/questions/:questionId` | JWT + `OrgRoleGuard` (any role) | Update a DRAFT or REJECTED org question. |
| DELETE | `/organizations/:orgId/questions/:questionId` | JWT + `OrgRoleGuard` (any role) | Delete an org question. |
| POST | `/organizations/:orgId/questions/:questionId/submit` | JWT + `OrgRoleGuard` (any role) | Submit question for review (DRAFT → UNDER_REVIEW). |
| POST | `/organizations/:orgId/questions/:questionId/approve` | JWT + `OrgRoleGuard` `OWNER` or `ADMIN` | Approve question (UNDER_REVIEW → APPROVED). |
| POST | `/organizations/:orgId/questions/:questionId/reject` | JWT + `OrgRoleGuard` `OWNER` or `ADMIN` | Reject question (UNDER_REVIEW → REJECTED). |
| POST | `/organizations/:orgId/questions/clone/:sourceQuestionId` | JWT + `OrgRoleGuard` (any role) | Clone a public question into the org bank. |

#### Org Analytics

| Method | Route | Guard / Auth | Description |
|---|---|---|---|
| GET | `/organizations/:orgId/analytics/overview` | JWT + `OrgRoleGuard` `OWNER`, `ADMIN`, or `MANAGER` | Team overview KPIs. |
| GET | `/organizations/:orgId/analytics/readiness` | JWT + `OrgRoleGuard` `OWNER`, `ADMIN`, or `MANAGER` | Per-certification readiness across the team. |
| GET | `/organizations/:orgId/analytics/skill-gaps` | JWT + `OrgRoleGuard` `OWNER`, `ADMIN`, or `MANAGER` | Domain-level weakness analysis. |
| GET | `/organizations/:orgId/analytics/progress` | JWT + `OrgRoleGuard` `OWNER`, `ADMIN`, or `MANAGER` | Week-over-week progress trends; optional `?weeks` (1–52). |
| GET | `/organizations/:orgId/analytics/engagement` | JWT + `OrgRoleGuard` `OWNER`, `ADMIN`, or `MANAGER` | Engagement metrics. |
| GET | `/organizations/:orgId/analytics/member/:userId` | JWT + `OrgRoleGuard` `OWNER`, `ADMIN`, or `MANAGER` | Deep-dive analytics for an individual member. |
| GET | `/organizations/:orgId/analytics/competency-profile` | JWT + `OrgRoleGuard` `OWNER`, `ADMIN`, or `MANAGER` | Competency profile for the org or a specific member; optional `?memberId`, `?jobRoleId`. |
| GET | `/organizations/:orgId/analytics/competency-heatmap` | JWT + `OrgRoleGuard` `OWNER`, `ADMIN`, or `MANAGER` | Competency heatmap (all members × all competencies). |

#### Competency Framework

| Method | Route | Guard / Auth | Description |
|---|---|---|---|
| GET | `/organizations/:orgId/competencies` | JWT + `OrgRoleGuard` (any role) | List competencies. |
| POST | `/organizations/:orgId/competencies` | JWT + `OrgRoleGuard` `OWNER`, `ADMIN`, or `MANAGER` | Create a competency. |
| GET | `/organizations/:orgId/competencies/:id` | JWT + `OrgRoleGuard` (any role) | Get a competency. |
| PATCH | `/organizations/:orgId/competencies/:id` | JWT + `OrgRoleGuard` `OWNER`, `ADMIN`, or `MANAGER` | Update a competency. |
| PATCH | `/organizations/:orgId/competencies/:id/toggle-active` | JWT + `OrgRoleGuard` `OWNER`, `ADMIN`, or `MANAGER` | Toggle the `isActive` flag. |
| DELETE | `/organizations/:orgId/competencies/:id` | JWT + `OrgRoleGuard` `OWNER`, `ADMIN`, or `MANAGER` | Delete a competency. |
| GET | `/organizations/:orgId/competencies/:id/questions` | JWT + `OrgRoleGuard` (any role) | List questions linked to a competency. |
| POST | `/organizations/:orgId/competencies/:id/questions` | JWT + `OrgRoleGuard` `OWNER`, `ADMIN`, or `MANAGER` | Link a question to a competency. |
| DELETE | `/organizations/:orgId/competencies/:id/questions/:questionId` | JWT + `OrgRoleGuard` `OWNER`, `ADMIN`, or `MANAGER` | Unlink a question from a competency. |
| GET | `/organizations/:orgId/competencies/:id/domains` | JWT + `OrgRoleGuard` (any role) | List domain mappings for a competency. |
| POST | `/organizations/:orgId/competencies/:id/domains` | JWT + `OrgRoleGuard` `OWNER`, `ADMIN`, or `MANAGER` | Add a domain mapping. |
| DELETE | `/organizations/:orgId/competencies/:id/domains/:domainId` | JWT + `OrgRoleGuard` `OWNER`, `ADMIN`, or `MANAGER` | Remove a domain mapping. |

#### Job Roles

| Method | Route | Guard / Auth | Description |
|---|---|---|---|
| GET | `/organizations/:orgId/job-roles` | JWT + `OrgRoleGuard` (any role) | List job roles. |
| POST | `/organizations/:orgId/job-roles` | JWT + `OrgRoleGuard` `OWNER`, `ADMIN`, `MANAGER`, or `RECRUITER` | Create a job role. |
| PATCH | `/organizations/:orgId/job-roles/:roleId` | JWT + `OrgRoleGuard` `OWNER`, `ADMIN`, `MANAGER`, or `RECRUITER` | Update a job role. |
| DELETE | `/organizations/:orgId/job-roles/:roleId` | JWT + `OrgRoleGuard` `OWNER` or `ADMIN` | Delete a job role. |
| GET | `/organizations/:orgId/job-roles/:roleId/competencies` | JWT + `OrgRoleGuard` (any role) | List competency requirements for a job role. |
| PUT | `/organizations/:orgId/job-roles/:roleId/competencies` | JWT + `OrgRoleGuard` `OWNER`, `ADMIN`, or `MANAGER` | Set (replace) competency requirements for a job role. |

#### Assessments (Recruiter/Pre-hire)

| Method | Route | Guard / Auth | Description |
|---|---|---|---|
| GET | `/organizations/:orgId/assessments` | JWT + `OrgRoleGuard` `OWNER`, `ADMIN`, `MANAGER`, or `RECRUITER` | List assessments (paginated). |
| GET | `/organizations/:orgId/assessments/pool-count` | JWT + `OrgRoleGuard` `OWNER`, `ADMIN`, `MANAGER`, or `RECRUITER` | Preview available question count for a pool filter. |
| POST | `/organizations/:orgId/assessments` | JWT + `OrgRoleGuard` `OWNER`, `ADMIN`, `MANAGER`, or `RECRUITER` | Create an assessment. |
| GET | `/organizations/:orgId/assessments/:aid` | JWT + `OrgRoleGuard` `OWNER`, `ADMIN`, `MANAGER`, or `RECRUITER` | Get assessment detail. |
| PATCH | `/organizations/:orgId/assessments/:aid` | JWT + `OrgRoleGuard` `OWNER`, `ADMIN`, `MANAGER`, or `RECRUITER` | Update an assessment. |
| PATCH | `/organizations/:orgId/assessments/:aid/status` | JWT + `OrgRoleGuard` `OWNER` or `ADMIN` | Update assessment status. |
| POST | `/organizations/:orgId/assessments/:aid/invite` | JWT + `OrgRoleGuard` `OWNER`, `ADMIN`, `MANAGER`, or `RECRUITER` | Invite candidates to an assessment. |
| POST | `/organizations/:orgId/assessments/:aid/candidates/bulk-csv` | JWT + `OrgRoleGuard` `OWNER`, `ADMIN`, `MANAGER`, or `RECRUITER` | Bulk-invite candidates from CSV. |
| GET | `/organizations/:orgId/assessments/:aid/results` | JWT + `OrgRoleGuard` `OWNER`, `ADMIN`, `MANAGER`, or `RECRUITER` | Get candidate results; optional `?filter`. |
| GET | `/organizations/:orgId/assessments/:aid/results/export` | JWT + `OrgRoleGuard` `OWNER` or `ADMIN` | Export candidate results as CSV. |
| PATCH | `/organizations/:orgId/assessments/:aid/candidates/:inviteId` | JWT + `OrgRoleGuard` `OWNER`, `ADMIN`, `MANAGER`, or `RECRUITER` | Update hire/no-hire decision for a candidate. |
| GET | `/organizations/:orgId/assessments/:aid/candidates/:inviteId/events` | JWT + `OrgRoleGuard` `OWNER`, `ADMIN`, `MANAGER`, or `RECRUITER` | Get proctoring events for a candidate. |
| DELETE | `/organizations/:orgId/assessments/:aid` | JWT + `OrgRoleGuard` `OWNER` or `ADMIN` | Delete an assessment. |

#### Candidate Assessment (Public-facing exam portal)

| Method | Route | Guard / Auth | Description |
|---|---|---|---|
| GET | `/assessments/take/:token` | `@Public()` | Load an assessment by invite token. |
| POST | `/assessments/take/:token/otp/request` | `@Public()` | Request OTP for identity verification (rate-limited: 5 req / 10 min). |
| POST | `/assessments/take/:token/otp/verify` | `@Public()` | Verify OTP (rate-limited: 10 req / 10 min). |
| POST | `/assessments/take/:token/start` | `@Public()` | Start an assessment attempt. |
| POST | `/assessments/take/:token/submit` | `@Public()` | Submit assessment answers. |
| POST | `/assessments/take/:token/event` | `@Public()` | Report a proctoring event (tab switch, focus loss, etc.). |

#### Exam Catalog

| Method | Route | Guard / Auth | Description |
|---|---|---|---|
| GET | `/organizations/:orgId/catalog` | JWT + `OrgRoleGuard` (any role) | Member view: active, in-window catalog items. |
| GET | `/organizations/:orgId/catalog/manage` | JWT + `OrgRoleGuard` `OWNER`, `ADMIN`, or `MANAGER` | Admin view: all catalog items. |
| POST | `/organizations/:orgId/catalog` | JWT + `OrgRoleGuard` `OWNER`, `ADMIN`, or `MANAGER` | Create a catalog item. |
| GET | `/organizations/:orgId/catalog/:cid` | JWT + `OrgRoleGuard` (any role) | Get a catalog item. |
| PATCH | `/organizations/:orgId/catalog/:cid` | JWT + `OrgRoleGuard` `OWNER`, `ADMIN`, or `MANAGER` | Update a catalog item. |
| DELETE | `/organizations/:orgId/catalog/:cid` | JWT + `OrgRoleGuard` `OWNER` or `ADMIN` | Delete a catalog item. |
| POST | `/organizations/:orgId/catalog/:cid/assign` | JWT + `OrgRoleGuard` `OWNER`, `ADMIN`, or `MANAGER` | Assign an exam to a catalog item. |
| POST | `/organizations/:orgId/catalog/:cid/start` | JWT + `OrgRoleGuard` (any role) | Start an attempt from a catalog item. |
| GET | `/organizations/:orgId/tracks` | JWT + `OrgRoleGuard` (any role) | List learning tracks. |
| POST | `/organizations/:orgId/tracks` | JWT + `OrgRoleGuard` `OWNER`, `ADMIN`, or `MANAGER` | Create a learning track. |
| PATCH | `/organizations/:orgId/tracks/:tid` | JWT + `OrgRoleGuard` `OWNER`, `ADMIN`, or `MANAGER` | Update a learning track. |
| DELETE | `/organizations/:orgId/tracks/:tid` | JWT + `OrgRoleGuard` `OWNER` or `ADMIN` | Delete a learning track. |
| GET | `/organizations/:orgId/my-assignments` | JWT + `OrgRoleGuard` (any role) | List the caller's assigned catalog items. |

---

### Social and Community

#### Gamification

| Method | Route | Guard / Auth | Description |
|---|---|---|---|
| GET | `/leaderboard` | `@Public()` | Global points leaderboard or per-certification best-score board; optional `?certificationId`, `?limit`. |
| GET | `/badges` | `@Public()` | List all available badges. |
| GET | `/users/:userId/badges` | `@Public()` | Get a user's earned badges. |
| GET | `/me/points` | JWT | Get the caller's current point total. |

#### Squads

| Method | Route | Guard / Auth | Description |
|---|---|---|---|
| POST | `/squads` | JWT | Create a squad. |
| POST | `/squads/:id/invites` | JWT + `OrgRoleGuard` `OWNER` or `ADMIN` | Generate an invite link for a squad. |
| POST | `/squads/join/:token` | JWT | Join a squad via invite token. |

#### Peer Review (within Squads)

| Method | Route | Guard / Auth | Description |
|---|---|---|---|
| POST | `/squads/peer-review/explanations` | JWT | Submit or update an explanation for a question within a squad. |
| GET | `/squads/peer-review/explanations` | JWT | List explanations for a question in a squad; requires `?questionId` and `?squadId`. |
| GET | `/squads/peer-review/explanations/top` | JWT | List top community-endorsed explanations across all squads; requires `?questionId`. |
| POST | `/squads/peer-review/explanations/:explanationId/vote` | JWT | Upvote a peer explanation. |
| GET | `/squads/peer-review/:squadId/reputation/leaderboard` | JWT | Reputation leaderboard for a squad; optional `?limit`. |
| GET | `/squads/peer-review/:squadId/flags` | JWT | List flagged explanations for a squad; optional `?status=pending`. |
| PATCH | `/squads/peer-review/flags/:flagId/resolve` | JWT | Resolve a flag (`cleared` or `confirmed`). |

#### Scenarios

| Method | Route | Guard / Auth | Description |
|---|---|---|---|
| GET | `/scenarios/:id` | JWT | Get a scenario with its questions. |
| POST | `/scenarios/:id/attempts` | JWT | Submit a scenario attempt. |
| GET | `/scenarios/:id/leaderboard` | JWT | Get leaderboard for a scenario (top 50 by score). |
| GET | `/scenarios/user/progress` | JWT | Get the caller's scenario progress. |

---

### AI Question Bank

#### LLM Configuration and Generation

| Method | Route | Guard / Auth | Description |
|---|---|---|---|
| GET | `/ai-questions/config` | JWT | List configured LLM providers (API keys masked). |
| POST | `/ai-questions/config` | JWT | Save or update an LLM provider API key. |
| DELETE | `/ai-questions/config/:provider` | JWT | Remove an LLM provider configuration. |
| POST | `/ai-questions/config/:provider/validate` | JWT | Test if an API key is valid for a provider. |
| GET | `/ai-questions/materials` | JWT | List uploaded study materials; optional `?certificationId`. |
| POST | `/ai-questions/materials` | JWT | Upload a text or URL study material. |
| POST | `/ai-questions/materials/file` | JWT | Upload a file material (PDF, DOCX, PPTX, XLSX) via multipart. |
| POST | `/ai-questions/materials/pdf` | JWT | **Deprecated** — use `/materials/file` instead. |
| GET | `/ai-questions/materials/:id` | JWT | Get material details. |
| GET | `/ai-questions/materials/:id/chunks` | JWT | Return ordered text chunks for a material. |
| DELETE | `/ai-questions/materials/:id` | JWT | Delete a study material. |
| POST | `/ai-questions/estimate` | JWT | Estimate token usage for a generation request. |
| POST | `/ai-questions/generate` | JWT | Generate questions from source material (returns preview, not saved). Throttled: 10 req/hour. |
| POST | `/ai-questions/save` | JWT | Save selected generated questions to the question bank. |
| GET | `/ai-questions/jobs/:jobId` | JWT | Poll generation job status and results. |
| GET | `/ai-questions/history` | JWT | Paginated generation job history. |
| POST | `/ai-questions/mcp/intake` | JWT | MCP mode: receive questions pushed from external AI tools (Claude Desktop, etc.). |

#### LLM Usage Metrics

| Method | Route | Guard / Auth | Description |
|---|---|---|---|
| GET | `/ai-question-bank/llm-usage/metrics` | JWT | Token and cost usage metrics for the caller's organization; optional `?days` (default 30). |

#### Dynamic Distractor System (DDS)

| Method | Route | Guard / Auth | Description |
|---|---|---|---|
| POST | `/ai-question-bank/dds/questions/:questionId/propose` | JWT | Propose a distractor variant for a question. |
| GET | `/ai-question-bank/dds/pending` | JWT | List pending variants; optional `?limit`. |
| GET | `/ai-question-bank/dds/questions/:questionId` | JWT | List all variants for a question. |
| PATCH | `/ai-question-bank/dds/variants/:variantId/approve` | JWT | Approve a variant. |
| PATCH | `/ai-question-bank/dds/variants/:variantId/reject` | JWT | Reject a variant. |
| PATCH | `/ai-question-bank/dds/variants/:variantId/rollback` | JWT | Roll back an approved variant. |
| POST | `/ai-question-bank/dds/variants/:variantId/auto-apply` | JWT + `REVIEWER` or `ADMIN` | Trigger auto-apply for a variant (rate-limited: 5 req/min). |
| GET | `/ai-question-bank/dds/variants/:variantId/auto-apply/evaluate` | JWT | Evaluate whether a variant meets auto-apply criteria. |
| GET | `/ai-question-bank/dds/auto-apply/readiness` | JWT | Gate 2 dashboard: clean approvals vs. threshold, rollback count, readiness flag. |
| GET | `/ai-question-bank/dds/auto-apply/cohort-config` | JWT | Get cohort configuration; optional `?cohort`. |
| POST | `/ai-question-bank/dds/auto-apply/promote` | JWT + `ADMIN` | Promote a DDS cohort to live mode. |

---

### Knowledge Graph

| Method | Route | Guard / Auth | Description |
|---|---|---|---|
| GET | `/knowledge-graph/overlap` | JWT | Get the domain overlap graph for a certification; requires `?certId`. |
| POST | `/knowledge-graph/overlap/:certId/compute` | JWT | Enqueue async overlap computation job; returns `jobId` immediately (202 Accepted). |
| GET | `/knowledge-graph/drill-down` | JWT | Domain drill-down for a certification; requires `?certId`, optional `?domainId`. |
| POST | `/knowledge-graph/study-plan` | JWT | Generate and persist a study plan for a target certification; requires `?targetCertId`. |
| GET | `/knowledge-graph/study-plans` | JWT | List saved study plans for the caller. |
| POST | `/knowledge-graph/study-plans/:planId/schedule` | JWT | Generate SRS `ReviewSchedule` entries from must-learn topics in a plan. |

---

### Other / Miscellaneous

#### Email Digest Preference

| Method | Route | Guard / Auth | Description |
|---|---|---|---|
| PATCH | `/user/digest/preference` | JWT | Enable or disable the weekly email digest for the caller; body: `{ enabled: boolean }`. |

#### Background Jobs (Internal / Test)

| Method | Route | Guard / Auth | Description |
|---|---|---|---|
| POST | `/jobs/test/email` | None (no guard declared) | Trigger a test welcome email via BullMQ queue. **Internal use only.** |

#### Health Check

| Method | Route | Guard / Auth | Description |
|---|---|---|---|
| GET | `/health` | `@Public()` | Returns `{ status: "ok" }`. Used by load balancers and uptime monitors. |

---

## 4. Authentication Flow Summary

```
POST /api/v1/auth/login  →  { accessToken, refreshToken }
POST /api/v1/auth/oauth/:provider  →  { accessToken, refreshToken }

Authorization: Bearer <accessToken>   (on all protected routes)

POST /api/v1/auth/refresh  →  { accessToken, refreshToken }  (when accessToken expires)
```

The frontend Axios interceptor (`src/services/api.ts`) handles the token lifecycle automatically: it attaches the `Authorization` header from the Zustand auth store, catches `401` responses, calls `/auth/refresh`, and retries the original request. On refresh failure it calls `logout()`.
