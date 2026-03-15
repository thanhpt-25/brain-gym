# Brain Gym — Technology Stack

## Frontend
- **Runtime**: Node.js (managed via nvm)
- **Language**: TypeScript 5.8
- **Framework**: React 18.3
- **Build Tool**: Vite 5.4 (with SWC plugin via @vitejs/plugin-react-swc)
- **Styling**: Tailwind CSS 3.4 + tailwindcss-animate + @tailwindcss/typography
- **UI Library**: shadcn-ui (40+ Radix UI-based components)
- **Routing**: react-router-dom 6.30
- **State Management**: Zustand 5.0 (with persist middleware)
- **Server State**: TanStack React Query 5.83
- **HTTP Client**: Axios 1.13
- **Forms**: react-hook-form 7.61 + @hookform/resolvers + Zod 3.25
- **Animations**: Framer Motion 12.35
- **Icons**: Lucide React 0.462
- **Charts**: Recharts 2.15
- **Testing**: Vitest 3.2 + @testing-library/react 16 + jsdom
- **Linting**: ESLint 9 + typescript-eslint + react-hooks + react-refresh plugins

## Backend
- **Language**: TypeScript 5.7
- **Framework**: NestJS 11 (@nestjs/common, @nestjs/core, @nestjs/platform-express)
- **ORM**: Prisma 6.19 (@prisma/client)
- **Database**: PostgreSQL 16 (via Docker)
- **Cache**: Redis 7 (via Docker)
- **Authentication**: Passport.js + @nestjs/passport + passport-jwt + @nestjs/jwt + bcryptjs
- **Validation**: class-validator + class-transformer
- **API Docs**: @nestjs/swagger + swagger-ui-express
- **Testing**: Jest 30 + ts-jest + supertest
- **Linting**: ESLint 9 + Prettier

## Infrastructure
- **Containers**: Docker Compose (PostgreSQL 16-alpine, Redis 7-alpine)
- **Package Manager**: npm (bun.lock also present)

## Development Commands

### Frontend (root)
| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Production build |
| `npm run build:dev` | Development build |
| `npm run lint` | ESLint check |
| `npm run test` | Run Vitest |
| `npm run test:watch` | Vitest watch mode |
| `npm run preview` | Preview production build |

### Backend (`backend/`)
| Command | Description |
|---------|-------------|
| `npm run start:dev` | NestJS dev server (watch mode) |
| `npm run build` | NestJS production build |
| `npm run start:prod` | Run production build |
| `npm run test` | Jest unit tests |
| `npm run test:e2e` | E2E tests |
| `npm run test:cov` | Coverage report |
| `npm run format` | Prettier format |
| `npm run lint` | ESLint fix |

### Infrastructure
| Command | Description |
|---------|-------------|
| `docker compose up -d` | Start PostgreSQL + Redis |
| `npx prisma migrate dev` | Run DB migrations (in `backend/`) |
| `npx prisma db seed` | Seed database (in `backend/`) |
| `npx prisma studio` | Open Prisma Studio (in `backend/`) |

## Key Configuration Files
- `vite.config.ts` — Vite build config with path aliases (`@/` → `src/`)
- `tailwind.config.ts` — Tailwind theme customization
- `tsconfig.json` / `tsconfig.app.json` / `tsconfig.node.json` — TypeScript configs
- `components.json` — shadcn-ui component configuration
- `backend/nest-cli.json` — NestJS CLI config
- `backend/prisma/schema.prisma` — Database schema
- `docker-compose.yml` — Local infrastructure
