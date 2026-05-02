# Enterprise Plan — Detailed Implementation Plan

> Adds organization management, private question banks, exam catalogs, team management, candidate assessments, and org-level analytics to Brain Gym.

---

## User Review Required

> [!IMPORTANT]
> **Scope**: This is a large feature (~60+ new files). The plan is split into 6 incremental phases, each independently deployable and testable. ✅ **Approved**: Implementing phase-by-phase, testing after each phase.

> [!NOTE]  
> **Email**: Using **Mailtrap** (https://mailtrap.io/) for testing. Will switch to Gmail for production later.

> [!NOTE]
> **Billing**: No billing/payment integration. Plans are **admin-managed only** — admin manually sets a user's plan (`FREE`, `PREMIUM`, `ENTERPRISE`) via `PATCH /admin/users/:userId/plan`. There is no self-service upgrade. See [Plan-Based Access Control](#plan-based-access-control) section for full details.

> [!NOTE]
> **Candidate Exam**: Separate page (`/assess/:token`), no login required. Link is time-limited and expires after admin-configured duration.

> [!NOTE]
> **Testing**: All tests run inside **Docker** containers, not on host environment.

---

## Plan-Based Access Control

This section specifies how the `UserPlan` (`FREE`, `PREMIUM`, `ENTERPRISE`) gates access to organization features.

> [!IMPORTANT]
> **Plan management is admin-only.** There is no self-service upgrade flow. The system admin changes a user's plan via the admin panel (`PATCH /admin/users/:userId/plan`). This endpoint already exists and is audit-logged. No billing or payment integration is planned at this stage.

---

### Plan Management Rules

| Rule | Detail |
|:-----|:-------|
| Who can change a user's plan | Only `UserRole = ADMIN` via `PATCH /admin/users/:userId/plan` |
| Default plan on registration | `FREE` |
| Available plans | `FREE`, `PREMIUM`, `ENTERPRISE` |
| Self-service upgrade | ❌ Not supported (future scope) |
| Plan visible to user | Yes — included in login/refresh response |
| Plan stored in | `users.plan` column (enum `UserPlan`) |

---

### Plan Permissions Matrix

| Capability | FREE | PREMIUM | ENTERPRISE | ADMIN (any plan) |
|:-----------|:----:|:-------:|:----------:|:----------------:|
| **Create organization** | ❌ | ✅ (max 1) | ✅ (max 3) | ✅ (unlimited) |
| **Join org via email invite** | ✅ | ✅ | ✅ | ✅ |
| **Join org via join link** | ❌ | ✅ | ✅ | ✅ |
| **View org menu in navbar** | Only if member | ✅ Always | ✅ Always | ✅ Always |
| **Max seats per org (as Owner)** | — | 10 | 50 | 100 |
| **Access org analytics** | ❌ | ✅ | ✅ | ✅ |
| **Create assessments** | ❌ | ❌ | ✅ | ✅ |
| **Candidate assessments (external)** | ❌ | ❌ | ✅ | ✅ |

> [!NOTE]
> The "max organizations" limit refers to how many orgs a user can **own** (OrgRole = OWNER). They can still be a **member** of additional orgs created by others.

> [!NOTE]
> Free users can **only** join an organization if they receive an email invitation from an org OWNER/ADMIN. They cannot use join links or create their own organizations.

---

### Organization Creation — Plan Enforcement

When a user calls `POST /organizations`, the system SHALL check:

1. **User's `role`** — If `UserRole = ADMIN`, bypass all plan restrictions (always allow).
2. **User's `plan`** — Enforce limits per the matrix above.
3. **Owned org count** — Count orgs where user has `OrgRole = OWNER`.

| Plan | Behavior |
|:-----|:---------|
| `FREE` | Return `403`: _"Upgrade to Premium or Enterprise to create an organization."_ |
| `PREMIUM` | Allow if owned orgs < 1. Otherwise `403`: _"Premium plan allows 1 organization. Upgrade to Enterprise for more."_ |
| `ENTERPRISE` | Allow if owned orgs < 3. Otherwise `403`: _"You have reached the maximum number of organizations for your plan."_ |
| `ADMIN` | Always allow. No limit. |

The `maxSeats` for a new org is set based on the creator's plan:

| Creator Plan | Default `maxSeats` |
|:-------------|:-------------------|
| `PREMIUM` | 10 |
| `ENTERPRISE` | 50 |
| `ADMIN` | 100 |

---

### Organization Joining — Plan Enforcement

**Join via Email Invite** (`POST /organizations/accept-invite/:token`):
- All plans including `FREE` are allowed. No change to current behavior.

**Join via Link** (`GET /organizations/join/:code`):
- `FREE` users → `403`: _"Free plan users can only join organizations via email invitation."_
- `PREMIUM`, `ENTERPRISE`, `ADMIN` → Allowed (current behavior).

Seat limits are still enforced regardless of the joiner's plan.

---

### Plan Info in Auth Response

The login/refresh response SHALL include `plan` so the frontend can render plan-aware UI:

```json
{
  "accessToken": "...",
  "refreshToken": "...",
  "user": {
    "id": "...",
    "email": "...",
    "displayName": "...",
    "role": "LEARNER",
    "plan": "FREE",
    "orgMemberships": [...]
  }
}
```

Changes required:
- [auth.service.ts](file:///Users/thanhpt/Projects/brain-gym/backend/src/auth/auth.service.ts) — add `plan: user.plan` to response
- [auth.store.ts](file:///Users/thanhpt/Projects/brain-gym/src/stores/auth.store.ts) — add `plan: string` to `User` interface

---

### Admin Organization Management

New admin endpoints for platform-wide org management (added to existing `AdminController`):

| Method | Route | Description |
|:-------|:------|:------------|
| `GET` | `/admin/organizations` | List all orgs (paginated, with owner info & member count) |
| `GET` | `/admin/organizations/:orgId` | Get org detail with members summary |
| `PATCH` | `/admin/organizations/:orgId` | Update any org (name, maxSeats, isActive, etc.) |
| `DELETE` | `/admin/organizations/:orgId` | Delete any org (cascade) |
| `GET` | `/admin/organizations/:orgId/members` | List members of any org |
| `PATCH` | `/admin/organizations/:orgId/members/:userId` | Change member role in any org |
| `DELETE` | `/admin/organizations/:orgId/members/:userId` | Remove member from any org |

All endpoints protected by `JwtAuthGuard` + `RolesGuard(ADMIN)`. All actions audit-logged.

The admin dashboard (`GET /admin/dashboard`) SHALL also include:
- Total organizations count
- Organizations created in last 7d / 30d

---

### Navigation Visibility Rules

**Navbar & BottomTabBar** — "Organization" menu item visibility:

| User State | Visible? |
|:-----------|:---------|
| Not authenticated | ❌ |
| FREE, no memberships | ❌ |
| FREE, has membership(s) | ✅ → `/org` |
| PREMIUM, no memberships | ✅ → `/org` (shows "Create" CTA) |
| ENTERPRISE, no memberships | ✅ → `/org` (shows "Create" CTA) |
| ADMIN | ✅ Always |

**OrgSelector Page** (`/org`) — conditional content:

| Condition | "Create" Button | Message |
|:----------|:---------------:|:--------|
| FREE, no orgs | ❌ | _"Ask your team admin to send you an invite."_ |
| FREE, has orgs | ❌ | _(show org list only)_ |
| PREMIUM, can create | ✅ | _(show org list + create button)_ |
| PREMIUM, limit reached | ❌ | _"Upgrade to Enterprise for more orgs."_ |
| ENTERPRISE, can create | ✅ | _(show org list + create button)_ |
| ENTERPRISE, limit reached | ❌ | _"Maximum organizations reached."_ |
| ADMIN | ✅ | _(always show)_ |

---

### Plan Downgrade Behavior

If an admin downgrades a user's plan (e.g., PREMIUM → FREE) while they own an organization:
- Existing organizations are **kept as-is** (grandfathered).
- The user can continue to manage their existing org(s).
- The user **cannot** create new organizations until their plan is upgraded again.
- No automatic deactivation or ownership transfer occurs.

---

### Backwards Compatibility

- Existing organizations created before this feature continue to function normally.
- Existing users default to `plan = FREE`. If they already own orgs, those orgs are grandfathered.
- The `UserPlan` enum and `User.plan` column already exist — no schema migration needed.

---

### Error Messages

| Scenario | HTTP | Message |
|:---------|:----:|:--------|
| FREE user creates org | 403 | _"Upgrade to Premium or Enterprise plan to create an organization."_ |
| PREMIUM user exceeds limit | 403 | _"Your Premium plan allows 1 organization. Upgrade to Enterprise for more."_ |
| ENTERPRISE user exceeds limit | 403 | _"You have reached the maximum number of organizations for your plan (3)."_ |
| FREE user tries join link | 403 | _"Free plan users can only join organizations via email invitation."_ |

---

## Proposed Changes

The implementation is organized into 6 phases. Each phase is self-contained with its own migration, backend module(s), and frontend pages.

---

### Phase 1: Database Schema & Organization Core (Foundation)

The foundation: new Prisma models, the `organizations` NestJS module, org-role guard, and the mail service stub.

---

#### [MODIFY] [schema.prisma](file:///Users/thanhpt/Projects/brain-gym/backend/prisma/schema.prisma)

Add 6 new enums and 12 new models. Add relations to existing `User`, `Certification`, and `Question` models.

**New Enums:**
```prisma
enum OrgRole {
  OWNER
  ADMIN
  MANAGER
  MEMBER
}

enum OrgInviteStatus {
  PENDING
  ACCEPTED
  EXPIRED
  REVOKED
}

enum AssessmentStatus {
  DRAFT
  ACTIVE
  CLOSED
  ARCHIVED
}

enum CandidateAttemptStatus {
  INVITED
  STARTED
  SUBMITTED
  EXPIRED
}

enum ExamCatalogItemType {
  FIXED
  DYNAMIC
}

enum OrgQuestionStatus {
  DRAFT
  UNDER_REVIEW
  APPROVED
  REJECTED
}
```

**New Models (Phase 1 — 5 models):**

| Model | Purpose |
|:------|:--------|
| `Organization` | Top-level company entity (name, slug, logo, maxSeats, branding) |
| `OrgMember` | Junction: User ↔ Organization with `OrgRole` |
| `OrgInvite` | Email invitation with token + expiry |
| `OrgJoinLink` | Reusable join links with usage limits |
| `OrgGroup` | Sub-teams within an organization |

**Existing Model Modifications:**

| Model | Change |
|:------|:-------|
| `User` | Add `orgMemberships OrgMember[]` relation |

> [!NOTE]
> Models for phases 2–5 (OrgQuestion, ExamCatalogItem, Assessment, etc.) are included in this same migration to avoid repeated schema changes, but their backend modules are built in later phases.

---

#### [NEW] Migration file

```
backend/prisma/migrations/20260401000000_enterprise_plan/migration.sql
```

Generated via `npx prisma migrate dev --name enterprise_plan`. This single migration creates all 12 tables and enum types.

---

#### [NEW] [mail.service.ts](file:///Users/thanhpt/Projects/brain-gym/backend/src/mail/mail.service.ts)

A stub mail service following the project's `@Global()` module pattern (like `AuditModule`):

```typescript
@Global()
@Module({
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
```

The service exposes methods like:
- `sendOrgInvite(email, orgName, inviteToken, invitedBy)`
- `sendAssessmentInvite(email, assessmentTitle, token, expiresAt)`
- `sendExamAssigned(email, examTitle, orgName)`

All methods log to console in development. Production implementation TBD.

---

#### [NEW] Organization backend module

```
backend/src/organizations/
├── organizations.module.ts
├── organizations.controller.ts
├── organizations.service.ts
├── dto/
│   ├── create-org.dto.ts
│   ├── update-org.dto.ts
│   ├── invite-member.dto.ts
│   ├── create-join-link.dto.ts
│   ├── create-group.dto.ts
│   └── update-member-role.dto.ts
└── guards/
    └── org-role.guard.ts
```

**Key design decisions:**

1. **Controller** follows existing pattern: `@ApiTags('organizations')`, `@Controller('organizations')`, uses `@UseGuards(JwtAuthGuard)` per-endpoint, `@Public()` for join-link endpoint.

2. **Service** uses `PrismaService` (globally available via `PrismaModule`), `MailService`, and `AuditService`.

3. **OrgRoleGuard** — a new guard similar to [roles.guard.ts](file:///Users/thanhpt/Projects/brain-gym/backend/src/auth/guards/roles.guard.ts) but checks `OrgRole` from the `org_members` table. It reads the `:orgId` route param and verifies the user's role within that org:

```typescript
// Usage:
@OrgRoles(OrgRole.OWNER, OrgRole.ADMIN)
@UseGuards(JwtAuthGuard, OrgRoleGuard)
@Delete(':orgId/members/:userId')
removeMember(...) { }
```

**New decorator:**
```
backend/src/common/decorators/org-roles.decorator.ts
```

**Endpoints (14 routes):**

| Method | Route | Guard | Description |
|:-------|:------|:------|:------------|
| `POST` | `/organizations` | JWT + **PlanGuard** | Create organization — **requires PREMIUM/ENTERPRISE plan or ADMIN role** (see [Plan-Based Access Control](#plan-based-access-control)) |
| `GET` | `/organizations/my` | JWT | List orgs the user belongs to |
| `GET` | `/organizations/:orgId` | JWT + OrgRole(ANY) | Get org details |
| `PATCH` | `/organizations/:orgId` | JWT + OrgRole(OWNER, ADMIN) | Update org settings |
| `DELETE` | `/organizations/:orgId` | JWT + OrgRole(OWNER) | Delete organization |
| `GET` | `/organizations/:orgId/members` | JWT + OrgRole(ANY) | List members (paginated, searchable) |
| `POST` | `/organizations/:orgId/members/invite` | JWT + OrgRole(OWNER, ADMIN) | Invite by email |
| `POST` | `/organizations/:orgId/members/bulk-invite` | JWT + OrgRole(OWNER, ADMIN) | Bulk invite |
| `PATCH` | `/organizations/:orgId/members/:userId` | JWT + OrgRole(OWNER, ADMIN) | Change member role |
| `DELETE` | `/organizations/:orgId/members/:userId` | JWT + OrgRole(OWNER, ADMIN) | Remove member |
| `POST` | `/organizations/:orgId/join-links` | JWT + OrgRole(OWNER, ADMIN) | Generate join link |
| `GET` | `/organizations/join/:code` | JWT + **PlanGuard** | Join org via link — **FREE users blocked** (see [Plan-Based Access Control](#plan-based-access-control)) |
| `POST` | `/organizations/:orgId/groups` | JWT + OrgRole(OWNER, ADMIN, MANAGER) | Create group |
| `GET` | `/organizations/:orgId/groups` | JWT + OrgRole(ANY) | List groups |
| `PATCH` | `/organizations/:orgId/groups/:groupId` | JWT + OrgRole(OWNER, ADMIN, MANAGER) | Update group |
| `POST` | `/organizations/accept-invite/:token` | JWT | Accept email invitation (all plans allowed) |

**Service logic highlights:**

- `create()`: **Checks user plan + owned org count** → Creates org + creates `OrgMember` with role=OWNER in a `$transaction`. Sets `maxSeats` based on plan.
- `invite()`: Generates UUID token, creates `OrgInvite`, calls `MailService.sendOrgInvite()`
- `acceptInvite()`: Validates token, checks expiry, creates `OrgMember`, updates invite status — **no plan restriction**
- `joinViaLink()`: **Checks user plan (FREE blocked)** → validates code, checks usage limits and expiry, creates `OrgMember`
- Seat enforcement: Before adding members, check `count(org_members) < org.maxSeats`

---

#### [MODIFY] [app.module.ts](file:///Users/thanhpt/Projects/brain-gym/backend/src/app.module.ts)

Add `MailModule` and `OrganizationsModule` to imports:

```diff
+import { MailModule } from './mail/mail.module';
+import { OrganizationsModule } from './organizations/organizations.module';

 imports: [
   ...existing modules...,
+  MailModule,
+  OrganizationsModule,
 ],
```

---

#### Frontend — Phase 1 Pages

**New files:**

| File | Purpose |
|:-----|:--------|
| `src/services/organizations.ts` | API client for org endpoints |
| `src/types/org-types.ts` | TypeScript interfaces for org entities |
| `src/stores/org.store.ts` | Zustand store for active org context |
| `src/pages/org/OrgCreate.tsx` | Create organization form page |
| `src/pages/org/OrgDashboard.tsx` | Organization dashboard (overview tab) |
| `src/pages/org/OrgMembers.tsx` | Member management page |
| `src/pages/org/OrgGroups.tsx` | Group management page |
| `src/pages/org/OrgSettings.tsx` | Organization settings page |
| `src/pages/org/OrgJoin.tsx` | Public join-via-link page |
| `src/components/org/OrgSidebar.tsx` | Sidebar navigation for org pages |
| `src/components/org/OrgLayout.tsx` | Layout wrapper with sidebar |
| `src/components/org/OrgInviteModal.tsx` | Modal for inviting members |
| `src/components/org/OrgMemberTable.tsx` | Reusable member list table |

**Routing (added to App.tsx):**

```tsx
// Organization routes
<Route path="/org/create" element={<ProtectedRoute><OrgCreate /></ProtectedRoute>} />
<Route path="/org/join/:code" element={<OrgJoin />} />
<Route path="/org/:slug" element={<ProtectedRoute><OrgLayout /></ProtectedRoute>}>
  <Route index element={<OrgDashboard />} />
  <Route path="members" element={<OrgMembers />} />
  <Route path="groups" element={<OrgGroups />} />
  <Route path="settings" element={<OrgSettings />} />
  {/* Phase 2-5 routes added here later */}
</Route>
```

**UI patterns** — All org pages follow existing conventions:
- `<Navbar title="..." />` header
- `useQuery` / `useMutation` from `@tanstack/react-query`
- `toast` from `sonner` for notifications
- `motion.div` from `framer-motion` for animations
- `glass-card`, `bg-white/5`, `border-white/10` — existing design tokens
- `font-mono` for labels and data display

**Org store** — follows [auth.store.ts](file:///Users/thanhpt/Projects/brain-gym/src/stores/auth.store.ts) pattern:

```typescript
interface OrgState {
  activeOrg: Organization | null;
  activeOrgRole: OrgRole | null;
  setActiveOrg: (org: Organization, role: OrgRole) => void;
  clearOrg: () => void;
}
```

---

### Phase 2: Private Question Bank

Organization-scoped question CRUD with internal review workflow.

---

#### [NEW] Org Questions backend module

```
backend/src/org-questions/
├── org-questions.module.ts
├── org-questions.controller.ts
├── org-questions.service.ts
└── dto/
    ├── create-org-question.dto.ts
    ├── update-org-question.dto.ts
    ├── clone-questions.dto.ts
    └── bulk-import.dto.ts
```

**Uses Prisma models:** `OrgQuestion`, `OrgQuestionChoice` (created in Phase 1 migration).

**Endpoints (8 routes):**

| Method | Route | Guard | Description |
|:-------|:------|:------|:------------|
| `GET` | `/organizations/:orgId/questions` | JWT + OrgRole(ANY) | List org questions (paginated, filtered by status/category/difficulty) |
| `POST` | `/organizations/:orgId/questions` | JWT + OrgRole(OWNER, ADMIN, MANAGER) | Create private question |
| `GET` | `/organizations/:orgId/questions/:qid` | JWT + OrgRole(ANY) | Get question detail |
| `PATCH` | `/organizations/:orgId/questions/:qid` | JWT + OrgRole(OWNER, ADMIN, MANAGER) | Update question |
| `DELETE` | `/organizations/:orgId/questions/:qid` | JWT + OrgRole(OWNER, ADMIN, MANAGER) | Soft-delete question |
| `PATCH` | `/organizations/:orgId/questions/:qid/status` | JWT + OrgRole(OWNER, ADMIN) | Approve/reject (review workflow) |
| `POST` | `/organizations/:orgId/questions/clone` | JWT + OrgRole(OWNER, ADMIN, MANAGER) | Clone from public bank |
| `POST` | `/organizations/:orgId/questions/bulk-import` | JWT + OrgRole(OWNER, ADMIN) | CSV bulk import |

**Service logic highlights:**

- `create()`: Follows [QuestionsService.create()](file:///Users/thanhpt/Projects/brain-gym/backend/src/questions/questions.service.ts#L98-L160) pattern — creates question + choices in a single Prisma `create` with nested `choices.create`
- `clone()`: Takes an array of public question IDs, fetches them with choices, creates `OrgQuestion` copies scoped to the org
- `bulkImport()`: Parses CSV rows, validates, creates questions in a `$transaction`
- `updateStatus()`: Implements `DRAFT → UNDER_REVIEW → APPROVED/REJECTED` workflow. Only OWNER/ADMIN can approve.

---

#### Frontend — Phase 2 Pages

| File | Purpose |
|:-----|:--------|
| `src/services/org-questions.ts` | API client for org question endpoints |
| `src/pages/org/OrgQuestionBank.tsx` | Question bank browser (filters, search, status tabs) |
| `src/pages/org/OrgQuestionForm.tsx` | Create/Edit private question form |
| `src/pages/org/OrgQuestionDetail.tsx` | Question detail view with review actions |
| `src/components/org/OrgQuestionEditor.tsx` | Reusable editor for org questions (choices, explanation) |
| `src/components/org/CloneQuestionsModal.tsx` | Modal to browse & select public questions to clone |

**Route additions (nested under `/org/:slug`):**
```tsx
<Route path="questions" element={<OrgQuestionBank />} />
<Route path="questions/new" element={<OrgQuestionForm />} />
<Route path="questions/:qid" element={<OrgQuestionDetail />} />
<Route path="questions/:qid/edit" element={<OrgQuestionForm />} />
```

---

### Phase 3: Exam Catalog & Learning Tracks

Pre-defined exam catalog visible to org members, with scheduling, prerequisites, and learning tracks.

---

#### [NEW] Exam Catalog backend module

```
backend/src/exam-catalog/
├── exam-catalog.module.ts
├── exam-catalog.controller.ts
├── exam-catalog.service.ts
└── dto/
    ├── create-catalog-item.dto.ts
    ├── update-catalog-item.dto.ts
    ├── assign-exam.dto.ts
    ├── create-track.dto.ts
    └── start-catalog-exam.dto.ts
```

**Uses Prisma models:** `ExamCatalogItem`, `ExamCatalogQuestion`, `LearningTrack`, `OrgExamAssignment` (created in Phase 1 migration).

**Endpoints (12 routes):**

| Method | Route | Guard | Description |
|:-------|:------|:------|:------------|
| `GET` | `/organizations/:orgId/catalog` | JWT + OrgRole(ANY) | List catalog items (member view: only active + available items) |
| `GET` | `/organizations/:orgId/catalog/manage` | JWT + OrgRole(OWNER, ADMIN, MANAGER) | List all catalog items (admin view: includes drafts) |
| `POST` | `/organizations/:orgId/catalog` | JWT + OrgRole(OWNER, ADMIN, MANAGER) | Create catalog item |
| `GET` | `/organizations/:orgId/catalog/:cid` | JWT + OrgRole(ANY) | Get catalog item detail |
| `PATCH` | `/organizations/:orgId/catalog/:cid` | JWT + OrgRole(OWNER, ADMIN, MANAGER) | Update catalog item |
| `DELETE` | `/organizations/:orgId/catalog/:cid` | JWT + OrgRole(OWNER, ADMIN) | Delete catalog item |
| `POST` | `/organizations/:orgId/catalog/:cid/assign` | JWT + OrgRole(OWNER, ADMIN, MANAGER) | Assign to group/member |
| `POST` | `/organizations/:orgId/catalog/:cid/start` | JWT + OrgRole(ANY) | Start attempt on a catalog exam |
| `GET` | `/organizations/:orgId/tracks` | JWT + OrgRole(ANY) | List learning tracks |
| `POST` | `/organizations/:orgId/tracks` | JWT + OrgRole(OWNER, ADMIN, MANAGER) | Create learning track |
| `PATCH` | `/organizations/:orgId/tracks/:tid` | JWT + OrgRole(OWNER, ADMIN, MANAGER) | Update track |
| `GET` | `/organizations/:orgId/my-assignments` | JWT + OrgRole(ANY) | Get current user's assignments & progress |

**Service logic highlights:**

- `startCatalogExam()`: Constructs question set from `ExamCatalogQuestion` (which can reference `OrgQuestion` or public `Question`), creates an `ExamAttempt` record. For DYNAMIC type, randomly selects from the org's approved question pool matching criteria.
- `listCatalog()` (member view): Filters by `isActive`, checks `availableFrom/Until` dates, checks prerequisites (has the user passed the prerequisite catalog item?).
- `assign()`: Creates `OrgExamAssignment`, optionally sends email via `MailService`.

---

#### Frontend — Phase 3 Pages

| File | Purpose |
|:-----|:--------|
| `src/services/exam-catalog.ts` | API client |
| `src/pages/org/OrgExamCatalog.tsx` | Member-facing catalog browser (card grid) |
| `src/pages/org/OrgCatalogManage.tsx` | Admin catalog management (table view) |
| `src/pages/org/OrgCatalogBuilder.tsx` | Create/edit catalog item form |
| `src/pages/org/OrgLearningTracks.tsx` | Learning tracks overview |
| `src/components/org/CatalogExamCard.tsx` | Exam card for catalog grid |
| `src/components/org/TrackProgress.tsx` | Track progress visualization |
| `src/components/org/AssignExamModal.tsx` | Modal to assign exam to group/member |

**Route additions (nested under `/org/:slug`):**
```tsx
<Route path="catalog" element={<OrgExamCatalog />} />
<Route path="catalog/manage" element={<OrgCatalogManage />} />
<Route path="catalog/create" element={<OrgCatalogBuilder />} />
<Route path="catalog/:cid/edit" element={<OrgCatalogBuilder />} />
<Route path="tracks" element={<OrgLearningTracks />} />
```

---

### Phase 4: Candidate Assessment (External Invitations)

The hiring/screening feature — send time-limited exam links to external candidates.

---

#### [NEW] Assessments backend module

```
backend/src/assessments/
├── assessments.module.ts
├── assessments.controller.ts      — Org-admin endpoints (create, invite, view results)
├── assessments.service.ts
├── candidate.controller.ts        — Public token-based endpoints (take exam)
├── candidate.service.ts
└── dto/
    ├── create-assessment.dto.ts
    ├── invite-candidate.dto.ts
    ├── candidate-start.dto.ts
    └── candidate-submit.dto.ts
```

**Uses Prisma models:** `Assessment`, `CandidateInvite`, `CandidateAnswer` (created in Phase 1 migration).

**Two controllers, two audiences:**

**Admin Controller** (`/organizations/:orgId/assessments`):

| Method | Route | Guard | Description |
|:-------|:------|:------|:------------|
| `GET` | `/organizations/:orgId/assessments` | JWT + OrgRole(OWNER, ADMIN, MANAGER) | List assessments |
| `POST` | `/organizations/:orgId/assessments` | JWT + OrgRole(OWNER, ADMIN, MANAGER) | Create assessment |
| `GET` | `/organizations/:orgId/assessments/:aid` | JWT + OrgRole(OWNER, ADMIN, MANAGER) | Get assessment detail |
| `PATCH` | `/organizations/:orgId/assessments/:aid` | JWT + OrgRole(OWNER, ADMIN, MANAGER) | Update assessment |
| `PATCH` | `/organizations/:orgId/assessments/:aid/status` | JWT + OrgRole(OWNER, ADMIN) | Activate/close assessment |
| `POST` | `/organizations/:orgId/assessments/:aid/invite` | JWT + OrgRole(OWNER, ADMIN, MANAGER) | Invite candidates |
| `GET` | `/organizations/:orgId/assessments/:aid/results` | JWT + OrgRole(OWNER, ADMIN, MANAGER) | View all candidate results |
| `GET` | `/organizations/:orgId/assessments/:aid/results/export` | JWT + OrgRole(OWNER, ADMIN) | Export results as CSV |

**Candidate Controller** (`/assessments/take`):

| Method | Route | Guard | Description |
|:-------|:------|:------|:------------|
| `GET` | `/assessments/take/:token` | Public | Load assessment info (title, time limit, question count) |
| `POST` | `/assessments/take/:token/start` | Public | Start attempt (returns questions without answers) |
| `POST` | `/assessments/take/:token/submit` | Public | Submit all answers |
| `POST` | `/assessments/take/:token/event` | Public | Report anti-cheat events (tab switch, etc.) |

**Service logic highlights:**

- `inviteCandidates()`: Takes array of `{email, name}`, generates unique token per candidate, creates `CandidateInvite` records, sends emails via `MailService`
- `startCandidateAttempt()`: Validates token, checks expiry, marks status=STARTED, returns questions (randomized if assessment.randomizeQuestions is true, choices randomized if randomizeChoices is true). No auth required — token IS the auth.
- `submitCandidateAttempt()`: Evaluates answers against correct choices (from `OrgQuestion` or public `Question`), calculates score, updates `CandidateInvite` with results. Follows same evaluate logic as [AttemptsService](file:///Users/thanhpt/Projects/brain-gym/backend/src/attempts/attempts.service.ts#L269-L300).
- `reportEvent()`: Increments `tabSwitchCount` on `CandidateInvite` when tab-switch events are reported.

---

#### Frontend — Phase 4 Pages

| File | Purpose |
|:-----|:--------|
| `src/services/assessments.ts` | API client (both admin & candidate endpoints) |
| `src/pages/org/OrgAssessments.tsx` | Assessment list page |
| `src/pages/org/AssessmentBuilder.tsx` | Create/edit assessment |
| `src/pages/org/AssessmentResults.tsx` | View candidate results (table + ranking) |
| `src/pages/CandidateExam.tsx` | Public exam-taking page (token-based, no auth) |
| `src/pages/CandidateResult.tsx` | Post-submission result page for candidate |
| `src/components/org/InviteCandidatesModal.tsx` | Modal to enter candidate emails |
| `src/components/org/CandidateRanking.tsx` | Ranked candidate results table |
| `src/components/org/AssessmentFunnel.tsx` | Invited→Started→Completed→Passed funnel chart |

**Route additions:**

```tsx
// Nested under /org/:slug
<Route path="assessments" element={<OrgAssessments />} />
<Route path="assessments/create" element={<AssessmentBuilder />} />
<Route path="assessments/:aid" element={<AssessmentResults />} />
<Route path="assessments/:aid/edit" element={<AssessmentBuilder />} />

// Top-level public routes (no auth)
<Route path="/assess/:token" element={<CandidateExam />} />
<Route path="/assess/:token/result" element={<CandidateResult />} />
```

**CandidateExam page** — Similar to [ExamPage.tsx](file:///Users/thanhpt/Projects/brain-gym/src/pages/ExamPage.tsx) but:
- No auth required (token-based)
- Anti-cheat: listens for `visibilitychange` events, reports tab switches to backend
- Optional: `onCopy` / `onPaste` event blocking (if assessment.blockCopyPaste)
- Clean, minimal UI — no navbar or bottom tab bar

---

### Phase 5: Organization Analytics

Aggregated team-level analytics and reporting.

---

#### [NEW] Org Analytics backend module

```
backend/src/org-analytics/
├── org-analytics.module.ts
├── org-analytics.controller.ts
└── org-analytics.service.ts
```

**Endpoints (6 routes):**

| Method | Route | Guard | Description |
|:-------|:------|:------|:------------|
| `GET` | `/organizations/:orgId/analytics/overview` | JWT + OrgRole(OWNER, ADMIN, MANAGER) | Team overview (member count, active users, exams taken, avg scores) |
| `GET` | `/organizations/:orgId/analytics/readiness` | JWT + OrgRole(OWNER, ADMIN, MANAGER) | Per-certification readiness across team |
| `GET` | `/organizations/:orgId/analytics/skill-gaps` | JWT + OrgRole(OWNER, ADMIN, MANAGER) | Domain-level weakness analysis |
| `GET` | `/organizations/:orgId/analytics/progress` | JWT + OrgRole(OWNER, ADMIN, MANAGER) | Week-over-week progress trends |
| `GET` | `/organizations/:orgId/analytics/engagement` | JWT + OrgRole(OWNER, ADMIN, MANAGER) | Engagement metrics (DAU, streaks, completion rates) |
| `GET` | `/organizations/:orgId/analytics/member/:userId` | JWT + OrgRole(OWNER, ADMIN, MANAGER) | Individual member deep-dive analytics |

**Service logic:**

Analytics are computed by querying `ExamAttempt` records for users who are `OrgMember` of the org. Uses Prisma `groupBy`, `aggregate`, and raw SQL where needed for date-based aggregations (reusing patterns from [analytics module](file:///Users/thanhpt/Projects/brain-gym/backend/src/analytics)).

---

#### Frontend — Phase 5 Pages

| File | Purpose |
|:-----|:--------|
| `src/services/org-analytics.ts` | API client |
| `src/pages/org/OrgAnalytics.tsx` | Analytics dashboard with tabs |
| `src/components/org/ReadinessHeatmap.tsx` | Heatmap: certifications × members |
| `src/components/org/SkillGapChart.tsx` | Radar chart for domain weaknesses |
| `src/components/org/EngagementChart.tsx` | Line chart for engagement trends |
| `src/components/org/MemberAnalyticsCard.tsx` | Per-member stats card |

**Route additions (nested under `/org/:slug`):**
```tsx
<Route path="analytics" element={<OrgAnalytics />} />
```

---

### Phase 6: Plan Enforcement, Admin Org Management & Polish

Plan-based access control, admin org management, and cross-cutting frontend enhancements.

---

#### [NEW] Plan guard / service logic

Add plan enforcement to `OrganizationsService`:

```typescript
// In organizations.service.ts — create() method
async create(userId: string, dto: CreateOrgDto) {
  const user = await this.prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new NotFoundException('User not found');

  // Admin bypasses all plan restrictions
  if (user.role !== UserRole.ADMIN) {
    if (user.plan === UserPlan.FREE) {
      throw new ForbiddenException('Upgrade to Premium or Enterprise to create an organization.');
    }
    const ownedCount = await this.prisma.orgMember.count({
      where: { userId, role: OrgRole.OWNER, isActive: true },
    });
    const maxOrgs = user.plan === UserPlan.PREMIUM ? 1 : 3;
    if (ownedCount >= maxOrgs) {
      throw new ForbiddenException(
        user.plan === UserPlan.PREMIUM
          ? 'Premium plan allows 1 organization. Upgrade to Enterprise for more.'
          : 'You have reached the maximum number of organizations for your plan.',
      );
    }
  }
  // ... existing creation logic ...
}
```

Similar check in `joinViaLink()` to block FREE users.

---

#### [NEW] Admin organization management endpoints

Add to existing `AdminController` / `AdminService`:

| Method | Route | Description |
|:-------|:------|:------------|
| `GET` | `/admin/organizations` | List all orgs (paginated) |
| `GET` | `/admin/organizations/:orgId` | Get org detail |
| `PATCH` | `/admin/organizations/:orgId` | Update any org |
| `DELETE` | `/admin/organizations/:orgId` | Delete any org |
| `GET` | `/admin/organizations/:orgId/members` | List members |
| `PATCH` | `/admin/organizations/:orgId/members/:userId` | Change member role |
| `DELETE` | `/admin/organizations/:orgId/members/:userId` | Remove member |

All protected by `@Roles(UserRole.ADMIN)` and audit-logged.

---

#### [MODIFY] [auth.service.ts](file:///Users/thanhpt/Projects/brain-gym/backend/src/auth/auth.service.ts)

Include `plan` and org membership info in login/refresh response:

```diff
  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
+     plan: user.plan,
      orgMemberships,
    },
  };
```

#### [MODIFY] [auth.store.ts](file:///Users/thanhpt/Projects/brain-gym/src/stores/auth.store.ts)

Add `plan: string` to `User` interface:

```diff
  interface User {
    id: string;
    email: string;
    displayName: string;
    role: string;
+   plan: string;
    orgMemberships: OrgMembership[];
  }
```

#### [MODIFY] [Navbar.tsx](file:///Users/thanhpt/Projects/brain-gym/src/components/Navbar.tsx)

Update organization menu visibility to be plan-aware:

```diff
- const showOrg = orgMemberships.length > 0 || user?.role === 'ADMIN';
+ const showOrg = orgMemberships.length > 0
+   || user?.plan === 'PREMIUM'
+   || user?.plan === 'ENTERPRISE'
+   || user?.role === 'ADMIN';
```

#### [MODIFY] [BottomTabBar.tsx](file:///Users/thanhpt/Projects/brain-gym/src/components/BottomTabBar.tsx)

Same plan-aware visibility logic as Navbar.

#### [MODIFY] [OrgSelector.tsx](file:///Users/thanhpt/Projects/brain-gym/src/pages/org/OrgSelector.tsx)

Update to show plan-appropriate messaging:
- FREE with no orgs → "Ask your team admin to invite you" (no Create button)
- FREE with orgs → Show org list only (no Create button)
- PREMIUM/ENTERPRISE → Show Create button based on owned org limits
- ADMIN → Always show Create button

#### [MODIFY] [Dashboard.tsx](file:///Users/thanhpt/Projects/brain-gym/src/pages/Dashboard.tsx)

Add "Organization" card/section showing pending assignments, mandatory exams, and quick links to org dashboard.

#### [MODIFY] Admin page (`/admin`)

Add "Organizations" tab showing all orgs with management actions (view, edit, deactivate, delete).

---

## File Summary

### New Backend Files (30+ files)

```
backend/src/
├── mail/
│   ├── mail.module.ts
│   └── mail.service.ts
├── organizations/
│   ├── organizations.module.ts
│   ├── organizations.controller.ts
│   ├── organizations.service.ts
│   ├── dto/ (6 DTO files)
│   └── guards/
│       └── org-role.guard.ts
├── org-questions/
│   ├── org-questions.module.ts
│   ├── org-questions.controller.ts
│   ├── org-questions.service.ts
│   └── dto/ (4 DTO files)
├── exam-catalog/
│   ├── exam-catalog.module.ts
│   ├── exam-catalog.controller.ts
│   ├── exam-catalog.service.ts
│   └── dto/ (5 DTO files)
├── assessments/
│   ├── assessments.module.ts
│   ├── assessments.controller.ts
│   ├── assessments.service.ts
│   ├── candidate.controller.ts
│   ├── candidate.service.ts
│   └── dto/ (4 DTO files)
└── org-analytics/
    ├── org-analytics.module.ts
    ├── org-analytics.controller.ts
    └── org-analytics.service.ts
```

### New Frontend Files (25+ files)

```
src/
├── types/org-types.ts
├── stores/org.store.ts
├── services/
│   ├── organizations.ts
│   ├── org-questions.ts
│   ├── exam-catalog.ts
│   ├── assessments.ts
│   └── org-analytics.ts
├── pages/
│   ├── org/
│   │   ├── OrgCreate.tsx
│   │   ├── OrgDashboard.tsx
│   │   ├── OrgMembers.tsx
│   │   ├── OrgGroups.tsx
│   │   ├── OrgSettings.tsx
│   │   ├── OrgJoin.tsx
│   │   ├── OrgQuestionBank.tsx
│   │   ├── OrgQuestionForm.tsx
│   │   ├── OrgQuestionDetail.tsx
│   │   ├── OrgExamCatalog.tsx
│   │   ├── OrgCatalogManage.tsx
│   │   ├── OrgCatalogBuilder.tsx
│   │   ├── OrgLearningTracks.tsx
│   │   ├── OrgAssessments.tsx
│   │   ├── AssessmentBuilder.tsx
│   │   ├── AssessmentResults.tsx
│   │   └── OrgAnalytics.tsx
│   ├── CandidateExam.tsx
│   └── CandidateResult.tsx
└── components/org/
    ├── OrgSidebar.tsx
    ├── OrgLayout.tsx
    ├── OrgInviteModal.tsx
    ├── OrgMemberTable.tsx
    ├── OrgQuestionEditor.tsx
    ├── CloneQuestionsModal.tsx
    ├── CatalogExamCard.tsx
    ├── TrackProgress.tsx
    ├── AssignExamModal.tsx
    ├── InviteCandidatesModal.tsx
    ├── CandidateRanking.tsx
    ├── AssessmentFunnel.tsx
    ├── ReadinessHeatmap.tsx
    ├── SkillGapChart.tsx
    ├── EngagementChart.tsx
    └── MemberAnalyticsCard.tsx
```

---

## Open Questions

> [!IMPORTANT]
> **Q1: Email provider** — Should I integrate a real email provider (SendGrid/Resend/SES) now, or keep the console-log stub? The candidate assessment feature heavily relies on email delivery.

> [!IMPORTANT]
> ~~**Q2: Billing/Payments** — Should I scaffold Stripe integration for seat-based billing, or treat Enterprise accounts as manually provisioned for now?~~
> **Resolved**: Plans are admin-managed only. No billing integration. Admin uses `PATCH /admin/users/:userId/plan` to set plans.

> [!NOTE]
> **Q3: Candidate exam UI** — The candidate exam page (`/assess/:token`) needs to work without authentication. Currently the `ExamPage.tsx` uses `ProtectedRoute`. Should the candidate exam be a completely separate page (recommended) or should we modify ExamPage to support guest mode?

> [!NOTE]
> **Q4: Implementation approach** — Should I implement all 6 phases at once, or would you prefer to start with Phase 1 and iterate?

> [!IMPORTANT]
> **Q5: PREMIUM Max Seats** — Should PREMIUM orgs be hard-capped at 10 seats, or should admin be able to override `maxSeats` per org via the admin panel?

> [!NOTE]
> **Q6: Plan Downgrade** — Current spec grandfathers existing orgs when a user is downgraded (e.g., PREMIUM → FREE). The user keeps their org but cannot create new ones. Confirm this is acceptable.

---

## Verification Plan

### Automated Tests

Each phase includes:

1. **Unit tests** for services (`.spec.ts` files):
   - `organizations.service.spec.ts` — org CRUD, invite flow, join link, seat limits
   - `org-questions.service.spec.ts` — question CRUD, clone, bulk import, review workflow
   - `exam-catalog.service.spec.ts` — catalog CRUD, start exam, prerequisite checking
   - `assessments.service.spec.ts` — assessment CRUD, candidate invite, scoring
   - `candidate.service.spec.ts` — token validation, attempt flow, anti-cheat events
   - `org-analytics.service.spec.ts` — aggregation queries

2. **Integration tests** (E2E):
   ```bash
   # Per phase, verify full request cycle
   npm run test:e2e -- --testPathPattern=organizations
   npm run test:e2e -- --testPathPattern=org-questions
   npm run test:e2e -- --testPathPattern=exam-catalog
   npm run test:e2e -- --testPathPattern=assessments
   ```

3. **Build verification**:
   ```bash
   cd backend && npm run build
   cd .. && npm run build
   ```

### Manual Verification

1. **Phase 1**: Create org → invite user → user accepts → verify member list → change roles → remove member
2. **Phase 2**: Create private question → approve → verify not visible to non-org users → clone public question
3. **Phase 3**: Create catalog exam → assign to group → member takes exam → verify results
4. **Phase 4**: Create assessment → invite candidate email → open link → take exam → verify results dashboard
5. **Phase 5**: After generating test data, verify analytics charts show correct aggregations
6. **Phase 6**: Plan enforcement + admin org management + frontend polish:
   - FREE user attempts org creation → 403
   - PREMIUM user creates 1 org → success; attempts 2nd → 403
   - ENTERPRISE user creates up to 3 orgs
   - ADMIN user creates unlimited orgs
   - FREE user attempts join via link → 403
   - FREE user accepts email invite → success
   - Admin sets user plan via `PATCH /admin/users/:userId/plan`
   - Admin lists/edits/deletes any organization
   - Navbar shows "Organization" for PREMIUM/ENTERPRISE users with no memberships
   - Navbar hides "Organization" for FREE users with no memberships
   - OrgSelector shows correct messaging per plan

### Browser Testing

Use browser subagent to verify:
- Org creation flow end-to-end (with plan checks)
- Member invite → accept → visible in member list
- Candidate exam flow (no auth, token-based)
- Org dashboard analytics rendering
- FREE user sees appropriate "invite only" messaging
- Admin org management panel
