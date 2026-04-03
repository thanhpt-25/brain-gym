# 04 - Frontend Structure

The Brain Gym frontend is a heavily interactive Single Page Application (SPA) designed to act as an immersive "Simulation Engine".

## 1. Technologies used
- **Core Platform:** React 18 & Vite
- **Type Safety:** TypeScript
- **Router:** React Router v6
- **Styling:** Tailwind CSS + PostCSS
- **Component Primitives:** shadcn/ui (Radix UI under the hood)
- **Data Fetching & Cache:** TanStack React Query (`react-query`)
- **Global State:** Zustand
- **Animations:** Framer Motion

## 2. Directory Architecture (`src/`)

```
src/
├── components/       # Reusable UI elements
│   ├── dashboard/    # Dashboard widgets
│   ├── exam/         # Simulation engine controls (Timer, question navigators)
│   ├── questions/    # Question cards, option selectors
│   ├── ui/           # Generic Shadcn primitives (Buttons, Inputs, Dialogs)
│   └── ...           # Shared layout components (Navbar, Sidebar)
├── pages/            # Routable top-level components
├── hooks/            # Custom reusable logic (e.g., useTimer, useSpacedRepetition)
├── lib/              # Utility configurations (e.g., shadcn utils)
├── services/         # API abstraction layer (Axios clients mapped by domain)
├── stores/           # Zustand store instances (auth.store, streak.store)
├── types/            # TypeScript interfaces
├── utils/            # Pure helper formatting functions
├── App.tsx           # Router and root Providers
└── main.tsx          # React DOM mounting
```

## 3. Data & State Flow

### 3.1 Server State (React Query)
We rely entirely on TanStack React Query for interacting with our NestJS API.
- Caches remote lists (Questions, Exams).
- Refetches on window focus.
- Mutates data optimistically where responsive UX requires it.

### 3.2 Global Client State (Zustand)
Used extremely selectively:
- **`useAuthStore`**: Stores JWTs to be intercepted by Axios, keeps user identity context available site-wide.
- **`useStreakStore`**: Immediate tracking of daily consistency without heavy backend round-trips.

## 4. Component Paradigms

### Design Language
- **Aesthetic:** High-performance, distraction-free 'Brain Gym'.
- **Themes:** Heavy reliance on "dark mode," glassmorphism, glowing cyan highlights (`bg-background`, `border-primary`).
- **Typography:** Monospaced components used appropriately to reflect technical examination formats.

### Routing Mechanism
`App.tsx` handles full-page configurations via `<AnimatePresence>` for smooth structural page transitions. All heavy routes are dynamically imported via `React.lazy()` to optimize the application's bundle sizes.

We utilize `<ProtectedRoute>` wrapper components around strict internal domains (like Dashboard, Exam Simulation, Flashcards) checking the `useAuthStore()` validity.

## 5. Services Layer
The `src/services/api.ts` houses an Axios instance that centralizes HTTP interceptors. It seamlessly intercepts 401 Unauthorized API responses and coordinates background token rotation via the backend `/auth/refresh` endpoint without disrupting the user flow.
