# Exam Engine Documentation

**Last Updated:** 2026-05-01

## Overview

The Brain Gym exam engine orchestrates the complete exam-taking experience: from certification selection through exam completion, results, and scoring. It manages timed question presentations, answer tracking, mark-for-review functionality, domain-based scoring, and submission workflows.

**Key responsibilities:**

- Exam session lifecycle (intro → exam → results)
- Timer management (STRICT, ACCELERATED, RELAXED modes)
- Question randomization and presentation
- Answer capture and persistence
- Mark-for-review tracking
- Domain-based score breakdown
- Exam submission and result calculation

**Entry points:**

- Frontend: `/src/pages/ExamPage.tsx` (main orchestrator)
- Backend: `/backend/src/exams/exams.controller.ts`, `/backend/src/attempts/attempts.controller.ts`
- Database models: `ExamAttempt`, `Answer`, `Exam`, `Question`, `Choice` (Prisma schema)

---

## Architecture & State Machine

The exam engine progresses through distinct phases:

```
NOT_STARTED → INTRO → LOADING → EXAM → LOADING → RESULT
                ↑                 ↓
                └─────RETRY──────┘
```

### Phase Definitions

| Phase     | Description                                    | User Actions Available                   |
| --------- | ---------------------------------------------- | ---------------------------------------- |
| `intro`   | Certification and timer mode selection         | Select timer mode, start exam            |
| `loading` | Creating exam, starting attempt, or submitting | Spinner; no interaction                  |
| `exam`    | In-progress question-answering session         | Answer questions, navigate, mark, submit |
| `result`  | Displaying scores and domain breakdown         | Retry or return home                     |

### State Management (Client)

```typescript
// In ExamPage.tsx
const [phase, setPhase] = useState<ExamPhase>("intro");
const [attemptData, setAttemptData] = useState<StartAttemptResponse | null>(
  null,
);
const [answers, setAnswers] = useState<Record<string, string[]>>({}); // questionId → chosen choices
const [marked, setMarked] = useState<Set<string>>(new Set()); // marked question IDs
const [currentIndex, setCurrentIndex] = useState(0); // navigation pointer
const [timeLeft, setTimeLeft] = useState<number>(0); // countdown from timer hook
const [result, setResult] = useState<AttemptResult | null>(null); // submission results
```

### Attempt Data Shape (Server → Client)

```typescript
interface StartAttemptResponse {
  attemptId: string; // UUID for all future requests
  examId: string;
  title: string;
  certification: Certification; // includes domains
  timeLimit: number; // minutes
  timerMode?: TimerMode; // STRICT | ACCELERATED | RELAXED
  totalQuestions: number;
  questions: AttemptQuestion[]; // randomized, no correct answers revealed
}

interface AttemptQuestion {
  id: string;
  title: string;
  description?: string;
  questionType: "SINGLE" | "MULTIPLE";
  difficulty: "EASY" | "MEDIUM" | "HARD";
  domain?: { id: string; name: string };
  tags: string[];
  choices: { id: string; label: string; content: string }[]; // NO isCorrect
  sortOrder: number;
}
```

---

## Timer Modes

The exam supports three distinct timer modes, selected before exam start.

### 1. STRICT (Default)

**Behavior:**

- Full time pressure from start
- Pulsing red warning when < 5 min remain
- Countdown visible at all times
- Standard exam conditions

**Use case:** Mimic real cert exam timing

**UI feedback:**

- Timer displays in normal color until < 5 min
- At < 5 min: red text + pulse animation
- No alternate UI styling

### 2. ACCELERATED

**Behavior:**

- Aggressive time pressure; tests speed + accuracy under stress
- Orange banner alerts user of accelerated mode
- Milestone warnings at 75%, 50%, and 25% time remaining
- At 50% remaining: amber color with "Halfway through time" message
- At 25% remaining: destructive red + pulse
- More aggressive scoring penalty for slow answers

**Use case:** High-pressure exam simulation, time-intensive domains

**UI styling:**

```typescript
// ExamSession.tsx - getTimerClass()
function getTimerClass(
  timeLeft: number,
  totalSeconds: number,
  timerMode?: TimerMode,
): string {
  if (timerMode === "RELAXED") return "text-muted-foreground";
  if (timerMode === "ACCELERATED") {
    const ratio = totalSeconds > 0 ? timeLeft / totalSeconds : 1;
    if (ratio <= 0.25) return "text-destructive animate-pulse";
    if (ratio <= 0.5) return "text-orange-400";
    return "text-foreground";
  }
  // STRICT (default)
  return timeLeft < 300 ? "text-destructive animate-pulse" : "text-foreground";
}
```

### 3. RELAXED

**Behavior:**

- No time pressure; extended time available
- Timer ticks but does not trigger panic visuals
- Appropriate for learning/practice mode
- Muted timer color (secondary text)
- Never auto-submits; requires explicit submission

**Use case:** Review and practice; accessible exams

**UI feedback:**

- Timer displays in muted/secondary text color
- No warnings or pulsing
- Exam duration is extended (typically 2–3x normal)

### Timer Hook Implementation

```typescript
// useTimer.ts
export function useTimer({
  initialSeconds,
  onExpire,
  isActive,
}: UseTimerOptions) {
  const [timeLeft, setTimeLeft] = useState(initialSeconds);

  useEffect(() => {
    setTimeLeft(initialSeconds);
  }, [initialSeconds]);

  useEffect(() => {
    if (!isActive) return;
    const intervalId = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(intervalId);
          onExpire?.(); // Auto-submit on expire (STRICT/ACCELERATED)
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(intervalId);
  }, [isActive, onExpire]);

  return { timeLeft, setTimeLeft, formatTime };
}
```

**Footgun:** Timer is controlled via the `isActive` prop tied to `phase === 'exam'`. Setting phase to anything else pauses the timer. This is intentional for loading states but can trap state if not careful during error handling.

---

## Mark for Review

Mark-for-review (flag) allows users to revisit uncertain questions after initial pass.

### Data Shape

```typescript
const [marked, setMarked] = useState<Set<string>>(new Set());

// Toggle mark on current question
const toggleMark = (questionId: string) => {
  setMarked((prev) => {
    const next = new Set(prev);
    if (next.has(questionId)) next.delete(questionId);
    else next.add(questionId);
    return next;
  });
};
```

### Submission Payload

```typescript
// answers include isMarked flag
const payload = {
  answers: questions.map((q) => ({
    questionId: q.id,
    selectedChoices: answers[q.id] || [],
    isMarked: marked.has(q.id), // ← sent to server
  })),
};
```

### Storage

Marks are stored in the `Answer` model's `isMarked` boolean during submission (Prisma schema: `/backend/prisma/schema.prisma`, line 415).

**Known issue:** Client-side marks are not persisted mid-exam. If the user refreshes, marked flags reset. Consider implementing auto-save of marks if resumed exams are supported.

---

## Domain Breakdown

Domain scores aggregate correctness by certification domain (e.g., "Security", "Networking").

### Calculation (Server-side)

After submission, `attempts.service.ts` computes domain scores (lines 308–346):

```typescript
private evaluateAnswers(
  attemptId: string,
  dto: SubmitAttemptDto,
  examQuestions: { question: QuestionWithChoices }[]
) {
  const domainScores: Record<string, { correct: number; total: number }> = {};
  let totalCorrect = 0;
  const answerRecords: Prisma.AnswerCreateManyInput[] = [];

  for (const eq of examQuestions) {
    const q = eq.question;
    const submitted = dto.answers.find(a => a.questionId === q.id);
    const selectedChoices = submitted?.selectedChoices ?? [];
    const correctChoiceIds = q.choices
      .filter((c) => c.isCorrect)
      .map((c) => c.id);

    const isCorrect =
      correctChoiceIds.length === selectedChoices.length &&
      correctChoiceIds.every((id: string) => selectedChoices.includes(id));

    if (isCorrect) totalCorrect++;

    const domainName = q.domain?.name ?? 'Unknown';
    if (!domainScores[domainName])
      domainScores[domainName] = { correct: 0, total: 0 };
    domainScores[domainName].total++;
    if (isCorrect) domainScores[domainName].correct++;

    answerRecords.push({
      attemptId,
      questionId: q.id,
      selectedChoices,
      isCorrect,
      isMarked: submitted?.isMarked ?? false,
    });
  }

  return { totalCorrect, domainScores, answerRecords };
}
```

### Response Shape

```typescript
interface AttemptResult {
  ...
  domainScores: Record<string, { correct: number; total: number }>;
  // Example: { "Security": { correct: 8, total: 10 }, "Networking": { correct: 6, total: 8 } }
  ...
}
```

**Footgun:** Domains with 0 questions will not appear in domainScores. Unknown domains (null domain_id in question) are grouped under 'Unknown'. Be careful with inner joins when querying domains.

---

## Autosave & Persistence

### Client-side Answer Tracking

Answers are **not** persisted to server during the exam. All answers remain in local state until submission:

```typescript
// In ExamPage.tsx (lines 111–126)
const selectAnswer = (questionId: string, choiceId: string) => {
  setAnswers((prev) => {
    const current = prev[questionId] || [];
    const question = questions.find((q) => q.id === questionId);
    const isMultiple = question?.questionType === "MULTIPLE";
    if (isMultiple) {
      return {
        ...prev,
        [questionId]: current.includes(choiceId)
          ? current.filter((id) => id !== choiceId)
          : [...current, choiceId],
      };
    }
    return { ...prev, [questionId]: [choiceId] };
  });
};
```

### Server-side Answer Persistence

The backend **does not** provide a mid-exam save endpoint for learners. All answers are written to the database **only** on explicit submit via POST `/attempts/{id}/submit`.

---

## Submission Flow

### Step-by-step

1. **User clicks Submit button** (`ExamPage.tsx`, lines 55–73)

   ```typescript
   const handleSubmit = useCallback(async () => {
     if (!attemptData) return;
     setPhase("loading");
     try {
       const payload = {
         answers: questions.map((q) => ({
           questionId: q.id,
           selectedChoices: answers[q.id] || [],
           isMarked: marked.has(q.id),
         })),
       };
       const res = await submitAttempt(attemptData.attemptId, payload);
       setResult(res);
       setPhase("result");
     } catch (err: unknown) {
       toast.error("Failed to submit exam");
       setPhase("exam");
     }
   }, [attemptData, answers, questions, marked]);
   ```

2. **Backend receives submit request** (`attempts.controller.ts`, lines 57–71)
   - `POST /api/v1/attempts/{id}/submit`
   - JWT guard verifies user ownership of attempt
   - Throttle: rate-limited per-user (5 req/min)

3. **Server evaluates all answers** (`attempts.service.ts`, lines 152–224)
   - Fetches exam + all questions + correct choices
   - Compares submitted answers to correct choices
   - Builds domain breakdown via `evaluateAnswers()`
   - Calculates percentage score

4. **Atomic transaction**
   - Delete old answers (if resubmitting)
   - Insert fresh Answer records
   - Update ExamAttempt with `status: SUBMITTED`, `score`, `domainScores`, `timeSpent`
   - Increment exam's attempt count

5. **Awards + Stats**
   - Gamification: Award points (COMPLETE_EXAM)
   - Update exam's average score

6. **Response to client**
   - Return `AttemptResult` with all metadata
   - Client sets `result` state and shows results page

---

## Key Data Shapes

### Answer Record

```typescript
// Client submits:
interface SubmitAnswerPayload {
  questionId: string;
  selectedChoices: string[];      // choice IDs for SINGLE or MULTIPLE
  isMarked?: boolean;
}

// Server stores (Prisma schema, lines 409–424):
model Answer {
  id              String    @id
  attemptId       String
  questionId      String
  selectedChoices String[]          // JSON array of choice IDs
  isCorrect       Boolean?          // null until graded
  isMarked        Boolean  @default(false)
  timeSpent       Int?              // seconds (planned)
  answeredAt      DateTime
  mistakeType     MistakeType?      // CONCEPT | CARELESS | TRAP | TIME_PRESSURE
}
```

### ExamAttempt Record

```prisma
// Prisma schema, lines 388–407
model ExamAttempt {
  id             String        @id
  userId         String
  examId         String
  startedAt      DateTime
  submittedAt    DateTime?
  timeSpent      Int?
  score          Decimal?
  totalCorrect   Int?
  totalQuestions Int?
  domainScores   Json?         // { "Domain": { correct: n, total: m }, ... }
  status         AttemptStatus // IN_PROGRESS | SUBMITTED | ABANDONED
}
```

---

## Known Footguns & Edge Cases

1. **Timer State Coupling:** Timer is tied to `phase === 'exam'`. If an error occurs mid-exam and phase is set to 'loading', the timer pauses. Always reset timer state when exiting exam.

2. **Question Randomization Not Persisted:** Questions are shuffled during `/start`, but shuffled order is not stored. On submit, answers matched by questionId, not order.

3. **Mark-for-Review Not Persisted Mid-Exam:** Marks saved only on final submit. Refresh = loss of marks. Implement local storage or periodic flush if resumed exams supported.

4. **No Partial Credit:** Scoring binary: correct or incorrect. No partial credit for partial correctness in MULTIPLE choice.

5. **Choice Randomization Not Stored:** Choices shuffled per-exam per-user, order not stored. On results, choice content shown is current, not necessarily label user saw.

6. **Domain Aggregation Null-Safety:** Questions without domain grouped under 'Unknown'. Handle gracefully in results UI.

7. **Attempt Status Transitions Not Enforced:** Code checks `status !== IN_PROGRESS` before submit, but no explicit state machine enforcement.

---

## How to Extend

### Adding a New Timer Mode

1. Update Prisma enum (`backend/prisma/schema.prisma`, line 91–95)
2. Update TypeScript type (`src/types/api-types.ts`)
3. Add timer styling logic (`src/components/exam/ExamSession.tsx`, `getTimerClass()`)
4. Update intro UI with radio option (`src/components/exam/ExamIntro.tsx`)
5. Test timer logic, UI styling, submission under new mode

### Adding a New Question Type

1. Update Prisma enum (`backend/prisma/schema.prisma`, line 31–34)
2. Update frontend types (`src/types/api-types.ts`)
3. Update answer selection logic (`src/pages/ExamPage.tsx`, `selectAnswer()`)
4. Update backend evaluation (`backend/src/attempts/attempts.service.ts`, `evaluateAnswers()`)
5. Add UI component for new question type (`src/components/exam/ExamSession.tsx`)
6. Write unit tests on evaluation, E2E on submission flow

---

## References

- Frontend main: `/src/pages/ExamPage.tsx`
- Frontend components: `/src/components/exam/`
- Frontend hooks: `/src/hooks/useTimer.ts`, `/src/hooks/useTextSelection.ts`
- Backend controller: `/backend/src/attempts/attempts.controller.ts`
- Backend service: `/backend/src/attempts/attempts.service.ts`
- Database models: `/backend/prisma/schema.prisma`
- API types: `/src/types/api-types.ts`
- Services: `/src/services/attempts.ts`, `/src/services/exams.ts`

---

**Document Status:** Ready for pair review and knowledge transfer. See Sprint 3 plan (US-305) for 60-minute pair tour schedule.
