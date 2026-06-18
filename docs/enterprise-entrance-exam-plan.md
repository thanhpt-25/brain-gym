# Enterprise Entrance Exam — Upgrade Plan (P0–P3)

> Upgrade the **Organization** feature into an enterprise solution that allows companies to create and manage **entrance exams** (for hiring, screening, and onboarding) for external candidates.

**Status:** Draft for review · **Author:** —  · **Date:** 2026-06-04

---

## 0. Context & Current State

Most of the platform infrastructure already exists. The "entrance exam" flow is implemented through the **Candidate Assessment** model set:

| Component | Location | Role |
|---|---|---|
| `Assessment` / `AssessmentQuestion` | [schema.prisma:1010](../backend/prisma/schema.prisma) | Org exam definition for external candidates |
| `CandidateInvite` / `CandidateAnswer` | [schema.prisma:1049](../backend/prisma/schema.prisma) | Email-based invite with token, submission, and score |
| Backend service | [assessments.service.ts](../backend/src/assessments/assessments.service.ts), [candidate.service.ts](../backend/src/assessments/candidate.service.ts) | CRUD, invite, results, CSV export; load/start/submit |
| Frontend admin | [AssessmentBuilder.tsx](../src/pages/org/AssessmentBuilder.tsx), [OrgAssessments.tsx](../src/pages/org/OrgAssessments.tsx), [AssessmentResults.tsx](../src/pages/org/AssessmentResults.tsx) | Exam creation, listing, results |
| Frontend candidate | `CandidateExam` / `CandidateResult` ([App.tsx:397](../src/App.tsx)) | Public exam page, no auth required |
| Question bank | `OrgQuestion` (workflow `DRAFT→UNDER_REVIEW→APPROVED→REJECTED`) | Org-specific question source |

**Already implemented:** automated scoring, `domainScores`, `passingScore`, funnel (invited→started→submitted→passed), question/answer randomization, `detectTabSwitch`, `blockCopyPaste`, `linkExpiryHours`, `tabSwitchCount`, `ipAddress`, CSV export.

**Still needed for real enterprise use:** smart exam creation via blueprint/pool, recruiting workflow (ATS-lite), recruiter role permissions, serious proctoring, real branded email delivery, reporting, and data compliance.

### Design Principles
- **Maximum reuse**: build on `Assessment`/`CandidateInvite`; do not create parallel data models.
- **Each phase deploys independently**, with its own migration, without breaking the current flow (backward-compatible defaults).
- Follow codebase conventions: TanStack Query for server state, Zustand for client state, loose TS (`strictNullChecks: false`), `org-role.guard.ts` for authorization.

---

## P0 — Smart Assessment Builder

> **Goal:** Allow automatic exam generation by domain-% blueprint or random pool draw, giving each candidate a different set of questions. Leverages the blueprint logic from #69/#70.

### User stories
- **US-P0-1** — As an org Admin, I choose the exam creation mode: *Manual* / *Blueprint by domain %* / *Random pool*, so I don't have to select questions individually.
- **US-P0-2** — As an Admin, with Blueprint I enter the total question count and domain percentages; the system draws from `OrgQuestion` records with status `APPROVED`.
- **US-P0-3** — As an Admin, with Pool I define a filter (certification, tags, difficulty) and draw count; **each candidate receives a different random set** drawn from the pool.
- **US-P0-4** — As an Admin, I see a warning if the pool or blueprint does not have enough available questions for the configuration.

### Data model (Prisma)
```prisma
enum AssessmentSelectionMode {
  MANUAL      // current behavior — fixed question list
  BLUEPRINT   // build one fixed exam by domain % at creation time
  POOL        // draw N random questions per candidate at startAttempt
}

model Assessment {
  // ... existing fields
  selectionMode AssessmentSelectionMode @default(MANUAL) @map("selection_mode")
  // Blueprint/pool configuration as JSON for flexibility:
  // BLUEPRINT: { totalQuestions, domains: [{ domain, percentage }], difficulty? }
  // POOL:      { drawCount, certificationId?, tags?: string[], difficulty?, domains?: [...] }
  selectionConfig Json? @map("selection_config")
}
```
- MANUAL/BLUEPRINT: questions are materialized via `AssessmentQuestion` (BLUEPRINT builds once at creation) — `candidate.service` is unchanged.
- POOL: questions are **not** materialized; `selectionConfig` is stored. `CandidateInvite` must save the drawn set for consistent reload:
```prisma
model CandidateInvite {
  // ...
  drawnQuestionIds String[] @default([]) @map("drawn_question_ids") // POOL: snapshot of drawn questions
}
```

### Backend
- `create-assessment.dto.ts`: add `selectionMode`, `selectionConfig` (validated per mode). When BLUEPRINT → service calls the domain-% allocation logic (extracted from Smart Exam Builder #70 into a shared helper, e.g. `blueprint.util.ts`), queries `OrgQuestion` where `status=APPROVED` for the org, draws questions, and writes `AssessmentQuestion` records.
- `candidate.service.ts › buildQuestionPayload` ([candidate.service.ts:214](../backend/src/assessments/candidate.service.ts)): if `selectionMode=POOL` and `invite.drawnQuestionIds` is empty → draw randomly from pool per `selectionConfig`, save to `drawnQuestionIds` (idempotent: subsequent calls reuse the snapshot).
- Validation: if available question count < requirement → throw `BadRequestException` (US-P0-4); a preview endpoint counts available questions for the UI.
- New endpoint (optional): `GET /orgs/:slug/assessments/pool-count?config=...` returns available question count.

### Frontend
- [AssessmentBuilder.tsx](../src/pages/org/AssessmentBuilder.tsx): add tab/segmented control for 3 modes. Reuse blueprint UI from Smart Exam Builder (domain % entry component) if already extracted; otherwise refactor into shared `BlueprintDomainEditor` component.
- Show "X/Y questions available" in real time; disable submit if count is insufficient.
- `assessment-types.ts` + `services/assessments.ts`: add `selectionMode`, `selectionConfig` to payload/types.

### Acceptance criteria
- [ ] Create a BLUEPRINT assessment with 20 questions (50% Domain A, 50% Domain B) → `AssessmentQuestion` contains exactly 10+10 APPROVED questions.
- [ ] Create a POOL assessment with drawCount=15 → two different candidates receive two different question sets; reloading the same token returns the same set.
- [ ] Configuration that exceeds available question count → clear error in UI, assessment not created.
- [ ] MANUAL mode preserves existing behavior (regression test).

---

## P1 — Recruiting Workflow (ATS-lite)

> **Goal:** Turn the list of candidate invites into a recruiting pipeline with job roles, stages, decisions, notes, and rankings.

### User stories
- **US-P1-1** — As a Recruiter, I attach each assessment to a **job role** to group candidates by position.
- **US-P1-2** — As a Recruiter, I view a candidate table with **score + percentile rankings**, filterable by stage and sortable.
- **US-P1-3** — As a Recruiter, I mark candidates as `SHORTLISTED / REJECTED / HIRED`, assign a star rating, and add internal notes.
- **US-P1-4** — As a Recruiter, I **import a candidate list from CSV** for bulk invitations.
- **US-P1-5** — As an Owner/Admin, I assign the **RECRUITER** role to members — they can only see assessments and candidates, not the question bank or settings.

### Data model
```prisma
enum OrgRole {
  OWNER
  ADMIN
  MANAGER
  RECRUITER   // new: assessments & candidates only
  MEMBER
}

enum CandidateStage {
  APPLIED
  SCREENING
  SHORTLISTED
  REJECTED
  HIRED
}

model JobRole {
  id          String   @id @default(uuid())
  orgId       String   @map("org_id")
  title       String
  department  String?
  description String?
  isActive    Boolean  @default(true) @map("is_active")
  createdAt   DateTime @default(now()) @map("created_at")
  organization Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)
  assessments  Assessment[]
  @@map("job_roles")
}

model Assessment {
  // ...
  jobRoleId String? @map("job_role_id")
  jobRole   JobRole? @relation(fields: [jobRoleId], references: [id])
}

model CandidateInvite {
  // ...
  stage         CandidateStage @default(APPLIED)
  rating        Int?           // 1..5, manual rating
  recruiterNote String?        @map("recruiter_note")
  decidedBy     String?        @map("decided_by")
  decidedAt     DateTime?      @map("decided_at")
}
```

### Backend
- New `job-roles` module (CRUD, guarded by ADMIN/OWNER).
- `org-roles.decorator.ts` + `org-role.guard.ts`: add `RECRUITER`; define permission matrix (RECRUITER allowed: list/get/create assessment, invite, results, update stage/rating/note; blocked: org settings, member admin, question bank writes).
- `candidate` / `assessment` service: endpoint `PATCH /assessments/:aid/candidates/:inviteId` (stage, rating, note), percentile calculation in `getResults`.
- Bulk import: `POST /assessments/:aid/invite` accepts an array from CSV (extends existing `inviteCandidates`, adds file/client-side parse support).

### Frontend
- [AssessmentResults.tsx](../src/pages/org/AssessmentResults.tsx): upgrade to full candidate table — columns for score, percentile, stage (badge), rating, action menu (shortlist/reject/hire), detail drawer with notes.
- Job Roles page/section within org; job role selector in AssessmentBuilder.
- CSV import dialog (client-side parse, preview, bulk submit).
- Hide question bank/settings navigation items when `myRole === 'RECRUITER'`.

### Acceptance criteria
- [ ] RECRUITER login sees only Assessments + Candidates; calling the question-bank write API → 403.
- [ ] Candidate table sorted correctly by score with percentile displayed.
- [ ] Stage change to REJECTED saves `decidedBy/decidedAt` and is reflected in the funnel.
- [ ] CSV import of 50 rows → creates 50 invites; invalid email rows are reported.

---

## P2 — Proctoring & Integrity

> **Goal:** Increase the reliability of entrance exams: anti-cheating, identity verification, and integrity scoring.

### User stories
- **US-P2-1** — As an Admin, I enable **mandatory fullscreen**; exiting fullscreen triggers a warning and logs the event.
- **US-P2-2** — As a candidate, I verify my email with an **OTP** before accessing the exam.
- **US-P2-3** — The system ensures **one token can only be used once** (prevents re-attempts and link sharing).
- **US-P2-4** — As a Recruiter, I see an **Integrity Score** plus an event timeline (tab switch, focus loss, copy, paste, abnormal time-per-question) for each candidate.

### Data model
- Reuse `AttemptEvent` ([schema.prisma:1087](../backend/prisma/schema.prisma)) for candidates (add `inviteId` link, or create a `CandidateEvent` table if `AttemptEvent` is tightly coupled to `ExamAttempt`).
```prisma
model Assessment {
  // ...
  requireFullscreen Boolean @default(false) @map("require_fullscreen")
  requireOtp        Boolean @default(false) @map("require_otp")
  maxAttempts       Int     @default(1)     @map("max_attempts")
}
model CandidateInvite {
  // ...
  integrityScore Int?     @map("integrity_score") // 0..100, computed automatically
  otpVerifiedAt  DateTime? @map("otp_verified_at")
}
```

### Backend
- `candidate.service.ts › startAttempt`: block if `status != INVITED` or already `SUBMITTED` (enforce single-attempt; partially exists — tighten with `maxAttempts`).
- OTP: `POST /candidate/:token/otp/request` (send code via email), `POST /candidate/:token/otp/verify`. Store hashed OTP + expiry (Redis is appropriate for TTL).
- `reportEvent` ([candidate.service.ts:182](../backend/src/assessments/candidate.service.ts)): expand event types (FULLSCREEN_EXIT, BLUR, COPY, PASTE, FAST_ANSWER). On submit, compute `integrityScore` = 100 − weighted penalty for violations.

### Frontend (CandidateExam)
- Fullscreen API: request fullscreen at exam start; listen for exit → show warning + call `reportEvent`.
- OTP screen before loading questions (when `requireOtp` is enabled).
- AssessmentResults: show Integrity Score (color badge) + event timeline in the candidate detail drawer.

### Acceptance criteria
- [ ] Reopening an already-SUBMITTED token → blocked, cannot re-attempt.
- [ ] `requireOtp` enabled: must enter correct OTP before accessing exam; expired OTP is rejected.
- [ ] Fullscreen exit logs an event and appears in the timeline.
- [ ] Integrity Score decreases with multiple tab-switches or copy events.

---

## P3 — Branding, Email & Compliance

> **Goal:** Professional candidate experience and data compliance for enterprise use.

### User stories
- **US-P3-1** — As a candidate, invitation/reminder/result emails carry the **org's brand** (logo, color, name) and are sent as **real emails**.
- **US-P3-2** — As a candidate, the exam page displays the org's logo and accent color.
- **US-P3-3** — As a Recruiter, I export a **PDF report** for an individual candidate's results.
- **US-P3-4** — As an Owner, candidate data complies with **GDPR retention/anonymization**: auto-delete or anonymize after N days; candidates can request deletion.
- **US-P3-5** — As an Admin, all actions on assessments are captured in an **audit log**.

### Backend
- Branded email service: templates (invite/reminder/results) using `org.logoUrl`/`accentColor`/`name`. Integrate a real email provider (Mailtrap for dev → Gmail/SES for prod, per [organization.md](organization.md)). Cron job for deadline reminders before `expiresAt`.
- Per-candidate PDF: render server-side (or client-side) from `getResults` for a single invite.
- Retention: cron job anonymizes `candidateEmail/candidateName/ipAddress` after `retentionDays` (org config); endpoint for candidate deletion requests.
- Audit log: reuse the existing audit system (`OrgAuditLog`) for create/update/status/invite/decision events on assessments.

### Frontend
- CandidateExam/CandidateResult: apply org branding (logo header, accent color).
- AssessmentResults: "Export PDF" button per candidate; retention configuration in OrgSettings.
- OrgAuditLog: display assessment-related events.

### Acceptance criteria
- [ ] Inviting a candidate → real email arrives in inbox (Mailtrap for dev) with org logo and color.
- [ ] Exporting a PDF for one candidate produces a valid file (score, domain breakdown, integrity).
- [ ] After `retentionDays`, candidate PII is anonymized; scores and aggregates are preserved.
- [ ] All assessment actions appear in the audit log.

---

## Priority & Dependency Summary

| Phase | Value | Effort | Dependencies | Migration |
|---|---|---|---|---|
| **P0** Smart Builder | ★★★ | Medium (reuses #70) | — | `selection_mode`, `selection_config`, `drawn_question_ids` |
| **P1** ATS-lite | ★★★ | Large | P0 recommended | `job_roles`, RECRUITER role, `CandidateInvite` fields |
| **P2** Proctoring | ★★ | Medium–Large | P1 (for integrity view) | proctoring + OTP fields |
| **P3** Branding/Compliance | ★★ | Medium | Email infra | retention, audit |

**Recommended ship order:** P0 → P1 → P2 → P3. P0 delivers immediate value at lowest risk (primarily reuses existing blueprint code).

### Risks & Notes
- **Question source:** Blueprint/Pool depends on having a sufficiently large pool of `APPROVED` `OrgQuestion` records per domain. Orgs need to build their question bank first (can be accelerated via the existing AI generation feature).
- **POOL snapshot:** `drawnQuestionIds` must be saved to prevent question sets from changing when a candidate reloads — handled in P0.
- **Token security:** P2's single-attempt enforcement + OTP is a prerequisite for using entrance exams in real hiring scenarios.
- **GDPR:** If serving candidates in the EU, P3 retention is mandatory, not optional.
- **Blueprint helper refactor:** The Smart Exam Builder (#70) blueprint logic must be extracted into a shared util before P0 to avoid duplication.
