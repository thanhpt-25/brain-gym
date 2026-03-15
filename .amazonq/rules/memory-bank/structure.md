# Brain Gym — Project Structure

## Monorepo Layout
This is a monorepo with a React frontend (root) and a NestJS backend (`backend/`), each with independent `package.json` and build tooling.

```
brain-gym/
├── src/                    # React frontend (Vite + TypeScript)
│   ├── components/         # Reusable UI components
│   │   ├── ui/             # shadcn-ui primitives (40+ components)
│   │   ├── CertificationCard.tsx
│   │   ├── NavLink.tsx
│   │   └── ProtectedRoute.tsx
│   ├── pages/              # Route-level page components
│   │   ├── Index.tsx        # Landing page with hero, certifications, features
│   │   ├── Auth.tsx         # Login/register page
│   │   ├── ExamPage.tsx     # Exam simulation engine
│   │   ├── StudyMode.tsx    # Study/flashcard mode
│   │   ├── QuestionsBrowser.tsx  # Browse question bank
│   │   ├── QuestionForm.tsx # Create/edit questions
│   │   └── NotFound.tsx
│   ├── services/           # API client layer (Axios-based)
│   │   ├── api.ts           # Axios instance with auth interceptors & token refresh
│   │   ├── auth.service.ts  # Login, register, profile
│   │   ├── certifications.ts
│   │   └── questions.ts     # CRUD + voting
│   ├── stores/             # State management (Zustand)
│   │   └── auth.store.ts    # Auth state with persist middleware
│   ├── types/              # TypeScript type definitions
│   │   └── exam.ts          # Question, Certification, MockExam, ExamAttempt, ExamResult
│   ├── data/               # Mock/seed data
│   │   └── mockData.ts
│   ├── hooks/              # Custom React hooks
│   ├── lib/                # Utility functions (cn helper)
│   ├── App.tsx             # Root component with routing
│   └── main.tsx            # Entry point
├── backend/                # NestJS API server
│   ├── prisma/
│   │   ├── schema.prisma    # Full database schema (15+ models)
│   │   ├── seed.ts          # Database seeding
│   │   └── migrations/
│   ├── src/
│   │   ├── auth/            # Authentication module (JWT + Passport)
│   │   │   ├── dto/         # Login/register DTOs
│   │   │   ├── guards/      # JWT auth guard
│   │   │   ├── strategies/  # Passport JWT strategy
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   └── auth.module.ts
│   │   ├── certifications/  # Certification CRUD module
│   │   ├── questions/       # Questions CRUD + voting module
│   │   ├── users/           # User management module
│   │   ├── prisma/          # Prisma service wrapper
│   │   ├── common/          # Shared decorators, DTOs, filters
│   │   ├── app.module.ts    # Root NestJS module
│   │   └── main.ts          # Server entry point
│   └── test/               # E2E tests
├── docs/
│   └── vision.md            # Product vision document (Vietnamese)
├── public/                  # Static assets
├── docker-compose.yml       # PostgreSQL + Redis containers
├── package.json             # Frontend dependencies & scripts
├── vite.config.ts           # Vite build configuration
├── tailwind.config.ts       # Tailwind CSS configuration
└── vitest.config.ts         # Test configuration
```

## Core Architectural Patterns
- **Frontend**: React SPA with file-based page routing via react-router-dom v6
- **Backend**: NestJS modular architecture (Module → Controller → Service → Prisma)
- **Database**: PostgreSQL via Prisma ORM with comprehensive relational schema
- **State**: Zustand with persist middleware for client-side auth state
- **API Communication**: Axios with interceptors for JWT auth and automatic token refresh
- **Data Fetching**: TanStack React Query for server state management
- **UI**: shadcn-ui component library built on Radix UI primitives + Tailwind CSS
- **Animations**: Framer Motion for page transitions and scroll animations
- **Infrastructure**: Docker Compose for local PostgreSQL and Redis

## Database Models (Prisma)
User, Certification, Domain, Question, Choice, Tag, QuestionTag, Exam, ExamQuestion, ExamAttempt, Answer, Comment, Vote, Report, Badge, BadgeAward

## API Routes (prefix: `/api/v1`)
- `POST /auth/login`, `POST /auth/register`, `POST /auth/refresh`
- `GET /certifications`, `GET /certifications/:id`
- `GET /questions`, `GET /questions/:id`, `POST /questions`, `POST /questions/:id/vote`
- `GET /users/me`
