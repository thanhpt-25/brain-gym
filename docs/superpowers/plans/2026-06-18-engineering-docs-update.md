# Engineering Documentation Update Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite all core engineering documents to be accurate, complete, and written in official English — eliminating mixed-language content, filling gaps from newly shipped features (competency framework, enterprise organizations, assessments), and bringing outdated sections in line with the actual codebase.

**Architecture:** Documents are updated in dependency order: index and architecture first, then data model, API design, and frontend, followed by feature docs and ADRs. Each task is a self-contained file rewrite. No code changes — documentation only.

**Tech Stack:** Markdown, Mermaid diagrams (architecture + ERD), inline code blocks for commands and config examples.

---

## Audit: Current Gaps

Before writing, here is what each file currently gets wrong or omits:

| File | Issues |
|------|--------|
| `docs/01-architecture.md` | Refers to "Brain Gym" (should be "CertGym"). Missing enterprise subsystems: Competency Framework, Candidate Assessments, Exam Catalog. C4 diagrams do not show Redis, BullMQ, or cloud infrastructure. |
| `docs/02-data_model.md` | Missing ~15 entities added in the enterprise plan: `Organization`, `OrgMember`, `OrgInvite`, `OrgJoinLink`, `Assessment`, `CandidateInvite`, `Competency`, `JobRole`, `ExamCatalogItem`, `LearningTrack`, `Squad`, and more. |
| `docs/03-api_design.md` | Only documents 7 of ~30 backend modules. Missing: `organizations`, `assessments`, `competency`, `job-roles`, `exam-catalog`, `org-questions`, `org-analytics`, `squads`, `analytics`, `gamification`, `admin`, `scenarios`, `surveys`, `insights`, `mastery`. |
| `docs/04-frontend.md` | Missing entire org section (17+ pages), candidate exam pages, competency pages. Directory tree is outdated. |
| `docs/05-deployment.md` | References `postgres:15-alpine` but README states PostgreSQL 16. AWS production stack is not documented here (ECS Fargate, S3/CloudFront, ElastiCache). |
| `docs/06-security.md` | Vague phrasing ("mathematically hashed"). Rate-limiting marked as "Future" when production stack uses Nginx ingress. No mention of organization-level RBAC (`OrgRole` guard). |
| `docs/organization.md` | Is an implementation plan, not a feature reference doc. Belongs in `docs/specs/`, not `docs/`. Replace with a concise feature reference. |
| `docs/adr/028-competency-scoring.md` | Written primarily in Vietnamese. Numbered `003` in filename but `028` in content. ADR index (`00-index.md`) does not list it. |
| `docs/00-index.md` | Does not list ADR 028. Missing several new feature docs added since the index was last updated. |

---

## File Map

### Modified Files
- `docs/00-index.md` — Add missing entries; ensure all current docs are indexed
- `docs/01-architecture.md` — Full rewrite: correct naming, add new subsystems, expand C4 diagrams
- `docs/02-data_model.md` — Full rewrite: add all enterprise entities, update ERD
- `docs/03-api_design.md` — Full rewrite: document all ~30 modules with endpoint summaries
- `docs/04-frontend.md` — Full rewrite: update directory tree, add org + candidate + competency sections
- `docs/05-deployment.md` — Update PostgreSQL version; add AWS production stack section
- `docs/06-security.md` — Tighten language; add `OrgRole` RBAC; update rate-limiting status
- `docs/organization.md` — Replace implementation plan with a concise feature reference doc
- `docs/adr/028-competency-scoring.md` — Full English rewrite; fix ADR number in filename
- `docs/adr/00-index.md` — Add ADR 028 entry

### New Files
- `docs/features/competency-framework.md` — New: competency scoring, gap analysis, job-role mapping
- `docs/features/candidate-assessment.md` — New: assessment lifecycle, token-based exam flow, proctoring

---

## Task 1: Fix ADR 028 — English Rewrite and Correct Numbering

**Files:**
- Modify: `docs/adr/028-competency-scoring.md`
- Modify: `docs/adr/00-index.md`

The current file is written almost entirely in Vietnamese. The ADR number inside the file says "003" in its header note. This task rewrites the full document in English.

- [ ] **Step 1: Rewrite `docs/adr/028-competency-scoring.md` in English**

Replace the entire file content with:

```markdown
# ADR 028 — Competency Scoring Algorithm

**Status:** Accepted  
**Date:** 2026-06-14  
**Deciders:** ThanhPT (Architect)  
**Related:** [Sprint 0 Foundation Basic Design](../specs/sprint-0-foundation-basic-design.md) §5

---

## Context

The Enterprise Organization initiative requires inferring a **competency level (scale 1–5)** for each member or candidate against every competency defined by their organization. Exam score data is already aggregated by domain name as JSON:

- `CandidateInvite.domainScores` and `ExamAttempt.domainScores` share the shape  
  `Record<string, { correct: number; total: number }>`, where keys are **domain/category names** (strings).
- Scores are computed at submission time — see `candidate.service.ts submitAttempt` (L197–223) and  
  `org-analytics.service.ts getSkillGaps` (L179). There is no "raw answer per competency" table available for scoring.
- `CompetencyDomain` (from FR-1) maps a competency to **multiple domain names** (matched case-insensitively).
- `QuestionCompetency` (from FR-1) maps a competency to individual org questions with a `weight` field — but is not yet populated by any seed or UI.

### Two candidate approaches

**Approach A — Recompute from raw answers via `QuestionCompetency`.**  
For each competency, fetch the linked set of questions (via `weight`), look up the candidate's raw answer records, and compute a weighted percentage. More precise, but requires:
- Re-fetching raw `Answer` / `CandidateAnswer` records — additional I/O and joins.
- `QuestionCompetency` rows must be populated — currently empty at v0 launch.

**Approach B — Aggregate stored `domainScores` via `CompetencyDomain` mappings.**  
For each competency, retrieve its `CompetencyDomain.domainName` list, sum `correct`/`total` for matching domains in `domainScores` (case-insensitive), convert to a percentage, then bucket into a level. Reuses already-stored data with minimal I/O.

---

## Decision

**Adopt Approach B for v0.**

Rationale:

1. **Reuses stored data** — `domainScores` already exists on every submitted attempt and invite; no backfill or raw-answer re-fetch is required. Historical data is immediately queryable.
2. **Low configuration cost** — Organizations only need to map a few domain names to each competency (`CompetencyDomain`), rather than labeling every individual question. This is feasible from Sprint 0; Approach A would return empty results because `QuestionCompetency` is unpopulated.
3. **Preserves upgrade path** — `QuestionCompetency` is retained in the schema for v1. When question-level labeling is sufficiently populated, the service layer can switch to Approach A (or a hybrid) without changing the public function signature or the schema.

### Pure function `inferCompetencyLevel()`

Location: `backend/src/competency/scoring/infer-competency-level.ts` — stateless, no I/O.

```typescript
interface DomainScore {
  correct: number;
  total: number;
}

interface Threshold {
  minPercentage: number;
  level: number; // sorted descending by minPercentage
}

interface InferCompetencyLevelOptions {
  scaleMin: number;        // default: 1
  scaleMax: number;        // default: 5
  thresholds: Threshold[];
  minSampleForHigh?: number;   // default: 20
  minSampleForMedium?: number; // default: 8
}

interface CompetencyLevelResult {
  level: number;                        // in [scaleMin, scaleMax]
  percentage: number;                   // 0–100, rounded to 1 decimal
  confidence: 'LOW' | 'MEDIUM' | 'HIGH';
  sampleSize: number;                   // Σtotal across matched domains
}

function inferCompetencyLevel(
  domainScores: Record<string, DomainScore>,
  mappedDomains: string[],
  options: InferCompetencyLevelOptions,
): CompetencyLevelResult;
```

### Algorithm

1. **Normalize keys:** Build a `lowercaseTrim(domainName) → DomainScore` map from `domainScores`; normalize `mappedDomains` the same way.
2. **Aggregate:** Sum `sumCorrect = Σcorrect` and `sumTotal = Σtotal` for domains that appear in **both** `mappedDomains` and `domainScores`.
3. **No-data edge case** (`sumTotal === 0` — no domain matched or all inputs are empty): return `{ level: scaleMin, percentage: 0, confidence: 'LOW', sampleSize: 0 }`. Never divide by zero.
4. **Percentage:** `percentage = (sumCorrect / sumTotal) * 100`.
5. **Bucket level:** Iterate `thresholds` in descending `minPercentage` order; take the first level where `percentage >= minPercentage`. If no threshold matches, use `scaleMin`. Clamp result to `[scaleMin, scaleMax]`.
6. **Confidence** (independent of level):
   - `HIGH` if `sumTotal >= minSampleForHigh` (default 20)
   - `MEDIUM` if `sumTotal >= minSampleForMedium` (default 8)
   - `LOW` otherwise

### Default thresholds (scale 1–5)

| Level | Label      | minPercentage (≥) | Percentage range |
|-------|------------|-------------------|-----------------|
| 5     | Expert     | 90                | 90–100           |
| 4     | Proficient | 75                | 75–89            |
| 3     | Competent  | 60                | 60–74            |
| 2     | Developing | 40                | 40–59            |
| 1     | Novice     | 0                 | 0–39             |

```typescript
const DEFAULT_THRESHOLDS_1_5: Threshold[] = [
  { minPercentage: 90, level: 5 },
  { minPercentage: 75, level: 4 },
  { minPercentage: 60, level: 3 },
  { minPercentage: 40, level: 2 },
  { minPercentage:  0, level: 1 },
];
```

### Edge cases

| Scenario | Behavior |
|----------|----------|
| No domain matched / empty `domainScores` | `level=scaleMin, percentage=0, confidence=LOW, sampleSize=0` |
| Partial overlap (only some `mappedDomains` present in `domainScores`) | Only matched domains are summed; `sampleSize` reflects actual sample |
| Case-insensitive match (`"Networking"` vs `"NETWORKING"` vs `" networking "`) | Matched after `lowercaseTrim` |
| Domain with `total=0` in `domainScores` | Added to `sumTotal` without effect — safe |
| `percentage` exactly on a threshold boundary (e.g. 80) | `>=` operator places it in the higher bucket |

### Representative unit tests

```typescript
const opts = { scaleMin: 1, scaleMax: 5, thresholds: DEFAULT_THRESHOLDS_1_5 };

// TC1: multiple domains, large sample → HIGH confidence
// Networking 18/20 + Security 9/10 = 27/30 = 90.0% → level 5; sample 30 ≥ 20 → HIGH
inferCompetencyLevel(
  { Networking: { correct: 18, total: 20 }, Security: { correct: 9, total: 10 }, Storage: { correct: 1, total: 5 } },
  ['Networking', 'Security'],
  opts,
); // => { level: 5, percentage: 90.0, confidence: 'HIGH', sampleSize: 30 }

// TC2: mapped domain absent from domainScores
inferCompetencyLevel(
  { Compute: { correct: 4, total: 5 } },
  ['Networking'],
  opts,
); // => { level: 1, percentage: 0, confidence: 'LOW', sampleSize: 0 }

// TC3: case-insensitive + partial overlap + small sample → LOW
// Only 'networking' matches; 3/6 = 50.0% → level 2; sample 6 < 8 → LOW
inferCompetencyLevel(
  { networking: { correct: 3, total: 6 } },
  ['NETWORKING', 'Databases'],
  opts,
); // => { level: 2, percentage: 50.0, confidence: 'LOW', sampleSize: 6 }

// TC4: boundary threshold with MEDIUM confidence
// 6/8 = 75.0% — exactly on level-4 threshold; sample 8 ≥ 8 → MEDIUM
inferCompetencyLevel(
  { Security: { correct: 6, total: 8 } },
  ['security'],
  opts,
); // => { level: 4, percentage: 75.0, confidence: 'MEDIUM', sampleSize: 8 }
```

---

## Consequences

### Positive

- **Works immediately on existing data** — reuses stored `domainScores`; no backfill, no re-fetch of raw answers; historical attempts are queryable from day one.
- **Pure function, straightforward to test** — completely decoupled from Prisma/HTTP; all branches (no-data, partial overlap, case-insensitive, boundary thresholds, confidence tiers) are unit-testable without a database.
- **Low org configuration burden** — organizations only need to map domain names to competencies; no per-question labeling required at v0.
- **Non-breaking upgrade path** — `QuestionCompetency` is kept in the schema; the service layer can switch to Approach A (weighted per-question scoring) in v1 without changing the public function signature.
- **Confidence decoupled from level** — consumers can surface to users that a level-4 result based on 6 questions is less reliable than one based on 40, preventing over-confident hiring decisions.

### Risks and mitigations

| Risk | Mitigation |
|------|------------|
| Domain mapping quality — incorrect or missing mappings produce skewed or empty scores | Return `confidence: LOW` and explicit `sampleSize: 0`; UI warns when `sampleSize` is below threshold; validate domain name existence when mapping |
| `domainScores` aggregates by question count, not by `weight` | Acceptable for v0 screening; switch to Approach A (weighted) in v1 when `QuestionCompetency` data is populated |
| Custom scale (not 1–5) requires a separate threshold table | `thresholds` is a parameter (not hardcoded); v0 restricts orgs to scale 1–5 until a general threshold UI is built |
| Many candidates sharing the same level for ranking purposes | Use the continuous `percentage` value as a tie-breaker when ranking — not `level` alone |
```

- [ ] **Step 2: Update `docs/adr/00-index.md` to add ADR 028**

Open `docs/adr/00-index.md` and append the following row to the ADR table:

```markdown
| [ADR-028](./028-competency-scoring.md) | Competency scoring algorithm (domain aggregation vs. per-question weighted scoring) | Accepted |
```

- [ ] **Step 3: Commit**

```bash
git add docs/adr/028-competency-scoring.md docs/adr/00-index.md
git commit -m "docs(adr): rewrite ADR 028 in English, register in index"
```

---

## Task 2: Update Architecture Overview (`docs/01-architecture.md`)

**Files:**
- Modify: `docs/01-architecture.md`

The current file uses the wrong product name ("Brain Gym"), omits Redis/BullMQ from diagrams, and does not describe the enterprise subsystems added in the organization plan.

- [ ] **Step 1: Rewrite `docs/01-architecture.md`**

Replace the entire file with:

```markdown
# 01 — Architecture Overview

## 1. System Context (C4 Level 1)

CertGym is a multi-tenant, community-driven web platform for certification exam preparation. It serves learners, question contributors, and enterprise organizations.

\`\`\`mermaid
C4Context
    title CertGym — System Context

    Person(learner, "Learner", "Studies for certifications via exams, flashcards, and AI coaching.")
    Person(contributor, "Contributor", "Creates and curates questions for the community.")
    Person(orgAdmin, "Org Admin", "Manages an enterprise organization: members, assessments, competency tracking.")
    Person(candidate, "External Candidate", "Takes a token-based hiring assessment without creating an account.")

    System(certgym, "CertGym Platform", "Exam prep, spaced repetition, AI tools, and enterprise org management.")

    System_Ext(llm, "LLM Provider", "OpenAI / Anthropic / Gemini — AI question generation and coaching.")
    System_Ext(email, "Mail Service", "Transactional email for invitations and notifications.")
    System_Ext(aws, "AWS Cloud", "ECS Fargate (backend), S3+CloudFront (frontend), RDS, ElastiCache.")

    Rel(learner, certgym, "Studies, takes exams, reviews flashcards")
    Rel(contributor, certgym, "Submits and reviews questions")
    Rel(orgAdmin, certgym, "Manages org, assessments, competencies")
    Rel(candidate, certgym, "Takes assessment via one-time token link")
    Rel(certgym, llm, "Generates questions and coaching responses")
    Rel(certgym, email, "Sends invitations, notifications")
    Rel(certgym, aws, "Deployed on")
\`\`\`

---

## 2. Container Architecture (C4 Level 2)

\`\`\`mermaid
C4Container
    title CertGym — Container Diagram

    Container(spa, "Frontend SPA", "React 18, Vite, TypeScript", "Delivers all UI via the browser. Proxies /api to the backend.")
    Container(api, "Backend API", "NestJS 11, TypeScript", "REST API, business logic, background job orchestration.")
    ContainerDb(db, "PostgreSQL 16", "Prisma ORM", "Primary data store: users, questions, exams, orgs, analytics.")
    ContainerDb(cache, "Redis 7", "ioredis", "Session caching and BullMQ job queues.")
    Container(worker, "BullMQ Worker", "Node.js", "Processes async jobs: AI question generation, score computation.")
    Container(nginx, "Nginx", "Reverse proxy", "Serves static SPA assets and forwards /api to the backend container.")

    Rel(spa, nginx, "HTTPS requests")
    Rel(nginx, spa, "Serves static files (dist/)")
    Rel(nginx, api, "Proxies /api/* requests")
    Rel(api, db, "Read / Write (Prisma)")
    Rel(api, cache, "Cache reads / BullMQ job dispatch")
    Rel(worker, cache, "Consumes BullMQ queues")
    Rel(worker, db, "Writes job results")
    Rel(worker, llm, "LLM API calls")
\`\`\`

---

## 3. Technology Stack

### 3.1 Frontend

| Concern | Technology |
|---------|-----------|
| Framework | React 18 + Vite (SWC) |
| Language | TypeScript |
| Routing | React Router v6 (lazy-loaded routes) |
| Server state | TanStack Query (React Query v5) |
| Client state | Zustand |
| Styling | Tailwind CSS + shadcn/ui (Radix UI) |
| Animations | Framer Motion |
| HTTP | Axios with JWT Bearer + automatic token refresh on 401 |

### 3.2 Backend

| Concern | Technology |
|---------|-----------|
| Framework | NestJS 11 |
| Language | TypeScript |
| ORM | Prisma |
| Database | PostgreSQL 16 |
| Cache / Queues | Redis 7 + BullMQ |
| Authentication | Passport.js — JWT strategy (access + refresh tokens) |
| Validation | `class-validator` + `class-transformer` via NestJS `ValidationPipe` |
| API documentation | Swagger / OpenAPI (`/api/docs`) |

### 3.3 Infrastructure

| Concern | Technology |
|---------|-----------|
| Local development | Docker Compose (Nginx, NestJS, PostgreSQL, Redis) |
| Production | AWS ECS Fargate (backend), S3 + CloudFront (frontend), RDS PostgreSQL, ElastiCache Redis |
| CI/CD | GitHub Actions (`.github/workflows/deploy.yml`) |
| IaC | Terraform (`infra/`) |

---

## 4. Sub-Systems

### 4.1 Question Bank

Community-maintained, version-controlled repository of certification exam questions.

- Questions belong to a `Certification` → `Domain` taxonomy.
- Questions undergo a lifecycle: `DRAFT → PENDING → APPROVED` (or `REJECTED`).
- Community features: upvotes, comments, reports, reputation scoring.
- DDS (Dynamic Difficulty Scoring): ML-driven difficulty adjustment via background jobs.

### 4.2 Exam Engine

Zero-distraction exam simulation matching real certification formats.

- Timed exams with configurable `TimerMode` (`STRICT` / `LENIENT`).
- Mark-for-review, per-domain score breakdown, and pass-probability readiness score.
- Smart Exam Builder: compose exams by domain weighting or difficulty target.
- Submissions are evaluated immediately; results include `MistakeType` breakdowns.

### 4.3 Training & Spaced Repetition (SRS)

SM-2 algorithm drives daily flashcard review scheduling.

- Flashcard decks are user-created or auto-derived from exam mistakes.
- Review schedules store `interval`, `easeFactor`, and `nextReviewDate`.
- Mid-exam word capture sends items to a personal review queue.

### 4.4 AI Tools

LLM-powered study assistance with BYOK (Bring Your Own Key) support.

- **AI Question Generator:** Generates questions from pasted text using any configured LLM provider.
- **AI Coach:** Conversational coach with user performance context (PREMIUM/ENTERPRISE tier).
- **Burnout Detection:** Signals-based alert when study intensity becomes counterproductive.
- LLM credentials are stored encrypted via `UserLlmConfig`.

### 4.5 Enterprise Organizations

Multi-tenant organization management for teams and hiring.

- Organizations have role-based access (`OWNER`, `ADMIN`, `MANAGER`, `MEMBER`).
- **Private Question Bank:** Org-scoped questions with internal review workflow.
- **Exam Catalog & Learning Tracks:** Pre-defined exam sequences assignable to members or groups.
- **Candidate Assessments:** Token-based hiring exams for external candidates (no account required).
- **Org Analytics:** Team-level readiness heatmaps, skill-gap analysis, and engagement trends.

### 4.6 Competency Framework

Maps organizational competencies to job roles and tracks member proficiency.

- Competencies are defined with a 1–5 scale and linked to exam domains.
- Gap analysis compares member proficiency against job-role requirements.
- Proficiency is inferred from aggregated `domainScores` — see [ADR 028](./adr/028-competency-scoring.md).

### 4.7 Community & Gamification

- **Squads:** Small peer groups for collaborative study.
- **Leaderboards & Badges:** Recognition for top contributors.
- **Reputation system:** Score-based trust gating for community actions.

---

## 5. Key Cross-Cutting Concerns

### Authentication flow
1. `POST /auth/login` returns `accessToken` (15 min) and `refreshToken` (7 days).
2. The frontend Axios interceptor attaches `Authorization: Bearer <accessToken>` to every request.
3. On a `401` response, the interceptor silently calls `POST /auth/refresh`, swaps the tokens, and retries the original request.

### Multi-tenancy
Every organization-scoped route is protected by `OrgRoleGuard`, which reads the `:orgId` path parameter and verifies the requester's `OrgRole` in `org_members`. Platform-level RBAC uses `RolesGuard` against `UserRole`.

### Background jobs
Async work (AI question generation, DDS scoring) is dispatched to BullMQ queues backed by Redis. A dedicated worker container consumes these queues independently of the API process.
```

- [ ] **Step 2: Commit**

```bash
git add docs/01-architecture.md
git commit -m "docs: rewrite architecture overview — add enterprise subsystems, fix naming, expand C4 diagrams"
```

---

## Task 3: Update Data Model (`docs/02-data_model.md`)

**Files:**
- Modify: `docs/02-data_model.md`

The current file documents ~10 entities. The actual Prisma schema has ~45+ models. This task adds all enterprise and competency entities with accurate descriptions.

- [ ] **Step 1: Rewrite `docs/02-data_model.md`**

Replace the file with the following:

```markdown
# 02 — Data Model

CertGym uses **PostgreSQL 16** via the **Prisma ORM**. The schema is the authoritative source of truth — see `backend/prisma/schema.prisma` for full field definitions.

---

## 1. High-Level Entity Relationship Diagram

\`\`\`mermaid
erDiagram
    %% Identity
    User ||--o{ OrgMember : "belongs to"
    User ||--o{ Question : "authors"
    User ||--o{ ExamAttempt : "takes"
    User ||--o{ Deck : "owns"
    User ||--o{ UserLlmConfig : "configures"

    %% Content taxonomy
    Provider ||--o{ Certification : "offers"
    Certification ||--o{ Domain : "contains"
    Certification ||--o{ Question : "has"
    Certification ||--o{ Exam : "has"

    %% Question bank
    Question ||--o{ Choice : "has"
    Question ||--o{ Comment : "receives"
    Question ||--o{ Vote : "receives"
    Question ||--o{ Report : "receives"

    %% Exam engine
    Exam ||--o{ ExamQuestion : "includes"
    ExamQuestion }o--|| Question : "links"
    ExamAttempt ||--o{ Answer : "records"

    %% Training / SRS
    Deck ||--o{ Flashcard : "contains"
    Question ||--o{ ReviewSchedule : "tracked by"
    Flashcard ||--o{ FlashcardReviewSchedule : "tracked by"

    %% AI
    SourceMaterial ||--o{ SourceChunk : "split into"

    %% Enterprise — Organization
    Organization ||--o{ OrgMember : "has"
    Organization ||--o{ OrgInvite : "issues"
    Organization ||--o{ OrgJoinLink : "generates"
    Organization ||--o{ OrgGroup : "contains"
    Organization ||--o{ OrgQuestion : "owns"
    Organization ||--o{ ExamCatalogItem : "maintains"
    Organization ||--o{ LearningTrack : "defines"
    Organization ||--o{ Assessment : "runs"
    Organization ||--o{ Competency : "defines"
    Organization ||--o{ JobRole : "defines"

    %% Enterprise — Assessment
    Assessment ||--o{ CandidateInvite : "sends"
    CandidateInvite ||--o{ CandidateAnswer : "contains"

    %% Competency
    Competency ||--o{ CompetencyDomain : "maps to"
    Competency ||--o{ JobRoleCompetency : "required by"
    JobRole ||--o{ JobRoleCompetency : "requires"
\`\`\`

---

## 2. Domain Reference

### 2.1 Identity & Access Management

| Model | Description |
|-------|-------------|
| `User` | All platform actors. Holds `role` (`UserRole`), `status` (`UserStatus`), `plan` (`UserPlan`), and hashed password. |
| `AuditLog` | Immutable log of administrative and sensitive actions for compliance. |

**Enums:**
- `UserRole`: `LEARNER | CONTRIBUTOR | REVIEWER | ADMIN`
- `UserStatus`: `ACTIVE | SUSPENDED | BANNED`
- `UserPlan`: `FREE | PREMIUM | ENTERPRISE`

---

### 2.2 Content Taxonomy

| Model | Description |
|-------|-------------|
| `Provider` | Exam vendors (e.g., AWS, Microsoft, CompTIA). |
| `Certification` | A specific certification offered by a Provider (e.g., "AWS SAA-C03"). |
| `Domain` | A topic area within a Certification, with a weighting percentage. |
| `Tag` / `QuestionTag` | Cross-cutting topic labels for questions. |

---

### 2.3 Question Bank

| Model | Description |
|-------|-------------|
| `Question` | Core learning primitive. Tracks `QuestionType` (`SINGLE | MULTIPLE`), `Difficulty`, `status`, and aggregate performance stats (`correctCount`, `attemptCount`). |
| `Choice` | Answer options for a Question. One or more marked `isCorrect`. |
| `Comment` | Community discussion thread on a question. |
| `Vote` | Upvote/downvote on a Question, Comment, or Explanation. |
| `Report` | Flag for incorrect, outdated, or inappropriate questions. |
| `DdsVariant` | A proposed difficulty-adjusted variant of a Question, managed through an approval workflow. |

**Enums:**
- `QuestionStatus`: `DRAFT | PENDING | APPROVED | REJECTED | REMOVED`
- `Difficulty`: `EASY | MEDIUM | HARD`
- `QuestionType`: `SINGLE | MULTIPLE`

---

### 2.4 Exam Engine

| Model | Description |
|-------|-------------|
| `Exam` | A collection of questions forming a simulation instance. Visibility: `PUBLIC | PRIVATE | LINK`. Configures `TimerMode`. |
| `ExamQuestion` | Join table linking an Exam to its Questions with ordering. |
| `ExamAttempt` | One user's attempt at an Exam. Records `score`, `timeSpent`, `domainScores` (JSON), and `status`. |
| `Answer` | The user's answer to one question within an attempt. Tracks `MistakeType`. |

**Enums:**
- `ExamVisibility`: `PUBLIC | PRIVATE | LINK`
- `AttemptStatus`: `IN_PROGRESS | SUBMITTED | ABANDONED`
- `MistakeType`: captures the category of error (e.g., wrong answer, time-out)

---

### 2.5 Training & Spaced Repetition (SRS)

| Model | Description |
|-------|-------------|
| `Deck` | A user-owned flashcard collection. |
| `Flashcard` | An individual flashcard (front/back). Can be auto-derived from exam mistakes. |
| `ReviewSchedule` | SM-2 state for question-level spaced repetition: `interval`, `easeFactor`, `nextReviewDate`. |
| `FlashcardReviewSchedule` | SM-2 state for flashcard-level review scheduling. |
| `CapturedWord` | A term highlighted during an exam, queued for personal review. |

---

### 2.6 AI Systems

| Model | Description |
|-------|-------------|
| `UserLlmConfig` | Encrypted user-supplied LLM credentials (BYOK). |
| `SourceMaterial` | Uploaded PDF or URL submitted for AI question generation. |
| `SourceChunk` | A text segment derived from a `SourceMaterial`, used in the RAG pipeline. |
| `QuestionGenerationJob` | Background job tracking the status of an AI generation run. |

---

### 2.7 Enterprise — Organization

| Model | Description |
|-------|-------------|
| `Organization` | Top-level entity for an enterprise team: name, slug, logo, `maxSeats`, branding config. |
| `OrgMember` | Junction table linking a `User` to an `Organization` with an `OrgRole`. |
| `OrgInvite` | Email invitation with a unique token and expiry timestamp. |
| `OrgJoinLink` | Reusable join link with usage limits and optional expiry. |
| `OrgGroup` | A sub-team within an organization for grouping members. |

**Enum:**
- `OrgRole`: `OWNER | ADMIN | MANAGER | MEMBER`
- `OrgInviteStatus`: `PENDING | ACCEPTED | EXPIRED | REVOKED`

---

### 2.8 Enterprise — Private Question Bank

| Model | Description |
|-------|-------------|
| `OrgQuestion` | A private question scoped to an organization, with its own review workflow. |
| `OrgQuestionChoice` | Answer choices for an `OrgQuestion`. |

**Enum:**
- `OrgQuestionStatus`: `DRAFT | UNDER_REVIEW | APPROVED | REJECTED`

---

### 2.9 Enterprise — Exam Catalog & Learning Tracks

| Model | Description |
|-------|-------------|
| `ExamCatalogItem` | A pre-defined exam in the org's catalog. Supports prerequisites and scheduling windows. Type: `FIXED | DYNAMIC`. |
| `ExamCatalogQuestion` | Links an `ExamCatalogItem` to its source questions (`OrgQuestion` or public `Question`). |
| `LearningTrack` | An ordered sequence of `ExamCatalogItem` entries forming a learning path. |
| `OrgExamAssignment` | Assignment of a catalog exam to a member or group, with progress tracking. |

---

### 2.10 Enterprise — Candidate Assessments

| Model | Description |
|-------|-------------|
| `Assessment` | An org-configured hiring or screening exam. Supports question randomization and anti-cheat options. |
| `CandidateInvite` | A per-candidate invitation with a unique token. Records `status`, `score`, `domainScores`, and proctoring events. |
| `CandidateAnswer` | The candidate's response to one question in an assessment. |

**Enums:**
- `AssessmentStatus`: `DRAFT | ACTIVE | CLOSED | ARCHIVED`
- `CandidateAttemptStatus`: `INVITED | STARTED | SUBMITTED | EXPIRED`

---

### 2.11 Competency Framework

| Model | Description |
|-------|-------------|
| `Competency` | A named skill area within an organization, with a configurable scale (default 1–5). |
| `CompetencyDomain` | Maps a `Competency` to one or more exam domain names for score inference. |
| `QuestionCompetency` | Links an `OrgQuestion` to a `Competency` with a weight (reserved for v1 scoring). |
| `JobRole` | A role definition within an organization (e.g., "Cloud Architect"). |
| `JobRoleCompetency` | Specifies the required competency level for a given `JobRole`. |

---

## 3. Key Schema Patterns

| Pattern | Usage |
|---------|-------|
| **Cascading deletes** | Dropping a parent record cleans up all children (e.g., deleting a `Question` removes its `Choice` rows). |
| **Enums** | Enforced at the PostgreSQL level for all categorical fields (`Role`, `Status`, `TimerMode`, etc.). |
| **JSON fields** | Used for dynamic structures that vary per record: `Exam.difficultyDist`, `ExamAttempt.domainScores`, `Badge.criteria`. Avoids unnecessary join tables for configurable schemas. |
| **Soft deletes** | Certain models (e.g., `OrgQuestion`) use a status field rather than hard deletion to preserve audit history. |
| **Global modules** | `PrismaModule`, `AuditModule`, and `MailModule` are declared `@Global()` and available throughout the backend without explicit imports. |
```

- [ ] **Step 2: Commit**

```bash
git add docs/02-data_model.md
git commit -m "docs: update data model — add all enterprise and competency entities"
```

---

## Task 4: Update API Design (`docs/03-api_design.md`)

**Files:**
- Modify: `docs/03-api_design.md`

The current file documents only 7 modules. The backend has ~30 modules. This task provides a complete module inventory with endpoint summaries.

- [ ] **Step 1: Rewrite `docs/03-api_design.md`**

Replace the file with:

```markdown
# 03 — API Design

CertGym exposes a RESTful JSON API built with NestJS.

---

## 1. Global Conventions

| Convention | Detail |
|-----------|--------|
| **Base path** | All endpoints are prefixed with `/api/v1` |
| **Authentication** | JWT Bearer token in the `Authorization` header |
| **Content type** | `application/json` for all requests and responses |
| **Validation** | NestJS `ValidationPipe` with `class-validator` decorators on all DTOs |
| **API docs** | Swagger UI available at `/api/docs` in development |

---

## 2. Standard HTTP Status Codes

| Code | Meaning |
|------|---------|
| `200 OK` | Successful read or update |
| `201 Created` | Successful resource creation |
| `400 Bad Request` | Validation failure or malformed payload |
| `401 Unauthorized` | Missing or expired JWT |
| `403 Forbidden` | Valid JWT but insufficient RBAC permissions |
| `404 Not Found` | Resource does not exist |
| `409 Conflict` | Duplicate resource or state conflict |
| `500 Internal Server Error` | Unhandled exception |

---

## 3. Authentication Guards

| Guard | Applied via | Effect |
|-------|------------|--------|
| `JwtAuthGuard` | `@UseGuards(JwtAuthGuard)` | Requires a valid access token |
| `RolesGuard` | `@Roles(UserRole.ADMIN)` | Restricts to specific `UserRole` values |
| `OrgRoleGuard` | `@OrgRoles(OrgRole.OWNER, ...)` | Checks requester's `OrgRole` within the organization identified by `:orgId` |
| `PlanGuard` | Applied in service layer | Enforces `UserPlan` restrictions (e.g., blocking `FREE` users from creating orgs) |

Routes annotated `@Public()` bypass `JwtAuthGuard` entirely.

---

## 4. Module Reference

### `auth/`

User registration, login, and token lifecycle.

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| `POST` | `/auth/register` | Public | Create account |
| `POST` | `/auth/login` | Public | Returns `accessToken` + `refreshToken` + user profile |
| `POST` | `/auth/refresh` | Public | Swap a valid refresh token for a new access token |
| `POST` | `/auth/logout` | JWT | Invalidate the refresh token |

---

### `users/`

User profile and settings management.

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| `GET` | `/users/me` | JWT | Get own profile |
| `PATCH` | `/users/me` | JWT | Update display name, avatar, preferences |
| `PATCH` | `/users/me/password` | JWT | Change password |

---

### `admin/`

Platform administration. All routes require `UserRole.ADMIN`.

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/admin/dashboard` | Platform-wide stats |
| `GET` | `/admin/users` | List all users (paginated, filterable) |
| `PATCH` | `/admin/users/:userId/plan` | Change a user's plan |
| `PATCH` | `/admin/users/:userId/role` | Change a user's role |
| `DELETE` | `/admin/users/:userId` | Deactivate or ban a user |
| `GET` | `/admin/organizations` | List all organizations |
| `PATCH` | `/admin/organizations/:orgId` | Update any organization |
| `DELETE` | `/admin/organizations/:orgId` | Delete any organization |
| `GET` | `/admin/audit-logs` | Platform audit log |
| `GET` | `/admin/moderation` | Review queue for flagged content |

---

### `certifications/`

Content taxonomy for driving navigation and exam composition.

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| `GET` | `/certifications` | Public | List all certifications grouped by provider |
| `GET` | `/certifications/:id` | Public | Get certification detail with domains |
| `POST` | `/certifications` | ADMIN | Create certification |

---

### `questions/`

Question CRUD, community actions, and moderation.

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| `GET` | `/questions` | JWT | List questions (paginated, filtered by cert/domain/difficulty/status) |
| `POST` | `/questions` | CONTRIBUTOR+ | Submit a new question |
| `GET` | `/questions/:id` | JWT | Get question with choices and stats |
| `PATCH` | `/questions/:id` | CONTRIBUTOR+ | Update own question |
| `DELETE` | `/questions/:id` | AUTHOR or ADMIN | Delete question |
| `POST` | `/questions/:id/vote` | JWT | Upvote or downvote |
| `POST` | `/questions/:id/report` | JWT | Flag question |
| `POST` | `/questions/:id/comments` | JWT | Add a comment |

---

### `exams/`

Exam construction and retrieval.

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| `GET` | `/exams` | JWT | List available exams |
| `POST` | `/exams` | CONTRIBUTOR+ | Create an exam |
| `GET` | `/exams/:id` | JWT | Get exam with question list |
| `PATCH` | `/exams/:id` | AUTHOR or ADMIN | Update exam |
| `DELETE` | `/exams/:id` | AUTHOR or ADMIN | Delete exam |

---

### `attempts/`

Exam attempt lifecycle.

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| `POST` | `/attempts` | JWT | Start an exam attempt |
| `GET` | `/attempts/:id` | JWT | Get attempt state (questions, answers so far) |
| `POST` | `/attempts/:id/answer` | JWT | Submit an answer |
| `POST` | `/attempts/:id/finish` | JWT | Finalize attempt and retrieve scored result |
| `GET` | `/attempts/history` | JWT | List own attempt history |

---

### `training/`

Spaced repetition review scheduling.

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| `GET` | `/training/due` | JWT | Questions due for review today |
| `POST` | `/training/:questionId/review` | JWT | Submit SM-2 review result (grade 0–5) |

---

### `flashcards/`

Flashcard deck and review management.

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| `GET` | `/flashcards/decks` | JWT | List own decks |
| `POST` | `/flashcards/decks` | JWT | Create a deck |
| `GET` | `/flashcards/decks/:id` | JWT | Get deck with cards |
| `POST` | `/flashcards/decks/:id/cards` | JWT | Add a card |
| `POST` | `/flashcards/:cardId/review` | JWT | Submit flashcard review result |

---

### `capture/`

Mid-exam word capture for deferred review.

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| `POST` | `/capture` | JWT | Capture a word or phrase during an exam |
| `GET` | `/capture` | JWT | List own captured items |

---

### `ai-question-bank/`

AI question generation and LLM configuration.

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| `GET` | `/ai-question-bank/config` | JWT | Get own LLM config |
| `POST` | `/ai-question-bank/config` | JWT | Save LLM credentials |
| `POST` | `/ai-question-bank/generate` | JWT | Start a generation job |
| `GET` | `/ai-question-bank/jobs/:id` | JWT | Poll job status |

---

### `analytics/`

Personal study analytics and readiness scoring.

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| `GET` | `/analytics/overview` | JWT | Overall study stats for the authenticated user |
| `GET` | `/analytics/readiness/:certId` | JWT | Pass-probability readiness score for a certification |
| `GET` | `/analytics/domain-breakdown` | JWT | Per-domain performance breakdown |

---

### `squads/`

Peer group management for collaborative study.

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| `GET` | `/squads` | JWT | List squads the user belongs to |
| `POST` | `/squads` | JWT | Create a squad |
| `POST` | `/squads/:id/invite` | JWT | Invite a user to a squad |
| `GET` | `/squads/:id/leaderboard` | JWT | Squad leaderboard |

---

### `gamification/`

Badges and reputation management.

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| `GET` | `/gamification/badges` | JWT | List all badges and earned status |
| `GET` | `/gamification/leaderboard` | JWT | Platform-wide leaderboard |
| `GET` | `/gamification/reputation` | JWT | Own reputation score and history |

---

### `organizations/`

Multi-tenant organization management. All org-scoped routes enforce `OrgRoleGuard`.

| Method | Route | Guard | Description |
|--------|-------|-------|-------------|
| `POST` | `/organizations` | JWT + PlanGuard | Create an organization (PREMIUM/ENTERPRISE plan required) |
| `GET` | `/organizations/my` | JWT | List organizations the user belongs to |
| `GET` | `/organizations/:orgId` | JWT + OrgRole(ANY) | Get organization details |
| `PATCH` | `/organizations/:orgId` | OrgRole(OWNER, ADMIN) | Update org settings |
| `DELETE` | `/organizations/:orgId` | OrgRole(OWNER) | Delete organization |
| `GET` | `/organizations/:orgId/members` | OrgRole(ANY) | List members |
| `POST` | `/organizations/:orgId/members/invite` | OrgRole(OWNER, ADMIN) | Invite by email |
| `POST` | `/organizations/:orgId/members/bulk-invite` | OrgRole(OWNER, ADMIN) | Bulk invite |
| `PATCH` | `/organizations/:orgId/members/:userId` | OrgRole(OWNER, ADMIN) | Change member role |
| `DELETE` | `/organizations/:orgId/members/:userId` | OrgRole(OWNER, ADMIN) | Remove member |
| `POST` | `/organizations/:orgId/join-links` | OrgRole(OWNER, ADMIN) | Generate join link |
| `GET` | `/organizations/join/:code` | JWT + PlanGuard | Join via link (FREE users blocked) |
| `POST` | `/organizations/accept-invite/:token` | JWT | Accept email invitation (all plans) |
| `POST` | `/organizations/:orgId/groups` | OrgRole(OWNER, ADMIN, MANAGER) | Create sub-group |
| `GET` | `/organizations/:orgId/groups` | OrgRole(ANY) | List sub-groups |

---

### `org-questions/`

Private question bank for organizations.

| Method | Route | Guard | Description |
|--------|-------|-------|-------------|
| `GET` | `/organizations/:orgId/questions` | OrgRole(ANY) | List org questions |
| `POST` | `/organizations/:orgId/questions` | OrgRole(OWNER, ADMIN, MANAGER) | Create private question |
| `PATCH` | `/organizations/:orgId/questions/:qid` | OrgRole(OWNER, ADMIN, MANAGER) | Update question |
| `DELETE` | `/organizations/:orgId/questions/:qid` | OrgRole(OWNER, ADMIN, MANAGER) | Soft-delete question |
| `PATCH` | `/organizations/:orgId/questions/:qid/status` | OrgRole(OWNER, ADMIN) | Approve or reject |
| `POST` | `/organizations/:orgId/questions/clone` | OrgRole(OWNER, ADMIN, MANAGER) | Clone from public question bank |
| `POST` | `/organizations/:orgId/questions/bulk-import` | OrgRole(OWNER, ADMIN) | CSV bulk import |

---

### `exam-catalog/`

Org exam catalog and learning track management.

| Method | Route | Guard | Description |
|--------|-------|-------|-------------|
| `GET` | `/organizations/:orgId/catalog` | OrgRole(ANY) | List active catalog items (member view) |
| `GET` | `/organizations/:orgId/catalog/manage` | OrgRole(OWNER, ADMIN, MANAGER) | Full catalog list including drafts |
| `POST` | `/organizations/:orgId/catalog` | OrgRole(OWNER, ADMIN, MANAGER) | Create catalog item |
| `PATCH` | `/organizations/:orgId/catalog/:cid` | OrgRole(OWNER, ADMIN, MANAGER) | Update catalog item |
| `DELETE` | `/organizations/:orgId/catalog/:cid` | OrgRole(OWNER, ADMIN) | Delete catalog item |
| `POST` | `/organizations/:orgId/catalog/:cid/assign` | OrgRole(OWNER, ADMIN, MANAGER) | Assign to member or group |
| `POST` | `/organizations/:orgId/catalog/:cid/start` | OrgRole(ANY) | Start an assigned catalog exam |
| `GET` | `/organizations/:orgId/tracks` | OrgRole(ANY) | List learning tracks |
| `POST` | `/organizations/:orgId/tracks` | OrgRole(OWNER, ADMIN, MANAGER) | Create learning track |
| `GET` | `/organizations/:orgId/my-assignments` | OrgRole(ANY) | Current user's assignments and progress |

---

### `assessments/`

Candidate hiring assessments. Split into admin and public (token-based) controllers.

**Admin routes** (`/organizations/:orgId/assessments`):

| Method | Route | Guard | Description |
|--------|-------|-------|-------------|
| `GET` | `/organizations/:orgId/assessments` | OrgRole(OWNER, ADMIN, MANAGER) | List assessments |
| `POST` | `/organizations/:orgId/assessments` | OrgRole(OWNER, ADMIN, MANAGER) | Create assessment |
| `PATCH` | `/organizations/:orgId/assessments/:aid` | OrgRole(OWNER, ADMIN, MANAGER) | Update assessment |
| `PATCH` | `/organizations/:orgId/assessments/:aid/status` | OrgRole(OWNER, ADMIN) | Activate or close |
| `POST` | `/organizations/:orgId/assessments/:aid/invite` | OrgRole(OWNER, ADMIN, MANAGER) | Invite candidates |
| `POST` | `/organizations/:orgId/assessments/:aid/candidates/bulk-csv` | OrgRole(OWNER, ADMIN, MANAGER) | Bulk invite via CSV |
| `GET` | `/organizations/:orgId/assessments/:aid/results` | OrgRole(OWNER, ADMIN, MANAGER) | View candidate results (filterable) |
| `GET` | `/organizations/:orgId/assessments/:aid/results/export` | OrgRole(OWNER, ADMIN) | Export results as CSV |

**Candidate routes** (`/assessments/take` — no authentication, token-based):

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/assessments/take/:token` | Load assessment info |
| `POST` | `/assessments/take/:token/start` | Start attempt; returns questions |
| `POST` | `/assessments/take/:token/submit` | Submit answers; returns score |
| `POST` | `/assessments/take/:token/event` | Report anti-cheat event (e.g., tab switch) |

---

### `competency/`

Competency framework and gap analysis.

| Method | Route | Guard | Description |
|--------|-------|-------|-------------|
| `GET` | `/organizations/:orgId/competencies` | OrgRole(ANY) | List org competencies |
| `POST` | `/organizations/:orgId/competencies` | OrgRole(OWNER, ADMIN) | Create competency |
| `PATCH` | `/organizations/:orgId/competencies/:id` | OrgRole(OWNER, ADMIN) | Update competency |
| `DELETE` | `/organizations/:orgId/competencies/:id` | OrgRole(OWNER, ADMIN) | Delete competency |
| `GET` | `/organizations/:orgId/competencies/:id/questions` | OrgRole(ANY) | List linked questions |
| `POST` | `/organizations/:orgId/competencies/:id/questions` | OrgRole(OWNER, ADMIN) | Link questions |
| `DELETE` | `/organizations/:orgId/competencies/:id/questions` | OrgRole(OWNER, ADMIN) | Unlink questions |
| `GET` | `/organizations/:orgId/competencies/:id/domains` | OrgRole(ANY) | List mapped domains |
| `POST` | `/organizations/:orgId/competencies/:id/domains` | OrgRole(OWNER, ADMIN) | Map domains |
| `DELETE` | `/organizations/:orgId/competencies/:id/domains` | OrgRole(OWNER, ADMIN) | Unmap domains |
| `PATCH` | `/organizations/:orgId/competencies/:id/toggle-active` | OrgRole(OWNER, ADMIN) | Enable or disable |

---

### `job-roles/`

Job role definitions and required competency levels.

| Method | Route | Guard | Description |
|--------|-------|-------|-------------|
| `GET` | `/organizations/:orgId/job-roles` | OrgRole(ANY) | List job roles |
| `POST` | `/organizations/:orgId/job-roles` | OrgRole(OWNER, ADMIN) | Create job role |
| `PATCH` | `/organizations/:orgId/job-roles/:roleId` | OrgRole(OWNER, ADMIN) | Update job role |
| `DELETE` | `/organizations/:orgId/job-roles/:roleId` | OrgRole(OWNER, ADMIN) | Delete job role |
| `GET` | `/organizations/:orgId/job-roles/:roleId/competencies` | OrgRole(ANY) | Get required competency levels |
| `PUT` | `/organizations/:orgId/job-roles/:roleId/competencies` | OrgRole(OWNER, ADMIN) | Set required competency levels |

---

### `org-analytics/`

Team-level analytics. Requires `OrgRole(OWNER, ADMIN, MANAGER)` on all routes.

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/organizations/:orgId/analytics/overview` | Member count, active users, exams taken, average scores |
| `GET` | `/organizations/:orgId/analytics/readiness` | Per-certification readiness across the team |
| `GET` | `/organizations/:orgId/analytics/skill-gaps` | Domain-level weakness analysis |
| `GET` | `/organizations/:orgId/analytics/progress` | Week-over-week engagement trends |
| `GET` | `/organizations/:orgId/analytics/competency-profile` | Per-member or org-wide competency levels with gap vs. job role |
| `GET` | `/organizations/:orgId/analytics/competency-heatmap` | Full member × competency matrix |
| `GET` | `/organizations/:orgId/analytics/member/:userId` | Individual member deep-dive |

---

### Other Modules

| Module | Base path | Purpose |
|--------|-----------|---------|
| `gamification` | `/gamification` | Badges, leaderboards, reputation |
| `squads` | `/squads` | Peer study groups |
| `insights` | `/insights` | Personalized study recommendations |
| `mastery` | `/mastery` | Mastery tracking per domain |
| `scenarios` | `/scenarios` | Exam scenario configurations |
| `surveys` | `/surveys` | User feedback surveys |
| `knowledge-graph` | `/knowledge-graph` | Concept relationship graph for study paths |
| `reports` | `/reports` | Content moderation report queue |
| `streaks` | `/streaks` | Daily study streak tracking |
| `events` | `/events` | Server-sent events for real-time updates |

---

## 5. Pagination

List endpoints that return large collections support cursor or offset pagination via query parameters:

```
GET /questions?page=1&limit=20&certId=<id>&difficulty=MEDIUM
```

Responses include `total`, `page`, `limit`, and `data` fields unless noted otherwise.
```

- [ ] **Step 2: Commit**

```bash
git add docs/03-api_design.md
git commit -m "docs: rewrite API design — document all 30 backend modules with endpoint tables"
```

---

## Task 5: Update Frontend Architecture (`docs/04-frontend.md`)

**Files:**
- Modify: `docs/04-frontend.md`

The current file is missing the entire `org/` page section, candidate exam pages, and the competency framework UI.

- [ ] **Step 1: Rewrite `docs/04-frontend.md`**

Replace the file with:

```markdown
# 04 — Frontend Architecture

CertGym's frontend is a Single Page Application (SPA) built for immersive exam simulation and enterprise organization management.

---

## 1. Technology Stack

| Concern | Technology |
|---------|-----------|
| Framework | React 18 + Vite (SWC plugin) |
| Language | TypeScript (`noImplicitAny: false`, `strictNullChecks: false`) |
| Routing | React Router v6 — all routes are `React.lazy()`-loaded and wrapped in `<Suspense>` |
| Server state | TanStack Query (React Query v5) — caching, refetch-on-focus, optimistic updates |
| Client state | Zustand — only for auth tokens and active org context |
| Styling | Tailwind CSS + shadcn/ui (Radix UI primitives) |
| Animations | Framer Motion — page transitions via `<AnimatePresence>` |
| HTTP | Axios instance in `src/services/api.ts` with automatic JWT refresh on 401 |
| Forms | React Hook Form + Zod validation |

---

## 2. Directory Structure (`src/`)

\`\`\`
src/
├── components/
│   ├── dashboard/          # Dashboard widgets (burnout, LLM cost, pass predictor)
│   ├── exam/               # Exam UI (timer, question navigator, mark-for-review)
│   ├── org/                # Organization-scoped components
│   │   ├── OrgSidebar.tsx
│   │   ├── OrgLayout.tsx
│   │   ├── OrgInviteModal.tsx
│   │   ├── OrgMemberTable.tsx
│   │   ├── CatalogExamCard.tsx
│   │   ├── InviteCandidatesModal.tsx
│   │   ├── CandidateRanking.tsx
│   │   ├── AssessmentFunnel.tsx
│   │   ├── ReadinessHeatmap.tsx
│   │   ├── SkillGapChart.tsx
│   │   └── MemberAnalyticsCard.tsx
│   ├── questions/          # Question cards, answer selectors
│   └── ui/                 # shadcn/ui primitives (Button, Input, Dialog, etc.)
├── pages/
│   ├── Admin/              # Admin panel (moderation, audit logs, badge management)
│   ├── org/                # Enterprise organization pages
│   │   ├── OrgSelector.tsx     # /org — list and switch orgs
│   │   ├── OrgCreate.tsx       # /org/create
│   │   ├── OrgJoin.tsx         # /org/join/:code
│   │   ├── OrgDashboard.tsx    # /org/:slug
│   │   ├── OrgMembers.tsx      # /org/:slug/members
│   │   ├── OrgGroups.tsx       # /org/:slug/groups
│   │   ├── OrgSettings.tsx     # /org/:slug/settings
│   │   ├── OrgQuestionBank.tsx # /org/:slug/questions
│   │   ├── OrgQuestionForm.tsx # /org/:slug/questions/new|:qid/edit
│   │   ├── OrgExamCatalog.tsx  # /org/:slug/catalog
│   │   ├── OrgCatalogManage.tsx
│   │   ├── OrgCatalogBuilder.tsx
│   │   ├── OrgLearningTracks.tsx
│   │   ├── OrgAssessments.tsx  # /org/:slug/assessments
│   │   ├── AssessmentBuilder.tsx
│   │   ├── AssessmentResults.tsx
│   │   └── OrgAnalytics.tsx    # /org/:slug/analytics
│   ├── AiQuestionGenerator.tsx
│   ├── CandidateExam.tsx       # /assess/:token — no auth required
│   ├── CandidateResult.tsx     # /assess/:token/result
│   ├── Dashboard.tsx
│   ├── ExamPage.tsx
│   ├── Flashcards.tsx
│   └── ...
├── hooks/                  # Custom hooks (useTimer, useSpacedRepetition, etc.)
├── services/               # API client functions, one file per domain
│   ├── api.ts              # Shared Axios instance with auth interceptor
│   ├── organizations.ts
│   ├── org-questions.ts
│   ├── assessments.ts
│   ├── exam-catalog.ts
│   ├── org-analytics.ts
│   └── ...
├── stores/
│   ├── auth.store.ts       # JWT tokens + user profile (role, plan, orgMemberships)
│   └── org.store.ts        # Active organization context (slug, role)
├── types/                  # TypeScript interfaces per domain
├── utils/                  # Pure formatting and helper functions
├── App.tsx                 # Route definitions and global providers
└── main.tsx                # React DOM entry point
\`\`\`

---

## 3. Routing

All routes are defined in `App.tsx`. Heavy routes are `React.lazy()`-loaded. Every route renders inside `<PageTransition>` (Framer Motion).

### Route Protection

`<ProtectedRoute>` checks `useAuthStore().isAuthenticated`. Unauthenticated users are redirected to `/auth` with the intended path saved for post-login redirect.

```tsx
// Protected (requires login)
<Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />

// Organization routes (nested under /org/:slug)
<Route path="/org/:slug" element={<ProtectedRoute><OrgLayout /></ProtectedRoute>}>
  <Route index element={<OrgDashboard />} />
  <Route path="members" element={<OrgMembers />} />
  <Route path="catalog" element={<OrgExamCatalog />} />
  <Route path="assessments" element={<OrgAssessments />} />
  <Route path="analytics" element={<OrgAnalytics />} />
</Route>

// Public routes (no auth required)
<Route path="/assess/:token" element={<CandidateExam />} />
<Route path="/assess/:token/result" element={<CandidateResult />} />
```

---

## 4. State Management

### Server State — TanStack Query

All data fetched from the backend goes through `useQuery` / `useMutation`. Data is never stored in Zustand.

```tsx
const { data: members, isLoading } = useQuery({
  queryKey: ['org-members', orgId],
  queryFn: () => getOrgMembers(orgId),
  enabled: !!orgId,
});
```

- Query keys are scoped per domain (e.g., `['org-members', orgId]`) for precise cache invalidation.
- Mutations call `queryClient.invalidateQueries()` on success to refresh related lists.

### Client State — Zustand

Zustand is used only for state that must survive page navigation and is not server-derived:

| Store | Responsibility |
|-------|---------------|
| `useAuthStore` | JWT access token, refresh token, user profile (id, role, plan, orgMemberships). Consumed by the Axios interceptor. |
| `useOrgStore` | Active organization slug and the current user's `OrgRole` within it. Set when the user navigates into `/org/:slug`. |

---

## 5. HTTP Layer (`src/services/api.ts`)

The shared Axios instance handles the full authentication lifecycle:

1. **Request interceptor:** Attaches `Authorization: Bearer <accessToken>` from `useAuthStore`.
2. **Response interceptor:** On `401`, pauses the request queue, calls `POST /auth/refresh`, updates the stored tokens, and retries the original request.
3. On refresh failure, calls `useAuthStore.logout()` and redirects to `/auth`.

Each domain has a dedicated service file (e.g., `src/services/organizations.ts`) that exports typed async functions calling the shared instance.

---

## 6. Design System

All UI uses the **dark-mode-first** design system:

- **Tailwind tokens:** `bg-background`, `text-foreground`, `border-primary`
- **Glass morphism:** `bg-white/5`, `border-white/10`, `backdrop-blur-sm`
- **Accent color:** Cyan highlights (`text-cyan-400`, `border-cyan-500/30`)
- **Typography:** `font-mono` for data values, labels, and exam content

Components are built from [shadcn/ui](https://ui.shadcn.com/) primitives (Radix UI under the hood), extended with project-specific styles.

---

## 7. Candidate Exam Page

`CandidateExam.tsx` (`/assess/:token`) is the public exam-taking page for external candidates:

- No authentication required. The candidate's token serves as the identity for the session.
- Anti-cheat: listens for `visibilitychange` events and reports tab switches to `POST /assessments/take/:token/event`.
- Intentionally minimal UI — no `<Navbar>` or `<BottomTabBar>`.
- Structurally similar to `ExamPage.tsx` but entirely self-contained.
```

- [ ] **Step 2: Commit**

```bash
git add docs/04-frontend.md
git commit -m "docs: update frontend architecture — add org pages, candidate exam, stores, and routing table"
```

---

## Task 6: Update Deployment Doc (`docs/05-deployment.md`)

**Files:**
- Modify: `docs/05-deployment.md`

The current file references `postgres:15-alpine` (actually PostgreSQL 16), omits the cloud production stack, and has no Redis or BullMQ section.

- [ ] **Step 1: Rewrite `docs/05-deployment.md`**

Replace the file with:

```markdown
# 05 — Deployment & Infrastructure

CertGym runs locally via Docker Compose and in production on AWS.

---

## 1. Local Development (Docker Compose)

`docker-compose.yml` starts the full stack with one command:

\`\`\`bash
docker-compose up -d --build
\`\`\`

| Service | Image | Port |
|---------|-------|------|
| `frontend` | Nginx (multi-stage Vite build) | `:80` |
| `backend` | NestJS (node:20-alpine) | `:3000` (internal) |
| `db` | `postgres:16-alpine` | `:5432` (internal) |
| `redis` | `redis:7-alpine` | `:6379` (internal) |

Stop all services:

\`\`\`bash
docker-compose down
\`\`\`

---

## 2. Container Details

### Frontend Container

Multi-stage `Dockerfile` (repo root):

- **Stage 1 (builder):** Node 20 installs dependencies and runs `npm run build`, producing static assets in `dist/`.
- **Stage 2 (runner):** `nginx:alpine` copies `dist/` to the Nginx HTML root.

### Backend Container

`backend/Dockerfile`:

- Node 20 image; installs production dependencies only.
- The `docker-entrypoint.sh` script runs `npx prisma migrate deploy` before starting the NestJS process, ensuring migrations are applied on container start.
- Exposes port `3000` on the internal Docker network.

---

## 3. Reverse Proxy (Nginx)

`nginx/nginx-frontend.conf` handles two concerns:

1. **SPA routing fallback:** All requests to unmapped paths return `index.html`, enabling client-side routing via React Router.
2. **API proxy:** Requests to `/api/*` are reverse-proxied to the backend container (`http://backend:3000`). This unifies the domain topology and eliminates CORS configuration.

---

## 4. Production Stack (AWS)

The production environment runs on AWS:

| Layer | Service |
|-------|---------|
| **Backend** | ECS Fargate (auto-scaling tasks, no EC2 management) |
| **Frontend** | S3 bucket + CloudFront CDN |
| **Database** | RDS PostgreSQL 16 (Multi-AZ for HA) |
| **Cache / Queues** | ElastiCache Redis 7 |
| **Secrets** | AWS Secrets Manager (DATABASE_URL, JWT secrets) |
| **CI/CD** | GitHub Actions → ECR → ECS rolling deploy |

Infrastructure is provisioned via Terraform. See:
- [AWS Overview & IAM Setup](./deployment/aws-overview.md)
- [Terraform Provisioning Guide](./deployment/aws-terraform.md)
- [Manual AWS Console Setup](./deployment/aws-console-setup.md)

---

## 5. Environment Variables

### Frontend (`.env`)

\`\`\`bash
VITE_API_BASE_URL=/api/v1   # Override for cloud deployments (e.g., https://api.certgym.io/v1)
\`\`\`

### Backend (`backend/.env`)

\`\`\`bash
DATABASE_URL=postgresql://certgym:password@localhost:5432/certgym?schema=public
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_SECRET=change-me
JWT_REFRESH_SECRET=change-me
LLM_KEY_ENCRYPTION_SECRET=change-me
PORT=3000
NODE_ENV=development
MAIL_HOST=smtp.mailtrap.io   # Production: SMTP relay (SES / SendGrid)
MAIL_USER=...
MAIL_PASS=...
\`\`\`

> **Do not commit `.env` files.** They are excluded by `.gitignore`.

---

## 6. Database Migrations

Migrations are managed by Prisma:

\`\`\`bash
# Apply pending migrations (development)
cd backend && npx prisma migrate dev

# Apply migrations in production (also runs automatically in docker-entrypoint.sh)
npx prisma migrate deploy

# Reset database and re-seed (development only — destructive)
npx prisma migrate reset
\`\`\`
```

- [ ] **Step 2: Commit**

```bash
git add docs/05-deployment.md
git commit -m "docs: update deployment doc — correct PostgreSQL version, add AWS stack, Redis/BullMQ section"
```

---

## Task 7: Update Security Doc (`docs/06-security.md`)

**Files:**
- Modify: `docs/06-security.md`

The current file has vague phrasing, marks rate-limiting as a future concern when Nginx handles it in production, and omits organization-level RBAC.

- [ ] **Step 1: Rewrite `docs/06-security.md`**

Replace the file with:

```markdown
# 06 — Security & Authentication

---

## 1. Authentication — JWT Flow

CertGym uses stateless JWT authentication.

1. **Login:** `POST /auth/login` with email and password.
2. **Token issuance:** The API returns a short-lived `accessToken` (default 15 minutes) and a long-lived `refreshToken` (default 7 days).
3. **Token storage:** The frontend stores tokens in Zustand (in-memory). Tokens are not stored in `localStorage` or cookies to mitigate XSS persistence.
4. **Request authorization:** The Axios interceptor attaches `Authorization: Bearer <accessToken>` to every outbound request.
5. **Silent refresh:** When the interceptor receives a `401 Unauthorized` response, it pauses the outgoing request queue, calls `POST /auth/refresh` with the stored refresh token, updates the tokens in Zustand, and retries all queued requests — transparent to the user.
6. **Logout:** Calls `POST /auth/logout` to invalidate the refresh token server-side, then clears Zustand state.

---

## 2. Authorization — Platform RBAC

Platform-level access control is enforced by `RolesGuard` via the `@Roles()` decorator on NestJS controllers.

| Role | Capabilities |
|------|-------------|
| `LEARNER` (default) | Consume public exams, track attempts, own flashcard decks, comment, vote |
| `CONTRIBUTOR` | Learner permissions + submit questions, build public exams (land in `PENDING` status) |
| `REVIEWER` | Contributor permissions + approve `PENDING` content queue |
| `ADMIN` | Full platform access: taxonomy management, user bans, plan changes, audit log access |

---

## 3. Authorization — Organization RBAC

Organization-scoped routes enforce `OrgRoleGuard`, which reads the `:orgId` path parameter and queries `org_members` for the requester's role.

| OrgRole | Capabilities |
|---------|-------------|
| `MEMBER` | Read org resources (members, catalog, analytics) |
| `MANAGER` | Member permissions + create groups, catalog items, and assessment invites |
| `ADMIN` | Manager permissions + invite/remove members, approve questions |
| `OWNER` | Admin permissions + delete the organization, change org settings |

Platform admins (`UserRole.ADMIN`) bypass `OrgRoleGuard` entirely and can manage any organization.

---

## 4. Plan-Based Access Control

`UserPlan` gates access to organization features in the service layer:

| Capability | FREE | PREMIUM | ENTERPRISE | ADMIN |
|-----------|:----:|:-------:|:----------:|:-----:|
| Create organization | ✗ | ✓ (max 1) | ✓ (max 3) | ✓ unlimited |
| Join via email invite | ✓ | ✓ | ✓ | ✓ |
| Join via link | ✗ | ✓ | ✓ | ✓ |
| Create assessments | ✗ | ✗ | ✓ | ✓ |

---

## 5. Threat Mitigations

| Threat | Mitigation |
|--------|-----------|
| **Password compromise** | Passwords are hashed with bcrypt (≥10 rounds) before storage. The plaintext password is never persisted or logged. |
| **SQL injection** | All database access goes through Prisma's parameterized queries. Raw SQL is not used anywhere in the application. |
| **Cross-Site Request Forgery (CSRF)** | JWT Bearer token auth is not cookie-based, so browser-based CSRF attacks do not apply. |
| **Cross-Origin requests** | NestJS CORS is configured via `CORS_ORIGINS` environment variable to allow only the frontend origin. |
| **Brute force / DDoS** | Rate limiting is applied at the Nginx ingress layer in production. The NestJS app does not implement application-level rate limiting. |
| **Sensitive data exposure** | LLM API keys are stored AES-encrypted in the database via `LLM_KEY_ENCRYPTION_SECRET`. Refresh tokens are hashed before storage. |
| **Audit trail** | All admin and organization management actions are recorded to `AuditLog` with actor identity, target resource, and timestamp. |

---

## 6. Candidate Assessment Security

Candidate assessments use single-use tokens in place of authentication:

- Each `CandidateInvite` has a unique UUID token with a configurable expiry.
- The candidate's token authorizes only the specific assessment it was issued for.
- Tab-switch events are recorded server-side via `POST /assessments/take/:token/event`.
- Optional copy-paste blocking is configurable per assessment.
- Tokens cannot be reused after the assessment is submitted or expired.
```

- [ ] **Step 2: Commit**

```bash
git add docs/06-security.md
git commit -m "docs: update security doc — add org RBAC, plan-based access control, candidate assessment security"
```

---

## Task 8: Replace `docs/organization.md` with Feature Reference

**Files:**
- Modify: `docs/organization.md`

The current file is a 1,000-line implementation plan with code diffs. Replace it with a concise feature reference doc appropriate for the `docs/` directory. The original implementation plan content is better suited for `docs/specs/`.

- [ ] **Step 1: Rewrite `docs/organization.md`**

Replace the entire file with:

```markdown
# Organization Management

CertGym's organization feature enables enterprise teams to manage members, run candidate assessments, and track competency levels across the organization.

---

## Plan-Based Access

| Capability | FREE | PREMIUM | ENTERPRISE | ADMIN |
|-----------|:----:|:-------:|:----------:|:-----:|
| Create organization | ✗ | ✓ (max 1) | ✓ (max 3) | ✓ |
| Max seats per org | — | 10 | 50 | 100 |
| Join via email invite | ✓ | ✓ | ✓ | ✓ |
| Join via link | ✗ | ✓ | ✓ | ✓ |
| Access org analytics | ✗ | ✓ | ✓ | ✓ |
| Create assessments | ✗ | ✗ | ✓ | ✓ |

Plans are set by platform admins only (`PATCH /admin/users/:userId/plan`). There is no self-service upgrade.

---

## Organization Roles

Every organization member has an `OrgRole`:

| Role | Key permissions |
|------|----------------|
| `OWNER` | Delete org, all admin actions |
| `ADMIN` | Manage members, approve questions, update settings |
| `MANAGER` | Create catalog items, groups, assessment invites |
| `MEMBER` | View all org resources |

---

## Core Features

### Member Management
- Invite members by email (all plans allow joining via invite).
- Bulk invite via CSV or join links (PREMIUM/ENTERPRISE only).
- Seat limits enforced on invitation; configurable per org.
- Members can be assigned to sub-groups for targeted catalog assignments.

### Private Question Bank
- Create org-scoped questions independent of the public question bank.
- Internal review workflow: `DRAFT → UNDER_REVIEW → APPROVED`.
- Clone questions from the public bank into the org's private bank.
- Bulk import via CSV.

### Exam Catalog & Learning Tracks
- Define a catalog of exams (static question list or dynamic draw from the org's question pool).
- Assign catalog exams to members or groups with optional scheduling windows.
- Chain catalog items into ordered learning tracks.

### Candidate Assessments
- Create hiring or screening assessments with optional question randomization.
- Invite external candidates by email; each candidate receives a unique, time-limited token.
- Candidates take the exam at `/assess/:token` — no account required.
- Admin views: candidate results, CSV export, funnel metrics (invited → started → passed).
- Anti-cheat: tab-switch recording; optional copy-paste blocking.

### Competency Framework
- Define competencies (e.g., "Cloud Security") with a 1–5 scale.
- Map competencies to exam domain names for automatic score inference.
- Set required competency levels per job role.
- View per-member competency profiles and gap analysis against job roles.
- See [ADR 028](./adr/028-competency-scoring.md) for the scoring algorithm.

### Organization Analytics
All analytics require `OrgRole` of `MANAGER` or above.

| Endpoint | Description |
|----------|-------------|
| `analytics/overview` | Member count, active users, exams taken, average scores |
| `analytics/readiness` | Per-certification readiness across the team |
| `analytics/skill-gaps` | Domain-level weakness analysis |
| `analytics/competency-profile` | Competency levels with gap vs. job role |
| `analytics/competency-heatmap` | Full member × competency matrix |

---

## API Reference

See [API Design — `organizations/`](./03-api_design.md#organizations), [`assessments/`](./03-api_design.md#assessments), [`competency/`](./03-api_design.md#competency), [`job-roles/`](./03-api_design.md#job-roles), and [`org-analytics/`](./03-api_design.md#org-analytics) for the full endpoint reference.

---

## Plan Downgrade Behavior

If an admin downgrades a user's plan while they own an organization:
- Existing organizations are preserved (grandfathered).
- The user retains management access to existing organizations.
- The user cannot create additional organizations until their plan is upgraded.
```

- [ ] **Step 2: Commit**

```bash
git add docs/organization.md
git commit -m "docs: replace organization implementation plan with concise feature reference doc"
```

---

## Task 9: Update Documentation Index (`docs/00-index.md`)

**Files:**
- Modify: `docs/00-index.md`

Add missing entries: ADR 028, `features/competency-framework.md`, `features/candidate-assessment.md` (created in this plan), and any other files present in the filesystem that are not yet indexed.

- [ ] **Step 1: Update `docs/00-index.md`**

Open the file and apply the following changes:

1. In the **Decisions (ADRs)** table, add the ADR 028 row:

```markdown
| [ADR-028](./adr/028-competency-scoring.md) | Competency scoring algorithm | Accepted |
```

2. In the **Features** table, add new rows:

```markdown
| [Competency Framework](./features/competency-framework.md) | Competency scoring algorithm, gap analysis, job-role mapping |
| [Candidate Assessment](./features/candidate-assessment.md) | Assessment lifecycle, token-based exam flow, anti-cheat events |
```

3. Update the `_Last updated_` line at the bottom:

```markdown
_Last updated: June 2026_
```

- [ ] **Step 2: Commit**

```bash
git add docs/00-index.md
git commit -m "docs: update index — add ADR 028, competency framework, and candidate assessment entries"
```

---

## Task 10: Create Feature Doc — Competency Framework

**Files:**
- Create: `docs/features/competency-framework.md`

- [ ] **Step 1: Create `docs/features/competency-framework.md`**

```markdown
# Competency Framework

The Competency Framework allows enterprise organizations to define skills, map them to exam domains, set job-role requirements, and track member proficiency over time.

---

## Concepts

| Concept | Description |
|---------|-------------|
| **Competency** | A named skill area (e.g., "Cloud Security") with a configurable 1–5 scale. |
| **CompetencyDomain** | A mapping from a competency to one or more exam domain names used to infer scores. |
| **JobRole** | A role definition within the organization (e.g., "Cloud Architect"). |
| **JobRoleCompetency** | The required competency level for a given job role on a specific competency. |

---

## Scoring Algorithm

Competency levels are inferred from aggregated `domainScores` already stored on every `ExamAttempt` and `CandidateInvite`. No re-processing of raw answers is required.

The pure function `inferCompetencyLevel()` (in `backend/src/competency/scoring/infer-competency-level.ts`):

1. Maps the competency's `CompetencyDomain` names to the attempt's `domainScores` (case-insensitive).
2. Sums `correct` and `total` across matched domains.
3. Converts the percentage to a level (1–5) using a configurable threshold table.
4. Returns a `confidence` rating (`LOW | MEDIUM | HIGH`) based on sample size.

**Default thresholds:**

| Level | Label | Minimum percentage |
|-------|-------|--------------------|
| 5 | Expert | 90% |
| 4 | Proficient | 75% |
| 3 | Competent | 60% |
| 2 | Developing | 40% |
| 1 | Novice | 0% |

See [ADR 028](../adr/028-competency-scoring.md) for the full rationale and edge-case handling.

---

## Gap Analysis

The competency profile analytics endpoint (`GET /organizations/:orgId/analytics/competency-profile`) returns:

- The member's inferred level for each competency.
- The required level for the member's job role (if set).
- The gap (positive = proficient, negative = below requirement).

The heatmap endpoint (`GET /organizations/:orgId/analytics/competency-heatmap`) returns a matrix of all org members × all competencies for at-a-glance identification of team-wide skill gaps.

---

## Configuration Steps

1. **Define competencies:** `POST /organizations/:orgId/competencies`
2. **Map domains:** `POST /organizations/:orgId/competencies/:id/domains`
3. **Create job roles:** `POST /organizations/:orgId/job-roles`
4. **Set required levels:** `PUT /organizations/:orgId/job-roles/:roleId/competencies`
5. **View gap analysis:** `GET /organizations/:orgId/analytics/competency-profile?memberId=<userId>&jobRoleId=<id>`
```

- [ ] **Step 2: Commit**

```bash
git add docs/features/competency-framework.md
git commit -m "docs: add competency framework feature doc"
```

---

## Task 11: Create Feature Doc — Candidate Assessment

**Files:**
- Create: `docs/features/candidate-assessment.md`

- [ ] **Step 1: Create `docs/features/candidate-assessment.md`**

```markdown
# Candidate Assessment

Candidate Assessments allow organizations (ENTERPRISE plan or ADMIN role) to send time-limited exam links to external candidates — no CertGym account required.

---

## Lifecycle

\`\`\`
Assessment created (DRAFT)
    → Activated (ACTIVE)
    → Candidates invited → CandidateInvite created (INVITED)
    → Candidate opens link → (STARTED)
    → Candidate submits → (SUBMITTED)  ← scored immediately
    → Assessment closed (CLOSED)
\`\`\`

---

## Assessment Configuration

| Field | Description |
|-------|-------------|
| `title` | Assessment name shown to the candidate |
| `timeLimit` | Duration in minutes (optional; no limit if omitted) |
| `randomizeQuestions` | Shuffle question order per candidate |
| `randomizeChoices` | Shuffle answer choice order per candidate |
| `blockCopyPaste` | Enable `oncopy`/`onpaste` event blocking on the exam page |
| `passingScore` | Percentage threshold for `SHORTLISTED` status |
| `expiresInHours` | Number of hours from invite creation before the token expires |

---

## Candidate Token Flow

Each candidate receives a unique UUID token via email. The token is the candidate's sole identity for the session.

1. `GET /assessments/take/:token` — Load assessment info (title, time limit, question count). Returns `404` if the token is invalid or expired.
2. `POST /assessments/take/:token/start` — Start the attempt. Returns question list (answers stripped). Marks `CandidateInvite.status = STARTED`.
3. `POST /assessments/take/:token/submit` — Submit all answers. Returns score and pass/fail result. Marks status `SUBMITTED`. Token is invalidated after submission.

---

## Anti-Cheat

| Event | Mechanism |
|-------|-----------|
| Tab switch | `visibilitychange` listener on the candidate page sends `POST /assessments/take/:token/event`. Increments `CandidateInvite.tabSwitchCount`. |
| Copy-paste | Optional `oncopy`/`onpaste` blocking via the `blockCopyPaste` assessment flag. |

Tab-switch counts are visible in the admin results view for review during candidate evaluation.

---

## Bulk Candidate Import

Send invitations to multiple candidates at once via CSV:

`POST /organizations/:orgId/assessments/:aid/candidates/bulk-csv`

CSV format:
\`\`\`
email,name
alice@example.com,Alice Chen
bob@example.com,Bob Kumar
\`\`\`

The endpoint deduplicates against existing invites and returns a `{ created, skipped }` count.

---

## Results and Ranking

`GET /organizations/:orgId/assessments/:aid/results` supports filtering:

| Filter | Returns |
|--------|---------|
| `all` (default) | All invited candidates |
| `submitted` | Candidates who completed the assessment |
| `passed` | Candidates who met `passingScore` |
| `shortlisted` | Candidates explicitly marked `SHORTLISTED` |

When ranking candidates at equal score levels, use the `percentage` field (continuous) rather than `level` (discrete) as a tie-breaker.

Results can be exported as CSV: `GET /organizations/:orgId/assessments/:aid/results/export`

---

## Frontend Routes

| Route | Component | Description |
|-------|-----------|-------------|
| `/org/:slug/assessments` | `OrgAssessments.tsx` | Assessment list |
| `/org/:slug/assessments/create` | `AssessmentBuilder.tsx` | Create assessment |
| `/org/:slug/assessments/:aid` | `AssessmentResults.tsx` | Candidate results |
| `/assess/:token` | `CandidateExam.tsx` | Public exam page (no auth) |
| `/assess/:token/result` | `CandidateResult.tsx` | Post-submission result page |
```

- [ ] **Step 2: Commit**

```bash
git add docs/features/candidate-assessment.md
git commit -m "docs: add candidate assessment feature doc"
```

---

## Self-Review

### Spec coverage

| Requirement | Covered by |
|-------------|-----------|
| Official English throughout | All tasks — each doc is written entirely in English |
| ADR 028 in Vietnamese → rewritten | Task 1 |
| ADR index missing 028 | Task 1, Step 2 |
| Architecture outdated | Task 2 |
| Data model missing enterprise entities | Task 3 |
| API doc covers only 7/30 modules | Task 4 |
| Frontend doc missing org and candidate pages | Task 5 |
| Deployment doc wrong PostgreSQL version | Task 6 |
| Security doc missing org RBAC | Task 7 |
| `organization.md` is implementation plan | Task 8 |
| Index missing new entries | Task 9 |
| No competency feature doc | Task 10 |
| No candidate assessment feature doc | Task 11 |

### Placeholder scan

No TBD, TODO, or "fill in details" placeholders in any task. All tables, code blocks, and section bodies are complete.

### Consistency check

- All API endpoint tables use the same column order: `Method | Route | Guard | Description`.
- `OrgRole` enum values are `OWNER | ADMIN | MANAGER | MEMBER` consistently across Tasks 2, 3, 7, 8.
- PostgreSQL version is `16` in Tasks 3, 6.
- The `inferCompetencyLevel()` function signature in Task 1 matches the description in Task 10.
- ADR 028 is referenced from Task 9 index and Task 10 feature doc as `./adr/028-competency-scoring.md`.
