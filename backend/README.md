# CertGym Backend

NestJS API server for the CertGym certification exam preparation platform.

## Stack

- **NestJS 11** — modular server framework
- **Prisma ORM** — type-safe database access to PostgreSQL 16
- **Passport.js** — JWT authentication with access + refresh token flow
- **BullMQ** — async job queue backed by Redis (AI generation, score computation)
- **Swagger** — auto-generated API docs at `/api/docs`

---

## Setup

```bash
npm install               # installs deps and runs prisma generate
cp .env.example .env      # fill in DATABASE_URL, JWT secrets, etc.
npx prisma migrate dev    # apply all migrations
npx prisma db seed        # seed demo certifications and questions
npm run start:dev         # hot-reload on :3000
```

> The `postinstall` hook runs `prisma generate` automatically. In git worktrees, always run `npm install` first to avoid enum/type errors.

---

## Commands

| Command | Description |
|---------|-------------|
| `npm run start:dev` | Start with hot reload |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm run test` | Jest unit tests |
| `npm run test:e2e` | End-to-end tests |
| `npm run test:cov` | Unit tests with coverage report |
| `npx prisma migrate dev` | Run pending migrations |
| `npx prisma migrate reset` | Reset DB and re-apply all migrations |
| `npx prisma db seed` | Seed development data |
| `npx prisma studio` | Open interactive database GUI |

---

## Module Overview

| Module | Path | Description |
|--------|------|-------------|
| `auth` | `src/auth/` | JWT login, refresh token, Passport guards |
| `users` | `src/users/` | User profiles, roles |
| `exam` | `src/exam/` | Exam sessions, submissions, scoring, analytics |
| `training` | `src/training/` | Flashcard SRS, AI coach, burnout detection, readiness scores |
| `ai-question-bank` | `src/ai-question-bank/` | AI question generation, LLM usage tracking, DDS |
| `organizations` | `src/organizations/` | Multi-tenant orgs, members, entrance exams |
| `squads` | `src/squads/` | Peer groups, reputation, leaderboards |
| `certifications` | `src/certifications/` | Cert catalog and domain management |

---

## Auth

`POST /api/v1/auth/login` and `POST /api/v1/auth/refresh` both return:

```json
{
  "accessToken": "...",
  "refreshToken": "...",
  "user": {
    "id": "...",
    "email": "...",
    "displayName": "...",
    "role": "USER",
    "orgMemberships": [
      { "orgId": "...", "slug": "acme", "name": "Acme Corp", "role": "MEMBER" }
    ]
  }
}
```

`orgMemberships` lets the frontend determine org context without extra API calls. Access tokens expire in 15 minutes; refresh tokens in 7 days.

---

## Environment Variables

```bash
DATABASE_URL=postgresql://certgym:password@localhost:5432/certgym?schema=public
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_SECRET=your-secret
JWT_REFRESH_SECRET=your-refresh-secret
LLM_KEY_ENCRYPTION_SECRET=your-encryption-secret
PORT=3000
NODE_ENV=development
MARKITDOWN_LOCAL_URL=http://markitdown:8001
```

In production, secrets are injected via AWS Secrets Manager — see [docs/deployment/aws-overview.md](../docs/deployment/aws-overview.md).

---

## Database

Schema is defined in `prisma/schema.prisma`. Key domains:

- **Users & Auth** — `User`, `RefreshToken`
- **Questions** — `Question`, `QuestionOption`, `QuestionVariant` (DDS)
- **Exams** — `ExamSession`, `ExamAttempt`, `ExamAnswer`
- **Flashcards** — `Flashcard`, `FlashcardReview` (SM-2 SRS fields)
- **Organizations** — `Organization`, `OrgMember`, `EntranceExam`
- **Squads** — `Squad`, `SquadMember`, `ReputationEvent`
- **AI & Training** — `CoachSession`, `CoachMessage`, `LlmUsageEvent`, `ReadinessScore`

---

## API Documentation

Swagger UI is available at `/api/docs` when the server is running. All endpoints are decorated with `@ApiOperation` and `@ApiResponse`.
