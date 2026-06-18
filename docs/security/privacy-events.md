# Privacy Events & Data Collection Audit

This document tracks all tables and models that collect, store, or process user behavior events and personal data. Use this for compliance audits, retention policies, and privacy impact assessments.

---

## Event Tables

| Table                     | Model                  | Fields                                                                                              | Retention                      | Purpose                                  | GDPR Impact                | Notes                                                                 |
| ------------------------- | ---------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------ | ---------------------------------------- | -------------------------- | --------------------------------------------------------------------- |
| `attempt_events`          | `AttemptEvent`         | `id, attemptId, userId, questionId?, eventType, payload (JSON), clientTs, createdAt`                | 7 years (compliance)           | Per-question interaction stream in exams | HIGH (learning profile)    | Payload content varies by eventType; no raw answers stored here       |
| `readiness_scores`        | `ReadinessScore`       | `id, userId, certificationId, score (0-100), confidence, attempts, signals (JSON), computedAt`      | 7 years                        | Mastery prediction input                 | MEDIUM (computed profile)  | Generated from attempt_events; no direct PII                          |
| `llm_usage_events`        | `LlmUsageEvent`        | `id, userId?, orgId?, feature, modelId, inputTokens, outputTokens, costUsd, createdAt`              | 90 days (cost tracking)        | LLM cost allocation + quota enforcement  | LOW (operational only)     | No prompt/response content logged; tokens only                        |
| `pass_likelihood_surveys` | `PassLikelihoodSurvey` | `id, userId, certificationId, score (1–10), submittedAt`                                            | 2 years (predictor validation) | Validate readiness score correlation     | MEDIUM (confidence signal) | One response per user per cert; tied to readiness for validation only |

---

## Audit Log Table

The `audit_logs` table records privileged and security-relevant actions across the platform. This is an application-level audit trail, not a database-level log.

**Schema** (`AuditLog` model):

| Field        | Type      | Notes                                             |
| ------------ | --------- | ------------------------------------------------- |
| `id`         | UUID      | Primary key                                       |
| `userId`     | String    | Actor who performed the action                    |
| `action`     | String    | Free-text action name (see known actions below)   |
| `targetType` | String    | Entity type affected (e.g., `user`, `question`)   |
| `targetId`   | String    | ID of the affected entity                         |
| `metadata`   | JSON?     | Additional context (role, plan, reason, etc.)     |
| `ipAddress`  | String?   | Source IP if available                            |
| `createdAt`  | DateTime  | Timestamp                                         |

**Known action strings** (as used in application code):

| Action                  | Source                                    |
| ----------------------- | ----------------------------------------- |
| `JAILBREAK_ATTEMPT`     | `coach-safety.service.ts`                 |
| `FLASHCARD_REVIEW_SUBMITTED` | `flashcards.service.ts`              |
| `QUESTION_EDITED`       | `questions.controller.ts`                 |
| `QUESTION_DELETED`      | `questions.controller.ts`                 |
| `ROLE_CHANGED`          | `users.controller.ts`                     |
| `PLAN_CHANGED`          | `users.controller.ts`                     |
| `USER_SUSPENDED`        | `users.controller.ts`                     |
| `USER_BANNED`           | `users.controller.ts`                     |
| `USER_REACTIVATED`      | `users.controller.ts`                     |
| `POINTS_ADJUSTED`       | `users.controller.ts`                     |
| `BULK_QUESTION_STATUS`  | `admin.controller.ts`                     |
| `BULK_USER_ROLE`        | `admin.controller.ts`                     |
| `UPDATE_USER_PLAN`      | `admin.controller.ts`                     |
| `CREATE_DOMAIN`         | `admin.controller.ts`                     |
| `UPDATE_DOMAIN`         | `admin.controller.ts`                     |
| `DELETE_DOMAIN`         | `admin.controller.ts`                     |
| `UPDATE_EXAM_VISIBILITY` | `admin.controller.ts`                    |
| `DELETE_SOURCE_MATERIAL` | `admin.controller.ts`                    |
| `CREATE_BADGE`          | `admin.controller.ts`                     |
| `UPDATE_BADGE`          | `admin.controller.ts`                     |
| `DELETE_BADGE`          | `admin.controller.ts`                     |
| `AWARD_BADGE`           | `admin.controller.ts`                     |
| `REVOKE_BADGE`          | `admin.controller.ts`                     |
| `UPDATE_ORGANIZATION`   | `admin.controller.ts`                     |
| `DELETE_ORGANIZATION`   | `admin.controller.ts`                     |
| `UPDATE_ORG_MEMBER_ROLE` | `admin.controller.ts`                    |
| `REMOVE_ORG_MEMBER`     | `admin.controller.ts`                     |

**Retention:** Audit logs are retained indefinitely by default. Apply a retention policy (e.g., 2 years) via a scheduled deletion job if required by compliance policy.

---

## User Behavioral Data (not event-persisted)

| Field/Behavior                | Source                  | Retention     | Purpose                                              | GDPR Impact             | Notes                                         |
| ----------------------------- | ----------------------- | ------------- | ---------------------------------------------------- | ----------------------- | --------------------------------------------- |
| `User.featureFlags`           | Feature rollout system  | Until opt-out | Per-user feature toggles (e.g., `passPredictorBeta`) | LOW                     | JSON field; no tracking of who sees what      |
| Streak count + quiz frequency | In-memory + local cache | Session-only  | UI state (streak badge)                              | NONE                    | Not persisted server-side                     |
| Search history (SRS, exams)   | `SearchLog` table (TBD) | 30 days       | UX improvements only                                 | MEDIUM (if implemented) | Requires user consent if full-text searchable |

---

## Data Retention & Deletion Policy

1. **Attempt events** (7-year hold for compliance per SOC 2): Delete on explicit user request only; flag for anonymization first if in active dispute.
2. **Readiness scores** (dependent on attempt_events): Cascade-delete on user deletion.
3. **LLM usage events** (90-day operational): Auto-expire; no manual action needed.
4. **Pass likelihood surveys** (2 years): Delete after predictor validation complete. Earlier deletion on user request.
5. **Feature flags** (indefinite): Retain; non-identifying, purely operational.
6. **Audit logs** (compliance retention TBD): Retain for investigation purposes; define and implement a retention window aligned with compliance requirements.

---

## GDPR/Privacy Checklist

- [x] All tables have a `createdAt` timestamp for audit trail.
- [x] `userId` is always included for subject access requests (SAR).
- [x] High-impact tables have a retention rule defined above.
- [x] No plaintext passwords, API keys, or credentials stored.
- [x] PII (name, email, phone) stored separately in `User` table; event tables reference by `userId` only.
- [ ] Data minimization: Remove `inputTokens` + `outputTokens` from `LlmUsageEvent` if not strictly necessary (to be evaluated in cost-audit).
- [ ] Audit log retention policy not yet defined; see item 6 above.

---

## Cross-Cutting Notes

- **Logging**: Error logs may contain request metadata (IP, user agent, timestamps). Application audit logs are stored in the `audit_logs` PostgreSQL table; retention is indefinite until a policy is configured.
- **Caching**: Redis keys include `userId`. Flushing on user deletion is manual; consider adding `DEL user:<userId>:*` to the delete handler.
- **Analytics**: Segment (or equivalent) receives only anonymized daily cohort stats (no raw events). Subject to separate processor agreement.
- **Third-party integrations**: Any LLM provider (OpenAI, Anthropic, etc.) receives model input only; full chat history NOT sent.
- **Candidate assessments**: The `assessments` and `assessment_attempts` tables store candidate PII (email collected for OTP delivery). These are org-scoped and protected by RLS (Phase-2). Candidate data is not linked to a `User` account unless the candidate registers separately.
