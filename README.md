# CertGym

[![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![NestJS](https://img.shields.io/badge/NestJS-E0234E?style=for-the-badge&logo=nestjs&logoColor=white)](https://nestjs.com/)
[![Prisma](https://img.shields.io/badge/Prisma-3982CE?style=for-the-badge&logo=Prisma&logoColor=white)](https://www.prisma.io/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)

A community-driven certification exam preparation platform. CertGym combines spaced repetition flashcards, adaptive mock exams, AI-assisted question generation, and social learning tools to help you pass cloud, networking, and project management certifications on the first try.

---

## Table of Contents

- [Features](#features)
- [Quick Start](#quick-start)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Development Setup](#development-setup)
- [Environment Variables](#environment-variables)
- [Testing](#testing)
- [Deployment](#deployment)
- [Documentation](#documentation)
- [Contributing](#contributing)

---

## Features

### Spaced Repetition Flashcards (SRS)
Create flashcard decks organized by certification domain. The SM-2 algorithm schedules daily reviews to maximize long-term retention — cards you struggle with reappear at 1, 3, 7, and 21-day intervals.

### Adaptive Exam Engine
- **Mock exams** with countdown timers, mark-for-review, and strict/lenient timer modes
- **Smart Exam Builder** — compose exams by domain percentage or difficulty target
- **Enterprise Entrance Exams** — org admins create onboarding assessments for new members
- **Detailed analytics** — per-domain score breakdown, pass-probability readiness score

### AI Tools
- **AI Question Generator** — generate questions from pasted text using any configured LLM provider
- **AI Coach** — conversational coach with user performance context (tier-gated)
- **Burnout Detection** — signals-based alert when study pace becomes counterproductive

### Community & Organizations
- **Question library** — community-shared, upvoted questions with reputation scoring
- **Squads** — small peer groups for collaborative study
- **Multi-tenant orgs** — enterprise teams with role-based access, org-wide dashboards
- **Leaderboards & badges** — recognition for top contributors

---

## Quick Start

The fastest path is Docker Compose — one command brings up the full stack.

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (includes Compose)
- [Node.js](https://nodejs.org/) v18+ (for local development only)

### Run with Docker

```bash
git clone <repository-url>
cd brain-gym

cp .env.example .env          # optional: edit defaults
docker-compose up -d --build
```

| Service | URL |
|---------|-----|
| Frontend | http://localhost |
| Backend API | http://localhost/api/v1 |
| Swagger docs | http://localhost/api/docs |

Stop all services: `docker-compose down`

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18, TypeScript, Vite + SWC, React Router v6, TanStack Query, Zustand, shadcn/ui, Tailwind CSS, Framer Motion |
| **Backend** | NestJS 11, TypeScript, Prisma ORM, Passport.js (JWT), Swagger/OpenAPI |
| **Database** | PostgreSQL 16 |
| **Cache** | Redis 7 |
| **Infrastructure** | Docker, Docker Compose, Nginx |
| **Testing** | Vitest (frontend), Jest (backend), Playwright (e2e) |

---

## Project Structure

```
brain-gym/
├── src/                        # Frontend (React + Vite)
│   ├── components/             # Reusable UI components
│   │   ├── dashboard/          # Dashboard panels (burnout, LLM cost, etc.)
│   │   ├── exam/               # Exam UI components
│   │   └── ui/                 # shadcn/ui primitives
│   ├── pages/                  # Route-level page components
│   │   ├── Admin/              # Admin tools (moderation, audit logs)
│   │   └── org/                # Multi-tenant org pages
│   ├── services/               # API call functions + TanStack Query hooks
│   │   └── api.ts              # Shared Axios instance (auth + refresh interceptor)
│   ├── stores/                 # Zustand stores
│   │   ├── auth.store.ts       # Auth state + JWT tokens
│   │   └── org.store.ts        # Active org context
│   └── lib/                    # Utilities and formatters
├── backend/                    # Backend (NestJS)
│   ├── src/
│   │   ├── auth/               # JWT auth, guards, refresh token
│   │   ├── training/           # Flashcards, coach, SRS scheduling
│   │   ├── exam/               # Exam engine, submissions, analytics
│   │   ├── ai-question-bank/   # AI generation, LLM usage tracking
│   │   ├── organizations/      # Multi-tenant org management
│   │   └── squads/             # Squad/peer-group features
│   ├── prisma/
│   │   ├── schema.prisma       # Database schema
│   │   ├── migrations/         # SQL migration history
│   │   └── seed.ts             # Development seed data
│   └── test/                   # E2E test suites
├── infra/                      # Terraform modules (AWS deployment)
├── nginx/                      # Nginx reverse-proxy config
├── docs/                       # All project documentation
├── docker-compose.yml
└── .github/workflows/          # CI/CD pipelines
```

---

## Development Setup

### 1. Start infrastructure (Postgres + Redis)

```bash
docker-compose up -d postgres redis
```

### 2. Backend

```bash
cd backend
npm install                     # also runs prisma generate
cp .env.example .env            # fill in DATABASE_URL, JWT secrets
npx prisma migrate dev          # apply migrations
npx prisma db seed              # seed demo data
npm run start:dev               # hot-reload on :3000
```

### 3. Frontend

```bash
# from repo root
npm install
npm run dev                     # Vite dev server on :8080
```

The frontend proxies `/api` to `localhost:3000` via Vite's dev server — no CORS config needed.

### Available scripts

**Frontend (root)**

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server on :8080 |
| `npm run build` | Production bundle → `dist/` |
| `npm run test` | Vitest unit tests |
| `npm run test:watch` | Watch mode |
| `npm run lint` | ESLint |
| `npm run preview` | Preview production build |

**Backend (`/backend`)**

| Command | Description |
|---------|-------------|
| `npm run start:dev` | NestJS with hot reload |
| `npm run build` | Compile TypeScript |
| `npm run test` | Jest unit tests |
| `npm run test:e2e` | End-to-end tests |
| `npx prisma migrate dev` | Run pending migrations |
| `npx prisma db seed` | Seed database |
| `npx prisma studio` | Interactive DB GUI |

---

## Environment Variables

### Frontend (`.env`)

```bash
VITE_API_BASE_URL=/api/v1          # override for cloud deployments
```

### Backend (`backend/.env`)

```bash
DATABASE_URL=postgresql://certgym:password@localhost:5432/certgym?schema=public
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_SECRET=change-me
JWT_REFRESH_SECRET=change-me
LLM_KEY_ENCRYPTION_SECRET=change-me
PORT=3000
NODE_ENV=development
```

> Do not commit `.env` files. `.gitignore` already excludes them.

---

## Testing

```bash
# Frontend unit tests
npm run test

# Backend unit tests
cd backend && npm run test

# Backend e2e tests
cd backend && npm run test:e2e

# Playwright e2e (requires running app)
npx playwright test
```

Coverage reports are written to `coverage/`. The project targets ≥80% coverage on all new code.

---

## Deployment

### Local Docker (default)

```bash
docker-compose up -d --build
```

### Cloud (AWS ECS Fargate)

The production stack runs on AWS: ECS Fargate (backend), S3 + CloudFront (frontend), RDS PostgreSQL, ElastiCache Redis. CI/CD is handled by GitHub Actions (`.github/workflows/deploy.yml`).

Full deployment guides:
- [AWS Overview & IAM Setup](docs/deployment/aws-overview.md) — architecture, IAM roles, CI/CD workflow
- [Terraform Setup](docs/deployment/aws-terraform.md) — provision all AWS resources in one `terraform apply`
- [Manual AWS Console Setup](docs/deployment/aws-console-setup.md) — step-by-step console walkthrough

---

## Documentation

All technical and product documentation lives in [`docs/`](docs/).

### Architecture & Design
| Document | Description |
|----------|-------------|
| [Architecture Overview](docs/01-architecture.md) | C4 context/container diagrams, technology stack |
| [Data Model](docs/02-data_model.md) | Database schema and ERDs |
| [API Design](docs/03-api_design.md) | REST conventions, auth, module overview |
| [Frontend Architecture](docs/04-frontend.md) | React structure, routing, state management |
| [Security](docs/06-security.md) | JWT auth flow, RBAC, data protection |
| [Basic Design (single doc)](docs/basic-design.md) | Full system design in one place |

### Features
| Document | Description |
|----------|-------------|
| [Exam Engine](docs/exam-engine.md) | State machine, timer modes, scoring, submission flow |
| [Coach Tier Gating](docs/features/coach-tier-gating.md) | How the AI coach feature is gated by subscription tier |
| [Burnout Detection](docs/features/burnout-detection.md) | Signal model, severity levels, user guidance |
| [Local LLM Question Generation](docs/local-llm-question-generation.md) | Using local LLM providers |
| [Organization Management](docs/organization.md) | Multi-tenant orgs, roles, onboarding |

### Operations
| Document | Description |
|----------|-------------|
| [On-Call Runbook](docs/oncall.md) | Incident response, rollback procedures, log access |
| [Deployment Overview](docs/05-deployment.md) | Docker, Nginx, environment configuration |
| [AWS Deployment Guide](docs/deployment/aws-overview.md) | Cloud infrastructure reference |

### Decisions & Process
| Document | Description |
|----------|-------------|
| [ADR Index](docs/adr/00-index.md) | Architecture Decision Records |
| [Vision & Strategy](docs/vision.md) | Product philosophy and roadmap |
| [Working Agreement](docs/working-agreement.md) | Team norms and process |
| [Security Threat Model](docs/security/threat-model.md) | Threat analysis and mitigations |

---

## Contributing

1. **Fork** the repository and create a feature branch from `main`
2. Follow the coding standards — run `npm run lint` and `npm run test` before opening a PR
3. Keep PRs focused; one feature or fix per PR
4. Add or update tests for any changed behavior
5. Reference the relevant issue or user story in the PR description

See [Working Agreement](docs/working-agreement.md) for team norms, and [Architecture Overview](docs/01-architecture.md) before making structural changes.

---

## License

MIT — see [LICENSE](LICENSE).

Developed with the CertGym Community.
