# Candidate Assessment

The candidate assessment feature lets org staff create timed technical assessments, invite external candidates by email, and track results through a recruiting pipeline — without requiring candidates to have a platform account.

---

## Assessment Lifecycle

An assessment moves through the following states (enum `AssessmentStatus`):

```
DRAFT → ACTIVE → CLOSED → ARCHIVED
```

| State | Meaning |
|-------|---------|
| `DRAFT` | Being configured; editable; candidates cannot be invited |
| `ACTIVE` | Published; candidates can be invited and may take the exam |
| `CLOSED` | No new invites accepted; results are read-only |
| `ARCHIVED` | Soft-archived; excluded from active views |

Only OWNER and ADMIN roles may change assessment status. An assessment cannot be activated if it has no questions (or, for POOL mode, no valid `drawCount`). Only DRAFT assessments may be edited.

---

## Assessment Configuration

Key fields on the `Assessment` model:

| Field | Type | Notes |
|-------|------|-------|
| `title` | `String` | Display name |
| `description` | `String?` | Optional summary shown to candidates |
| `timeLimit` | `Int` | Duration in minutes; enforced server-side with a 30-second grace period |
| `passingScore` | `Int?` | Minimum percentage score to pass; optional |
| `selectionMode` | `AssessmentSelectionMode` | `MANUAL`, `BLUEPRINT`, or `POOL` |
| `selectionConfig` | `Json?` | Blueprint or pool configuration (see below) |
| `questionCount` | `Int` | Total questions drawn or selected |
| `randomizeQuestions` | `Boolean` (default true) | Shuffle question order per candidate |
| `randomizeChoices` | `Boolean` (default true) | Shuffle answer choices per question |
| `maxAttempts` | `Int` (default 1) | Maximum submissions per candidate email |
| `linkExpiryHours` | `Int` (default 72) | Hours until an invite token expires |
| `jobRoleId` | `String?` | Optional link to a job role for gap analysis |

**Selection modes:**

- `MANUAL` — questions are specified explicitly at creation time.
- `BLUEPRINT` — questions are drawn from the org question bank by domain percentages. `selectionConfig` shape: `{ totalQuestions, domains: [{ domain, percentage }], difficulty?, certificationId? }`. Domain percentages must sum to 100.
- `POOL` — questions are drawn randomly per candidate when they start. `selectionConfig` shape: `{ drawCount, certificationId?, difficulty?, categories?: string[], tags?: string[] }`. Each candidate gets a unique draw, snapshotted on `CandidateInvite.drawnQuestionIds` to support idempotent resume.

**Anti-cheat flags:**

| Field | Default | Effect |
|-------|---------|--------|
| `detectTabSwitch` | false | Reports TAB_SWITCH events; increments `tabSwitchCount` |
| `blockCopyPaste` | false | Reports COPY/PASTE events |
| `requireFullscreen` | false | Reports FULLSCREEN_EXIT events |
| `requireOtp` | false | Candidate must verify a 6-digit email OTP before starting |

---

## Candidate Token Flow

Each invited candidate receives a unique opaque UUID token by email. All public endpoints are under `POST|GET /api/v1/assessments/take/:token` and require no authentication.

1. **Load** — `GET /assessments/take/:token`
   Returns assessment metadata and current invite status. The token is validated and checked for expiry on every call.

2. **OTP request** (if `requireOtp: true`) — `POST /assessments/take/:token/otp/request`
   Generates a 6-digit code, stores its SHA-256 hash in Redis with a 10-minute TTL, and emails the code to the candidate. Rate-limited to 5 requests per 10 minutes per IP.

3. **OTP verify** (if `requireOtp: true`) — `POST /assessments/take/:token/otp/verify` with `{ code }`
   Compares the submitted code against the stored hash using timing-safe comparison. Locks the account for 1 hour after 5 failed attempts. On success, sets `otpVerifiedAt`. Rate-limited to 10 attempts per 10 minutes per IP.

4. **Start** — `POST /assessments/take/:token/start`
   Transitions status from `INVITED` to `STARTED`. Records `startedAt` and client IP. Guards: OTP must be verified if required; prior submitted attempt count must be below `maxAttempts`. For POOL mode, draws and snapshots `drawnQuestionIds` atomically (conditional UPDATE prevents race conditions on concurrent starts). Calling start on an already-`STARTED` invite resumes the session and returns the same question set.

5. **Report event** (optional, during exam) — `POST /assessments/take/:token/event` with `{ eventType, clientTs?, payload? }`
   Records integrity-relevant browser events (`TAB_SWITCH`, `FULLSCREEN_EXIT`, `COPY`, `PASTE`). Client-supplied timestamps are clamped to ±1 hour of server time.

6. **Submit** — `POST /assessments/take/:token/submit` with answers
   Validates that the time limit has not been exceeded. Scores all answers (exact multi-choice match required for correctness), computes `domainScores`, calculates `integrityScore`, and persists results atomically. Returns `{ score, totalCorrect, totalQuestions, passed, timeSpent, integrityScore }`.

---

## Anti-Cheat Mechanisms

The following controls are implemented in the service layer:

- **Tab-switch detection** — `detectTabSwitch: true` causes the frontend to report `TAB_SWITCH` events. Each event increments `CandidateInvite.tabSwitchCount`.
- **Copy/paste blocking** — `blockCopyPaste: true` causes COPY and PASTE events to be reported.
- **Fullscreen enforcement** — `requireFullscreen: true` causes FULLSCREEN_EXIT events to be reported.
- **OTP identity check** — `requireOtp: true` requires email-based OTP verification before the exam starts.
- **Integrity score** — computed at submission time from the event log: starts at 100, subtracts up to 40 points for tab switches (5 per switch), up to 30 for fullscreen exits (3 per exit), and 15 if any copy/paste occurred. Stored as `CandidateInvite.integrityScore` (0–100).
- **Time limit enforcement** — the server rejects submissions arriving more than 30 seconds after the time limit.
- **Max attempts** — enforced server-side per candidate email.
- **IP address logging** — client IP is recorded at `startAttempt` time.

---

## Bulk Invite CSV Format

`POST /organizations/:orgId/assessments/:aid/candidates/bulk-csv` accepts a `{ csv: string }` body (max 2 MB, up to 1000 data rows).

Required header column: `email`. Optional column: `name` or `candidateName`. Extra columns are ignored.

Example:
```
email,name
alice@example.com,Alice Smith
bob@example.com,Bob Jones
```

- Emails are normalized to lowercase and validated structurally.
- Duplicate emails within the file are deduplicated (first occurrence kept).
- Emails already invited to the same assessment are skipped (not re-invited).
- Bulk CSV invites do not send invitation emails; use the single invite endpoint for email delivery.
- Response: `{ created, skipped, errors: [{ row, email, reason }] }`.

---

## Results and Ranking

`GET /organizations/:orgId/assessments/:aid/results?filter=<value>` returns the full candidate list with a computed percentile rank for each submitted candidate.

Filter options:

| `filter` value | Returns |
|----------------|---------|
| (none) | All invites |
| `submitted` | Only submitted invites |
| `passed` | Submitted invites with score >= `passingScore` |
| `shortlisted` | Submitted invites with `stage = SHORTLISTED` |

Candidates are ordered by score descending, then creation date ascending. Percentile is calculated as the fraction of other submitted candidates scored below the given candidate (0–100).

**Recruiter actions** — `PATCH /organizations/:orgId/assessments/:aid/candidates/:inviteId` allows updating:
- `stage` — `APPLIED`, `SCREENING`, `SHORTLISTED`, `REJECTED`, or `HIRED`
- `rating` — integer 1–5
- `recruiterNote` — free-text internal comment

Stage transitions to `HIRED`, `REJECTED`, or `SHORTLISTED` record `decidedBy` and `decidedAt` automatically.

**CSV export** — `GET /organizations/:orgId/assessments/:aid/results/export` (OWNER/ADMIN only) returns a CSV with columns: Name, Email, Attempt Status, Stage, Score (%), Percentile, Total Correct, Total Questions, Rating, Time Spent (s), Tab Switches, Started At, Submitted At, Recruiter Note.

---

## Frontend Routes

| Path | Component | Notes |
|------|-----------|-------|
| `/assessments/take/:token` | `src/pages/CandidateExam.tsx` | Public exam-taking page |
| `/assessments/take/:token/result` | `src/pages/CandidateResult.tsx` | Result page shown after submission |

Both pages are public (no login required) and accessed via the invite token link.
