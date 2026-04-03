# 01 - Architecture Overview

## 1. High-Level System Architecture (C4 Context)

Brain Gym operates as a modern client-server web application. It connects learners, contributors, and reviewers to a centralized platform for certification exam preparation.

```mermaid
C4Context
    title System Context diagram for Brain Gym

    Person(learner, "Learner", "A user studying for certifications.")
    Person(contributor, "Contributor", "A user creating questions and exams.")
    
    System(brainGym, "Brain Gym Platform", "Allows users to simulate exams, practice flashcards, and track progress.")
    
    System_Ext(llm, "LLM Provider", "OpenAI/Anthropic/Gemini for question generation.")
    System_Ext(db, "PostgreSQL Database", "Stores user data, questions, exams, and analytics.")

    Rel(learner, brainGym, "Uses for training")
    Rel(contributor, brainGym, "Creates content")
    Rel(brainGym, db, "Reads from and writes to")
    Rel(brainGym, llm, "Invokes for AI coaching and question generation")
```

## 2. Container Architecture

The system is broken down into three primary containers: a Frontend SPA, a Backend API, and a Database.

```mermaid
C4Container
    title Container diagram for Brain Gym

    Container(spa, "Single Page Application", "React, Vite, TypeScript", "Provides all Brain Gym functionality via the web browser.")
    Container(api, "API Application", "NestJS, TypeScript", "Provides certification data, exam evaluation, and user logic via JSON/REST HTTPS API.")
    ContainerDb(db, "Database", "PostgreSQL", "Stores user profiles, questions, exams, flashcards, etc.")

    Rel(spa, api, "Makes API calls to", "JSON/HTTPS")
    Rel(api, db, "Reads from and writes to", "Prisma/TCP")
```

## 3. Technology Stack

### 3.1 Frontend
- **Framework:** React 18, Vite
- **Language:** TypeScript
- **State Management:** Zustand (Global State), React Query (Server State)
- **Styling:** Tailwind CSS, UI component library (shadcn/ui)
- **Routing:** React Router

### 3.2 Backend
- **Framework:** NestJS
- **Language:** TypeScript
- **ORM:** Prisma
- **Database:** PostgreSQL
- **Authentication:** JWT (JSON Web Tokens)
- **API Documentation:** Swagger / OpenAPI

### 3.3 Infrastructure & Deployment
- **Containerization:** Docker & Docker Compose
- **Web Server / Proxy:** Nginx (for Frontend hosting and reversing API traffic)
- **Package Manager:** npm / bun

## 4. Sub-Systems
As defined in the product vision, the architecture supports three conceptual sub-systems:
1.  **Question Bank System:** Curated, version-controlled repository of certification questions.
2.  **Simulation Engine:** Zero-distraction environment to simulate real exam scenarios.
3.  **Analytics & Intelligence:** Spaced repetition (SM-2) engine, and AI integrations (LLM configuration by user).
