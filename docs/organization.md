# Organization Features — Reference

CertGym's organization system enables companies to manage teams, run private question banks, assess external candidates, and track competency levels. Organization features are gated by the creator's `UserPlan`.

> For REST endpoint signatures see [API Design](./03-api_design.md).

---

## Plan-Based Access Control

Plans are **admin-managed only** — there is no self-service upgrade. A platform admin sets a user's plan via `PATCH /admin/users/:userId/plan`.

| Capability | FREE | PREMIUM | ENTERPRISE | ADMIN |
|:-----------|:----:|:-------:|:----------:|:-----:|
| Create organization (as owner) | No | Max 1 | Max 3 | Unlimited |
| Join org via email invite | Yes | Yes | Yes | Yes |
| Join org via join link | No | Yes | Yes | Yes |
| Max seats per owned org | — | 10 | 50 | 100 |
| Access org analytics | No | Yes | Yes | Yes |
| Create / manage assessments | No | No | Yes | Yes |

> The org limit applies to organizations a user **owns** (`OrgRole = OWNER`). A user may be a member of additional organizations owned by others regardless of plan.

### Plan enforcement behavior

- `FREE` user attempts `POST /organizations` — `403 Forbidden`
- `PREMIUM` user already owns 1 org and attempts another — `403 Forbidden`
- `ENTERPRISE` user already owns 3 orgs and attempts another — `403 Forbidden`
- `FREE` user attempts `GET /organizations/join/:code` — `403 Forbidden`
- Email invite acceptance (`POST /organizations/accept-invite/:token`) — allowed for all plans

### Plan downgrade behavior

When an admin downgrades a user's plan (e.g., ENTERPRISE to FREE):

- Existing organizations are **grandfathered** — they remain active and manageable.
- The user **cannot create new** organizations until their plan is upgraded.
- No automatic deactivation, seat reduction, or ownership transfer occurs.

---

## Organization Roles

Defined by the `OrgRole` enum. Every `OrgMember` record carries exactly one role.

| Role | Description |
|:-----|:------------|
| `OWNER` | Full control; can delete the org; there is one per org (the creator) |
| `ADMIN` | Can manage members, invites, settings, assessments, and competencies |
| `MANAGER` | Can manage groups, questions, assessments, and competencies |
| `RECRUITER` | Can view and manage candidate assessments |
| `MEMBER` | Read access to org content; can take catalog exams |

---

## Core Features

### Member Management

Owners and admins can:

- Invite members by email (`POST /organizations/:orgId/members/invite`) — tokens expire after 7 days
- Bulk-invite multiple emails in one request
- Change a member's role (`PATCH /organizations/:orgId/members/:userId`)
- Remove a member (`DELETE /organizations/:orgId/members/:userId`)
- Generate reusable join links with optional usage caps and expiry (`POST /organizations/:orgId/join-links`)
- List and revoke pending invites

Seat limits are enforced on every join path. When `count(active members) >= org.maxSeats`, invites and joins are rejected with `400 Bad Request`.

Members can be organized into named groups (`OrgGroup`) for bulk assignment of exams.

### Private Question Bank

Organizations maintain a private question bank scoped to the org (`OrgQuestion`). Questions go through a review workflow: `DRAFT → UNDER_REVIEW → APPROVED / REJECTED`. Only APPROVED questions are eligible for assessments.

Members with OWNER, ADMIN, or MANAGER roles can create, edit, and review questions. OWNER and ADMIN can approve or reject.

Public platform questions can be cloned into the org's private bank.

### Exam Catalog

An exam catalog (`ExamCatalogItem`) lets org managers publish fixed or dynamically-assembled exams to members. Catalog items support:

- Availability windows (`availableFrom` / `availableUntil`)
- Prerequisites (member must pass another catalog item first)
- Group or individual assignment
- Learning tracks (`LearningTrack`) that sequence multiple catalog items

### Candidate Assessments

Available on ENTERPRISE plan and ADMIN role only. Assessments are used to screen external candidates — no platform account required.

**Assessment lifecycle:** `DRAFT → ACTIVE → CLOSED → ARCHIVED`

Org admins:

- Create an assessment and configure its question pool (from the org's private bank)
- Invite candidates by email; each invitation generates a unique time-limited token
- Bulk-import candidates from a CSV
- View ranked results and export a CSV report
- Record a hiring decision per candidate (`PASS` / `FAIL` / etc.)

Candidates access the exam via `/assess/:token` — a public, unauthenticated page. The exam engine:

- Optionally randomizes question and choice order
- Reports anti-cheat events (tab switches, etc.) back to the backend
- Implements OTP verification before starting (5 requests / 10 min per IP, 10 verify attempts / 10 min per IP)

### Competency Framework

Organizations define **competencies** (skills), each mapped to one or more exam domain names (`CompetencyDomain`). Domain names are matched case-insensitively against the `domainScores` JSON stored on every submitted exam attempt.

Competency endpoints are at `GET|POST|PATCH|DELETE /organizations/:orgId/competencies/:id`. Sub-resources:

- `/domains` — add or remove domain mappings
- `/questions` — link or unlink org questions to the competency (used for future weighted scoring)

Competency levels (1–5) are inferred by `inferCompetencyLevel()` — see [ADR-028](./adr/028-competency-scoring.md).

### Org Analytics

Analytics endpoints are available to OWNER, ADMIN, and MANAGER roles. All metrics are computed from `ExamAttempt` records belonging to active org members.

| Endpoint | Description |
|:---------|:------------|
| `GET /organizations/:orgId/analytics/overview` | Member count, active users (7d), exams taken, avg score, pass rate |
| `GET /organizations/:orgId/analytics/readiness` | Per-certification pass rates across the team |
| `GET /organizations/:orgId/analytics/skill-gaps` | Domain-level accuracy sorted by lowest percentage |
| `GET /organizations/:orgId/analytics/progress` | Week-over-week exams taken and avg score (default 12 weeks) |
| `GET /organizations/:orgId/analytics/engagement` | DAU, total attempts, candidate funnel stats |
| `GET /organizations/:orgId/analytics/member/:userId` | Individual member deep-dive |
| `GET /organizations/:orgId/analytics/competency-profile` | Competency levels for a member or job role |
| `GET /organizations/:orgId/analytics/competency-heatmap` | All members × all competencies grid |

---

## Routing Summary

| Route prefix | Purpose |
|:-------------|:--------|
| `/organizations` | Org CRUD and join flows |
| `/organizations/:orgId/members` | Member management |
| `/organizations/:orgId/join-links` | Join link management |
| `/organizations/:orgId/groups` | Group management |
| `/organizations/:orgId/invites` | Invite management |
| `/organizations/:orgId/assessments` | Candidate assessment management (ENTERPRISE+) |
| `/assessments/take/:token` | Public candidate exam-taking (no auth) |
| `/organizations/:orgId/competencies` | Competency framework management |
| `/organizations/:orgId/analytics` | Org analytics |
