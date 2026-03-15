# Brain Gym

A comprehensive platform for practicing certification exams, particularly cloud certifications. Think of it as a "gym for your brain" where learners can create mock exams, practice with community-shared questions, and track their progress toward certification success.

## Features

### 🧠 Question Management
- Create and manage multiple-choice questions (MCQs)
- Support for scenario-based questions with images/diagrams
- Multiple correct answers capability
- Difficulty levels and tagging system
- Rich explanations and reference links

### 📝 Exam Builder
- Create custom mock exams for various certifications
- Configurable exam settings (time limits, question count, difficulty distribution)
- Public, private, and link-shared exam visibility options

### 🎯 Exam Simulation
- Realistic exam experience with countdown timers
- Question navigation and review marking
- Instant results with detailed breakdowns
- Domain-wise performance analysis

### 📊 Analytics & Progress Tracking
- Personal dashboard with exam history
- Score trends and pass probability calculations
- Weak topic identification
- Performance insights and recommendations

### 👥 Community Features
- Share questions and exams with the community
- Discussion threads on questions
- Voting and quality control systems
- Expert verification badges

### 🎮 Gamification
- Points system for contributions
- Achievement badges
- Leaderboards for top contributors

## Tech Stack

### Frontend
- **React 18** - Modern React with hooks
- **TypeScript** - Type-safe development
- **Vite** - Fast build tool and dev server
- **shadcn/ui** - Beautiful, accessible UI components
- **Tailwind CSS** - Utility-first CSS framework
- **React Query** - Powerful data synchronization
- **Zustand** - Lightweight state management
- **React Router** - Client-side routing
- **React Hook Form** - Performant forms with validation

### Backend
- **NestJS** - Progressive Node.js framework
- **TypeScript** - Type-safe backend development
- **Prisma** - Next-generation ORM
- **PostgreSQL** - Primary database
- **Redis** - Caching and session storage
- **JWT** - Authentication and authorization
- **Swagger** - API documentation

### Development & Testing
- **Docker & Docker Compose** - Containerized development
- **Vitest** - Fast unit testing for frontend
- **Jest** - Testing framework for backend
- **ESLint** - Code linting
- **Prettier** - Code formatting

## Getting Started

### Prerequisites
- Node.js 18+ and npm (or bun)
- Docker and Docker Compose
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd brain-gym
   ```

2. **Start the database services**
   ```bash
   docker-compose up -d
   ```

3. **Install frontend dependencies**
   ```bash
   npm install
   ```

4. **Install backend dependencies**
   ```bash
   cd backend
   npm install
   cd ..
   ```

5. **Set up the database**
   ```bash
   cd backend
   npx prisma migrate dev
   npx prisma db seed
   cd ..
   ```

6. **Start the development servers**

   **Terminal 1 - Backend:**
   ```bash
   cd backend
   npm run start:dev
   ```

   **Terminal 2 - Frontend:**
   ```bash
   npm run dev
   ```

7. **Open your browser**
   
   Navigate to `http://localhost:5173` for the frontend and `http://localhost:3000` for the backend API.

## Available Scripts

### Frontend Scripts
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run test` - Run tests once
- `npm run test:watch` - Run tests in watch mode
- `npm run lint` - Run ESLint

### Backend Scripts
- `npm run start:dev` - Start development server with hot reload
- `npm run start:prod` - Start production server
- `npm run build` - Build the application
- `npm run test` - Run unit tests
- `npm run test:e2e` - Run end-to-end tests
- `npm run lint` - Run ESLint

### Database Scripts
- `npx prisma migrate dev` - Run database migrations
- `npx prisma db seed` - Seed the database
- `npx prisma studio` - Open Prisma Studio

## Project Structure

```
brain-gym/
├── src/                    # Frontend source code
│   ├── components/         # Reusable UI components
│   ├── pages/             # Page components
│   ├── services/          # API service functions
│   ├── stores/            # Zustand state stores
│   ├── types/             # TypeScript type definitions
│   └── lib/               # Utility functions
├── backend/               # Backend source code
│   ├── src/
│   │   ├── auth/          # Authentication module
│   │   ├── users/         # User management
│   │   ├── questions/     # Question management
│   │   ├── certifications/# Certification management
│   │   └── prisma/        # Database service
│   └── prisma/            # Database schema and migrations
├── docs/                  # Documentation
└── public/                # Static assets
```

## API Documentation

When the backend is running, visit `http://localhost:3000/api` to access the Swagger API documentation.

## Contributing

We welcome contributions! Please see our contributing guidelines for details on:

- Setting up your development environment
- Code style and standards
- Submitting pull requests
- Reporting issues

## Target Certifications

The platform is designed to support various certification exams, with initial focus on:

- AWS Certified Solutions Architect
- Microsoft Azure Fundamentals
- Google Cloud Professional Cloud Architect
- PMI PMP Certification
- CNCF Certified Kubernetes Administrator

## License

This project is licensed under the MIT License - see the LICENSE file for details.
