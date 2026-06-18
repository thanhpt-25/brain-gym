# 04 - Frontend Structure

The CertGym frontend is a React SPA compiled by Vite and served by Nginx in production. This document covers the actual file layout, routing, state model, and HTTP layer as they exist in the codebase.

## 1. Technology Stack

| Concern | Library | Version |
|---------|---------|---------|
| Framework | React | 18.3 |
| Build tool | Vite (SWC plugin) | 5.4 |
| Language | TypeScript | 5.8 |
| Routing | React Router DOM | 6.30 |
| Server state | TanStack Query (`@tanstack/react-query`) | 5.83 |
| Client state | Zustand | 5.0 |
| UI primitives | shadcn/ui (Radix UI) | — |
| Styling | Tailwind CSS | 3.4 |
| Animations | Framer Motion | 12 |
| Forms | React Hook Form + Zod | 7 / 3 |
| HTTP client | Axios | 1.13 |
| Theme | next-themes (dark mode) | — |

TypeScript is configured with `noImplicitAny: false` and `strictNullChecks: false`. Do not add stricter annotations than what is already present.

## 2. Directory Structure (`src/`)

```
src/
├── App.tsx                  # Root: QueryClientProvider, BrowserRouter, AnimatedRoutes
├── main.tsx                 # ReactDOM.createRoot entry point
├── components/
│   ├── admin/               # AdminDdsAutoApplyPanel, DdsVariantReview
│   ├── ai-questions/        # GeneratedQuestionsReview, GenerationForm, LlmConfigPanel, MaterialLibrary
│   ├── auth/                # GoogleLoginButton
│   ├── coach/               # Coach, CoachSession, CoachLockState, SessionReplayModal
│   ├── dashboard/           # ScoreTrendChart, WeakTopicsChart, MistakePatternChart, ReadinessScore,
│   │                        #   BenchmarkPanel, FlashcardStatsPanel, LlmCostPanel, ExamHistoryList,
│   │                        #   BurnoutIndicator, WeeklyDigestBanner
│   ├── exam/                # ExamIntro, ExamSession, ExamResult, BlueprintEditor, WordCaptureTooltip
│   ├── knowledge-graph/     # GraphCanvas, NodeDrillDown, StudyPlan
│   ├── mastery/             # MasteryHero, ReadinessGauge, DomainBentoCard, DomainBreakdownDrawer,
│   │                        #   NextTopicCard, BehavioralInsightBanner, PassLikelihoodSurveyBanner,
│   │                        #   ReadinessFormulaPopover
│   ├── org/                 # OrgLayout, OrgSidebar, AssessmentFunnel, CandidateRanking,
│   │                        #   CloneQuestionDialog, CsvImportModal, InviteCandidatesModal,
│   │                        #   MemberAnalyticsCard, ReadinessHeatmap, SkillGapChart,
│   │                        #   EngagementChart, SmartFillDialog
│   ├── questions/           # LivePreview
│   ├── scenario/            # ScenarioReader, ScenarioDiagram, ScenarioPassage, ScenarioTimer,
│   │                        #   ScenarioQuestionSidebar, ScenarioLeaderboard
│   ├── squads/              # SquadMemberCard, SquadMemberList, SquadReputationLeaderboard,
│   │                        #   PeerReviewChallenge, ReadinessCard, EmptyState
│   ├── training/            # HubView, ModeCard, PracticeSession, DailyReviewMode,
│   │                        #   FlashcardReviewMode, WeaknessMode
│   ├── ui/                  # shadcn/ui primitives (Button, Input, Dialog, Table, etc.) + MarkdownContent
│   ├── BottomTabBar.tsx
│   ├── Breadcrumb.tsx
│   ├── CapturedWordsQueue.tsx
│   ├── CertificationCard.tsx
│   ├── ErrorBoundary.tsx
│   ├── Navbar.tsx
│   ├── PageSkeleton.tsx
│   ├── PageTransition.tsx   # Framer Motion wrapper applied to every route
│   ├── ProtectedRoute.tsx   # Redirects to /auth if not authenticated
│   └── ScrollToTop.tsx
├── hooks/
│   └── use-mobile.tsx
├── lib/                     # shadcn/ui cn() utility
├── pages/
│   ├── admin/               # AdminDashboard, UsersTab, QuestionsTab, ExamsTab, CertificationsTab,
│   │                        #   DomainsTab, ProvidersTab, TagsTab, BadgesTab, ModerationTab,
│   │                        #   ReportsTab, AuditLogTab, AiGenerationTab, OrganizationsTab,
│   │                        #   ReputationTab — composed into admin/index.tsx
│   ├── org/                 # OrgSelector, OrgDashboard, OrgMembers, OrgSettings, CreateOrg,
│   │                        #   OrgJoin, OrgAcceptInvite, OrgQuestionBank, OrgQuestionForm,
│   │                        #   OrgQuestionDetail, OrgExamCatalog, OrgCatalogManage,
│   │                        #   OrgCatalogBuilder, OrgCatalogPreview, OrgLearningTracks,
│   │                        #   OrgAssessments, AssessmentBuilder, AssessmentResults,
│   │                        #   OrgJobRoles, OrgCompetencies, OrgAnalytics, OrgAuditLog
│   ├── Dashboard/
│   │   └── MasteryPage.tsx
│   ├── AiQuestionGenerator.tsx
│   ├── Auth.tsx
│   ├── CandidateExam.tsx
│   ├── CandidateResult.tsx
│   ├── CoachAnalytics.tsx
│   ├── Dashboard.tsx
│   ├── DeckDetail.tsx
│   ├── ExamBuilder.tsx
│   ├── ExamLibrary.tsx
│   ├── ExamPage.tsx
│   ├── ExamResults.tsx
│   ├── ExamShare.tsx
│   ├── FlashcardDecks.tsx
│   ├── FlashcardStudy.tsx
│   ├── Index.tsx
│   ├── KnowledgeGraph.tsx
│   ├── Leaderboard.tsx
│   ├── MyExams.tsx
│   ├── NotFound.tsx
│   ├── Profile.tsx
│   ├── QuestionDetail.tsx
│   ├── QuestionForm.tsx
│   ├── QuestionsBrowser.tsx
│   ├── ScenarioExam.tsx
│   ├── ScenarioResults.tsx
│   ├── SquadDashboard.tsx
│   ├── StudyMode.tsx
│   ├── TrainingHub.tsx
│   └── TrapQuestionsPage.tsx
├── services/
│   ├── api.ts               # Shared Axios instance + interceptors
│   └── ...                  # Domain-specific API functions
├── stores/
│   ├── auth.store.ts
│   ├── org.store.ts
│   └── streak.store.ts
├── styles/
├── test/
├── types/
└── utils/
```

## 3. Routing

All routes are defined in `src/App.tsx`. Every page component is lazy-loaded via `React.lazy()` and wrapped in `<PageTransition>` (Framer Motion). `<AnimatePresence mode="wait">` drives page exit/enter animations keyed by `location.pathname`.

`<ProtectedRoute>` checks `useAuthStore.isAuthenticated`. If false, it redirects to `/auth` and saves the intended destination for post-login redirect.

### Public routes

| Path | Page |
|------|------|
| `/` | `Index` — landing page |
| `/auth` | `Auth` — login / registration |
| `/questions` | `QuestionsBrowser` |
| `/questions/:id` | `QuestionDetail` |
| `/trap-questions` | `TrapQuestionsPage` |
| `/exams` | `ExamLibrary` |
| `/exams/share/:shareCode` | `ExamShare` |
| `/exams/:id` | `ExamShare` |
| `/exam-results` | `ExamResults` |
| `/leaderboard` | `Leaderboard` |
| `/training` | `TrainingHub` |
| `/study/:certId` | `StudyMode` |
| `/org/join/:code` | `OrgJoin` |
| `/assess/:token` | `CandidateExam` — token-gated, no login required |
| `/assess/:token/result` | `CandidateResult` |

### Protected routes (require authentication)

| Path | Page |
|------|------|
| `/dashboard` | `Dashboard` |
| `/dashboard/mastery/:certId` | `MasteryPage` |
| `/coach/analytics` | `CoachAnalytics` |
| `/exam/:certId` | `ExamPage` |
| `/exams/create` | `ExamBuilder` |
| `/exams/mine` | `MyExams` |
| `/exams/:id/edit` | `ExamBuilder` |
| `/decks` | `FlashcardDecks` |
| `/decks/:deckId` | `DeckDetail` |
| `/decks/:deckId/study` | `FlashcardStudy` |
| `/admin` | `AdminPage` |
| `/ai-generate` | `AiQuestionGenerator` |
| `/squads/:slug` | `SquadDashboard` |
| `/scenarios/:id` | `ScenarioExam` |
| `/scenarios/:id/results` | `ScenarioResults` |
| `/knowledge-graph` | `KnowledgeGraph` |
| `/profile` | `Profile` |
| `/org` | `OrgSelector` |
| `/org/create` | `CreateOrg` |
| `/org/accept-invite/:token` | `OrgAcceptInvite` |
| `/questions/new` | `QuestionForm` |

### Organization nested routes (`/org/:slug` — protected)

Rendered inside `<OrgLayout>` (persistent sidebar + outlet):

| Sub-path | Page |
|----------|------|
| *(index)* | `OrgDashboard` |
| `members` / `groups` | `OrgMembers` |
| `questions` | `OrgQuestionBank` |
| `questions/new` | `OrgQuestionForm` |
| `questions/:questionId` | `OrgQuestionDetail` |
| `questions/:questionId/edit` | `OrgQuestionForm` |
| `catalog` | `OrgExamCatalog` |
| `catalog/manage` | `OrgCatalogManage` |
| `catalog/create` | `OrgCatalogBuilder` |
| `catalog/:cid` / `catalog/:cid/preview` | `OrgCatalogPreview` |
| `catalog/:cid/edit` | `OrgCatalogBuilder` |
| `tracks` | `OrgLearningTracks` |
| `assessments` | `OrgAssessments` |
| `assessments/create` | `AssessmentBuilder` |
| `assessments/:aid` | `AssessmentResults` |
| `assessments/:aid/edit` | `AssessmentBuilder` |
| `job-roles` | `OrgJobRoles` |
| `competencies` | `OrgCompetencies` |
| `analytics` | `OrgAnalytics` |
| `settings` | `OrgSettings` |
| `settings/audit` | `OrgAuditLog` |

## 4. State Management

### 4.1 Server State — TanStack Query

All server data is fetched and cached through TanStack Query (`useQuery` / `useMutation`). Zustand is never used to store server-fetched data. The global `QueryClient` is created once in `App.tsx` with `retry: 1` and `refetchOnWindowFocus: false`.

```tsx
const { data, isLoading } = useQuery({
  queryKey: ["questions", certId],
  queryFn: () => getQuestions(certId),
  enabled: !!certId,
});
```

### 4.2 Client State — Zustand Stores

Three stores are persisted to `localStorage` via the `zustand/middleware` `persist` middleware:

**`useAuthStore`** (`auth-storage`)

| Field | Type | Description |
|-------|------|-------------|
| `user` | `User \| null` | Includes `id`, `email`, `displayName`, `role`, `plan`, `orgMemberships`, `featureFlags` |
| `accessToken` | `string \| null` | JWT attached as `Authorization: Bearer` on every API request |
| `refreshToken` | `string \| null` | Used to obtain a new access token on 401 |
| `isAuthenticated` | `boolean` | Checked by `<ProtectedRoute>` |

Actions: `setAuth(user, accessToken, refreshToken)`, `logout()` (also calls `useOrgStore.clearOrg()`).

**`useOrgStore`** (`org-storage`)

| Field | Type | Description |
|-------|------|-------------|
| `currentOrg` | `OrganizationWithRole \| null` | Active org context (persisted) |
| `myOrgs` | `OrganizationWithRole[]` | All orgs the user belongs to (session only, not persisted) |

Actions: `setCurrentOrg`, `setMyOrgs`, `clearOrg`.

**`useStreakStore`** (`certgym-streak-storage`)

| Field | Type | Description |
|-------|------|-------------|
| `currentStreak` | `number` | Consecutive days active |
| `longestStreak` | `number` | All-time best streak |
| `lastActiveDate` | `string` | ISO date `YYYY-MM-DD` |
| `totalDaysActive` | `number` | Lifetime active day count |

Actions: `recordActivity()`, `checkStreak()`. Also exposes module-level shims `recordActivity()` and `getStreakData()` for backward compatibility.

## 5. HTTP Layer (`src/services/api.ts`)

A single Axios instance is created with:
- `baseURL`: `VITE_API_BASE_URL` env var, falling back to `/api/v1`
- `timeout`: 30 000 ms

**Request interceptor** — reads `accessToken` from `useAuthStore` and injects `Authorization: Bearer <token>` on every request.

**Response interceptor** — two responsibilities:
1. Rejects responses with `Content-Type: text/html` (catches the SPA fallback served when the backend is down).
2. On HTTP 401, attempts a token refresh by calling `POST /api/v1/auth/refresh` directly (bypassing the interceptor to avoid an infinite loop). On success, updates the auth store and retries the original request. On failure, calls `logout()`.

## 6. Key Page Descriptions

| Page | Notes |
|------|-------|
| `ExamPage` | Full exam simulation: timer (strict / lenient modes), mark-for-review, per-domain breakdown |
| `FlashcardStudy` | SM-2 scheduling; mastery levels: NEW → LEARNING → REVIEW → MASTERED |
| `AiQuestionGenerator` | Submits a generation job via BullMQ; polls job status; review and publish flow |
| `MasteryPage` | Per-certification domain mastery heat map, readiness gauge, pass-likelihood survey |
| `KnowledgeGraph` | Force-directed topic graph with drill-down and suggested study plan |
| `ScenarioExam` | Case-study style exam with passage reader and multi-question sidebar |
| `AdminPage` | Tabbed admin dashboard: users, questions, exams, certifications, moderation, audit log, AI usage |
| `OrgLayout` | Persistent sidebar shell for all `/org/:slug/*` routes |
