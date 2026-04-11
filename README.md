# 🧠 CertGym (Brain Gym)

[![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![NestJS](https://img.shields.io/badge/NestJS-E0234E?style=for-the-badge&logo=nestjs&logoColor=white)](https://nestjs.com/)
[![Prisma](https://img.shields.io/badge/Prisma-3982CE?style=for-the-badge&logo=Prisma&logoColor=white)](https://www.prisma.io/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)

**CertGym** is a comprehensive, community-driven platform designed to help you ace certification exams. It leverages modern learning techniques like **Spaced Repetition (SRS)** to ensure long-term retention of complex cloud concepts, networking, and project management topics.

---

## ✨ Key Features

### 🗂️ Spaced Repetition System (SRS)
- **Flashcard Decks**: Create and organize flashcards by certification domains.
- **Daily Review**: Smart scheduling using spaced repetition algorithms to focus on your weak areas.
- **Study Mode**: Interactive study sessions with instant feedback and progress tracking.

### 📝 Exam Simulation & Builder
- **Mock Exams**: Participate in realistic exam simulations with countdown timers and domain-wise breakdowns.
- **Custom Builder**: Create your own exams by selecting specific domains, difficulty levels, and question counts.
- **Detailed Analytics**: Review your performance with beautiful charts and domain-level performance insights.

### 🧠 Question & Training Hub
- **Rich Media Support**: Scenario-based questions with images, diagrams, and multi-choice support (powered by Framer Motion).
- **Training Hub**: A centralized dashboard to track your daily progress, upcoming reviews, and recent exam attempts.
- **Community Library**: Access thousands of community-shared questions and exams.

### 👥 Community & Social
- **Sharing**: Share your custom exams and questions with a simple link or publish them to the community library.
- **Leaderboards**: Compete with others and earn badges for your contributions and exam scores.
- **Discussion**: Engage in discussions on specific questions to deepen your understanding.

---

## 🛠️ Tech Stack

| Component | Technology |
| :--- | :--- |
| **Frontend** | React 18, TypeScript, Vite, TanStack Query, Zustand, React Router, shadcn/ui, Tailwind CSS, Framer Motion |
| **Backend** | NestJS, TypeScript, Prisma ORM, Passport.js (JWT Auth), Swagger |
| **Database** | PostgreSQL 16 |
| **Caching** | Redis 7 |
| **Infrastructure** | Docker, Docker Compose, Nginx |
| **Testing** | Vitest (Frontend), Jest (Backend) |

---

## 🚀 Getting Started

### Prerequisites
- [Docker](https://www.docker.com/products/docker-desktop/) and [Docker Compose](https://docs.docker.com/compose/install/)
- [Node.js](https://nodejs.org/) (v18+ recommended)

### ⚡ Quick Start (Recommended)
The easiest way to get the entire stack (Frontend, Backend, Database, Redis, Nginx) running is using Docker Compose:

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd brain-gym
   ```

2. **Configure environment variables**
   ```bash
   cp .env.example .env
   # Edit .env if needed (optional)
   ```

3. **Start all services**
   ```bash
   docker-compose up -d --build
   ```

Once started, the services will be available at:
- **Frontend**: [http://localhost](http://localhost) (via Nginx proxy)
- **Backend API Docs**: [http://localhost/api/docs](http://localhost/api/docs) or [http://localhost:3000/api/docs](http://localhost:3000/api/docs) (Swagger)
- **API Base**: [http://localhost/api/v1](http://localhost/api/v1)

---

### 🛠️ Manual Setup (Development)
If you want to run services independently for development:

#### 1. Database & Caching
```bash
# From the root directory
docker-compose up -d postgres redis
```

#### 2. Backend Setup
```bash
cd backend
npm install
# Ensure .env or backend environment is configured
npx prisma migrate dev
npx prisma db seed
npm run start:dev
```

#### 3. Frontend Setup
```bash
# In the root directory (separate terminal)
npm install
npm run dev
```
The frontend will be available at [http://localhost:5173](http://localhost:5173).

---

## 📂 Project Structure

```text
brain-gym/
├── src/                    # Frontend source code (React + Vite)
│   ├── components/         # Reusable UI components (shadcn/ui)
│   ├── pages/             # Page components & routing
│   ├── services/          # API service functions & React Query hooks
│   ├── stores/            # Zustand state management
│   └── lib/               # Utility functions & formatting
├── backend/               # Backend source code (NestJS)
│   ├── src/               # Application logic (Modules, Controllers, Services)
│   ├── prisma/            # Database schema, migrations, and seeds
│   └── test/              # E2E test suites
├── nginx/                 # Nginx configuration for reverse proxy
├── docker-compose.yml     # Orchestration for all services
└── docs/                  # Additional project documentation
```

---

## 📊 Available Scripts

### Frontend (Root)
- `npm run dev` - Start Vite development server
- `npm run build` - Create production bundle
- `npm run test` - Run Vitest unit tests
- `npm run lint` - Run ESLint checks

### Backend (`/backend`)
- `npm run start:dev` - Start NestJS server with watch mode
- `npm run test` - Run Jest unit tests
- `npm run test:e2e` - Run end-to-end tests
- `npx prisma studio` - Interactive GUI for your database

---

## 🎯 Target Certifications
CertGym provides curated content for popular certifications including:
- **AWS**: Solutions Architect, Developer, SysOps
- **Azure**: AZ-900, AZ-104, AZ-305
- **GCP**: Cloud Digital Leader, Associate Cloud Engineer
- **Others**: PMP, CKA, Security+, and more.

---

## 🚀 Changelog

### Phase 6 — Integration & Polish (April 2026)
- **Auth Enhancement**: Login and refresh token responses now include `orgMemberships` (orgId, slug, name, role) so the frontend knows the user's org context without extra API calls.
- **Auth Store**: The Zustand `useAuthStore` user state now stores `orgMemberships`, persisted across sessions.
- **Navbar**: The "Organization" nav link is now conditionally shown only for users with org memberships. For single-org users it links directly to `/org/:slug`; for multi-org users it links to the org selector.
- **Bottom Tab Bar**: An "Org" tab is conditionally shown on mobile for users with org memberships.
- **Dashboard**: An Organization card is shown on the dashboard for org members, displaying org name, role, and a quick link to the org dashboard. Multi-org users see a "View all" option.

---

## 📄 License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

Developed with ❤️ by the CertGym Community.
