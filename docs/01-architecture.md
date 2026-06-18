# 01 - Architecture Overview

## 1. System Context (C4 Context)

CertGym is a community-driven certification exam preparation platform. Users study for certifications via flashcards, practice exams, and AI-generated questions. Organizations use the platform to assess and track their members' readiness.

```mermaid
C4Context
    title System Context — CertGym

    Person(learner, "Learner", "Studies certifications, takes practice exams, reviews flashcards.")
    Person(org_admin, "Org Admin", "Manages members, assessments, and the org question bank.")
    Person(admin, "Platform Admin", "Moderates content, manages certifications, monitors usage.")

    System(certgym, "CertGym Platform", "Web application for exam preparation, flashcard SRS, AI question generation, and multi-tenant organization management.")

    System_Ext(llm, "LLM Provider", "User-configured API key for AI question generation (OpenAI, Anthropic, etc.).")
    System_Ext(google, "Google OAuth", "Social sign-in provider.")
    System_Ext(markitdown, "Markitdown Service", "Converts uploaded documents (PDF, DOCX) to Markdown for LLM ingestion.")

    Rel(learner, certgym, "Practices exams, flashcards, views analytics")
    Rel(org_admin, certgym, "Manages org, runs assessments")
    Rel(admin, certgym, "Moderates platform content")
    Rel(certgym, llm, "Generates questions via user-supplied API key")
    Rel(certgym, google, "Authenticates users via OAuth 2.0")
    Rel(certgym, markitdown, "Converts uploaded study materials")
```

## 2. Container Architecture (C4 Container)

```mermaid
C4Container
    title Container Diagram — CertGym

    Container(spa, "Single Page Application", "React 18, Vite, TypeScript", "Delivers all CertGym UI in the browser. Communicates with the API via JSON/HTTPS.")
    Container(api, "API Server", "NestJS 11, TypeScript", "Handles all business logic: auth, questions, exams, flashcards, analytics, organizations, AI generation. Global prefix: /api/v1. Swagger docs at /api/docs.")
    ContainerDb(db, "Relational Database", "PostgreSQL 16", "Stores users, questions, exams, attempts, organizations, flashcards, audit logs, etc. Accessed via Prisma ORM.")
    Container(cache, "Cache / Queue Broker", "Redis 7", "Used for caching and as the BullMQ job queue broker for async AI generation jobs.")
    Container(nginx, "Reverse Proxy", "Nginx (stable-alpine)", "Serves the compiled SPA on port 80. Proxies /api/* requests to the NestJS backend.")
    Container(markitdown, "Markitdown Service", "Python (local Docker build)", "HTTP service that converts uploaded files (PDF, DOCX) to Markdown. Called internally by the backend.")

    Rel(spa, nginx, "All requests", "HTTPS/80")
    Rel(nginx, spa, "Static assets (HTML, JS, CSS)")
    Rel(nginx, api, "Proxies /api/*", "HTTP/3000")
    Rel(api, db, "Reads/writes via Prisma", "TCP/5432")
    Rel(api, cache, "Cache lookups and BullMQ job dispatch", "TCP/6379")
    Rel(api, markitdown, "POST file content", "HTTP/8001")
```

## 3. Infrastructure & Deployment

### 3.1 Local Development

| Service | Host | Port |
|---------|------|------|
| Frontend (Vite dev server) | localhost | 8080 |
| Backend (NestJS) | localhost | 3000 |
| PostgreSQL | localhost | 5432 |
| Redis | localhost | 6379 |

In development, the Vite dev server proxies `/api` calls to `localhost:3000` so CORS issues are avoided. The `VITE_API_BASE_URL` environment variable overrides the default `/api/v1` base URL.

### 3.2 Production (Docker Compose)

Six services are defined in `docker-compose.yml`:

| Container | Image / Build | Role |
|-----------|---------------|------|
| `braingym-nginx` | `nginx:stable-alpine` | Public entry point on port 80 |
| `braingym-frontend` | Built from root `Dockerfile` | Compiled SPA served by Nginx |
| `braingym-backend` | Built from `backend/Dockerfile` | NestJS API on internal port 3000 |
| `braingym-postgres` | `postgres:16-alpine` | Primary data store |
| `braingym-redis` | `redis:7-alpine` | Cache and queue broker |
| `braingym-markitdown` | Built from `lambda/markitdown/Dockerfile.local` | Document conversion service |

The backend requires `JWT_SECRET`, `JWT_REFRESH_SECRET`, and `DATABASE_URL` to start. It validates these at bootstrap and throws if any are missing.

### 3.3 Required Environment Variables (Backend)

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Signing secret for access tokens (15 min default) |
| `JWT_REFRESH_SECRET` | Signing secret for refresh tokens (7 day default) |
| `LLM_KEY_ENCRYPTION_SECRET` | AES key used to encrypt user-supplied LLM API keys at rest |
| `REDIS_HOST` / `REDIS_PORT` | Redis connection |
| `MARKITDOWN_LOCAL_URL` | Internal URL for the Markitdown service |
| `CORS_ORIGINS` | Comma-separated allowed origins (falls back to localhost for dev) |

## 4. Technology Stack

### 4.1 Frontend

| Concern | Library / Version |
|---------|------------------|
| Framework | React 18.3 |
| Build tool | Vite 5.4 (SWC plugin) |
| Language | TypeScript 5.8 (`noImplicitAny: false`, `strictNullChecks: false`) |
| Routing | React Router v6.30 |
| Server state | TanStack Query v5.83 |
| Client state | Zustand v5.0 |
| UI components | shadcn/ui (Radix UI primitives) |
| Styling | Tailwind CSS v3.4 |
| Animations | Framer Motion v12 |
| Forms | React Hook Form v7 + Zod v3 |
| HTTP client | Axios v1.13 |

### 4.2 Backend

| Concern | Library / Version |
|---------|------------------|
| Framework | NestJS 11 |
| Language | TypeScript |
| ORM | Prisma (PostgreSQL 16) |
| Authentication | Passport.js — JWT strategy (access + refresh tokens) |
| Job queues | BullMQ (Redis-backed) via `QueuesModule` |
| Rate limiting | `@nestjs/throttler` — 300 requests / 60 s globally |
| API documentation | Swagger / OpenAPI at `/api/docs` |
| Row-level security | `RlsInterceptor` — sets tenant context on every request |

## 5. Backend Module Map

The NestJS application is composed of the following modules registered in `AppModule`:

### Core Infrastructure
- `PrismaModule` — shared Prisma client
- `RedisModule` — shared Redis client
- `QueuesModule` — BullMQ job queues (used by AI generation)
- `AuditModule` — audit event recording
- `MailModule` — transactional email

### Identity & Access
- `AuthModule` — JWT login, refresh, Google OAuth
- `UsersModule` — user profiles, settings
- `OrganizationsModule` — multi-tenant org management
- `AdminModule` — platform admin operations

### Certification Content
- `CertificationsModule` — certification catalog and domains
- `ProvidersModule` — certification body registry (e.g., AWS, Azure)
- `QuestionsModule` — community question CRUD, voting, versioning
- `TagsModule` — tagging taxonomy
- `ExamsModule` — exam builder and configuration
- `AttemptsModule` — exam simulation and attempt recording
- `ExamCatalogModule` — org-scoped exam catalog
- `OrgQuestionsModule` — org-private question bank

### Learning & SRS
- `FlashcardsModule` — deck and card management; SM-2 scheduling
- `TrainingModule` — training hub and AI coach sessions
- `MasteryModule` — per-domain mastery scoring
- `KnowledgeGraphModule` — topic relationship graph
- `CaptureModule` — in-exam word / concept capture

### Analytics & Intelligence
- `AnalyticsModule` — user score trends and weak-topic analysis
- `OrgAnalyticsModule` — org-level member readiness analytics
- `InsightsModule` — automated study insights
- `PassLikelihoodModule` (surveys) — pass-likelihood survey collection
- `AiQuestionBankModule` — LLM-backed question generation jobs

### Gamification & Social
- `GamificationModule` — points, badges, leaderboard
- `SquadsModule` — peer study groups
- `CommentsModule` — question discussion threads
- `ReportsModule` — content moderation reports
- `EventsModule` — platform event bus

### Org Features
- `AssessmentsModule` — candidate assessment workflows
- `JobRolesModule` — org job-role definitions
- `CompetencyModule` — competency framework
- `StreamsModule` — org learning tracks (registered as `OrgAnalyticsModule`)
