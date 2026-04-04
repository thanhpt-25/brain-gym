# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**CertGym** (brain-gym) is a community-driven certification exam preparation platform. It consists of a React frontend and a NestJS backend, supporting features like spaced repetition flashcards, adaptive exams, AI question generation, and multi-tenant organization management.

## Commands

### Frontend (root directory)
```bash
npm run dev          # Start Vite dev server on port 8080
npm run build        # Production build → dist/
npm run lint         # ESLint checks
npm run test         # Run Vitest unit tests
npm run test:watch   # Watch mode tests
npm run preview      # Preview production build
```

### Backend (`/backend` directory)
```bash
npm run start:dev           # NestJS with hot reload
npm run build               # Compile TypeScript
npm run test                # Jest unit tests
npm run test:e2e            # End-to-end tests
npx prisma migrate dev      # Run DB migrations
npx prisma db seed          # Seed database
npx prisma studio           # Interactive DB GUI
```

### Docker (full stack)
```bash
docker-compose up -d --build   # Start all services (Nginx, NestJS, Postgres, Redis)
docker-compose down             # Stop all services
```

## Architecture

### Frontend Stack
- **React 18 + TypeScript + Vite** — SWC plugin, path alias `@/` → `./src/`
- **Routing** — React Router v6 with lazy-loaded pages (`React.lazy` + `Suspense`), all wrapped in `<PageTransition>` (Framer Motion)
- **State** — Zustand for client state (`auth.store`, `org.store`, `streak.store`); TanStack Query for all server state
- **UI** — shadcn/ui components + Tailwind CSS; dark mode via `next-themes`
- **Forms** — React Hook Form + Zod validation
- **HTTP** — Axios instance in `src/services/api.ts` with JWT Bearer token injection and automatic token refresh on 401

### Key Architectural Patterns

**API layer** (`src/services/`): All API calls go through the shared Axios instance in `api.ts`. The interceptor handles: attaching `Authorization: Bearer` from Zustand auth store, catching 401s, calling `/auth/refresh`, and retrying the original request. On refresh failure, it calls `logout()`.

**Protected routes**: `<ProtectedRoute>` checks `useAuthStore.isAuthenticated` and redirects to `/auth` with saved location for post-login redirect. Wrap sensitive routes with this component in `App.tsx`.

**Data fetching**: Use `useQuery` / `useMutation` from TanStack Query everywhere. Do not use Zustand for server data. Pattern:
```tsx
const { data, isLoading } = useQuery({
  queryKey: ['questions', certId],
  queryFn: () => getQuestions(certId),
  enabled: !!certId,
});
```

**TypeScript strictness**: `noImplicitAny: false` and `strictNullChecks: false` — the codebase uses loose TS checking. Don't add unnecessary non-null assertions or strict typing that isn't already present.

### Backend Stack
- **NestJS 11** with Passport.js (JWT strategy)
- **Prisma ORM** with PostgreSQL 16
- **Redis 7** for caching
- Multi-tenant with role-based guards for organization routes

### Infrastructure
- Dev: frontend on port 8080, backend NestJS on port 3000 (proxied via Vite at `/api`)
- Production: Nginx reverse proxy (port 80) → NestJS backend (`/api`) and static frontend files
- `VITE_API_BASE_URL` env var overrides the default `/api/v1` base URL

### Key Domain Areas
- **Exam engine** — `src/pages/ExamPage.tsx`: timer, mark-for-review, domain breakdown, strict/lenient timer modes
- **Flashcard SRS** — SM-2 style scheduling in `src/services/flashcards.ts`; mastery levels: NEW → LEARNING → REVIEW → MASTERED
- **Organizations** — multi-tenant with nested routes under `/org/:slug`; see `src/pages/org/` and `src/stores/org.store.ts`
- **AI generation** — `src/pages/AiQuestionGenerator.tsx` with LLM integration
- **Admin** — `src/pages/Admin/` with audit logs, moderation, badge management
