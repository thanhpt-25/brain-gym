# Privacy Events & Data Collection Audit

This document tracks all tables and models that collect, store, or process user behavior events and personal data. Use this for compliance audits, retention policies, and privacy impact assessments.

---

## Event Tables

| Table                     | Model                  | Fields                                                                            | Retention                      | Purpose                                 | GDPR Impact                | Notes                                                                 |
| ------------------------- | ---------------------- | --------------------------------------------------------------------------------- | ------------------------------ | --------------------------------------- | -------------------------- | --------------------------------------------------------------------- |
| `attempt_events`          | `AttemptEvent`         | `userId, certificationId, score, answers, duration, submittedAt`                  | 7 years (compliance)           | Exam history + scoring                  | HIGH (learning profile)    | Pseudonymized in analytics; hash for re-identification guard          |
| `readiness_scores`        | `ReadinessScore`       | `userId, certificationId, score, signals (JSON), createdAt`                       | 7 years                        | Mastery prediction input                | MEDIUM (computed profile)  | Generated from attempt_events; no direct PII                          |
| `llm_usage_events`        | `LlmUsageEvent`        | `userId, orgId?, feature, modelId, inputTokens, outputTokens, costUsd, createdAt` | 90 days (cost tracking)        | LLM cost allocation + quota enforcement | LOW (operational only)     | No prompt/response content logged; tokens only                        |
| `pass_likelihood_surveys` | `PassLikelihoodSurvey` | `userId, certificationId, score (1–10), submittedAt`                              | 2 years (predictor validation) | Validate readiness score correlation    | MEDIUM (confidence signal) | One response per user per cert; tied to readiness for validation only |

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
4. **Pass likelihood surveys** (2 years): Delete after predictor validation complete (Sprint 5 retro). Earlier deletion on user request.
5. **Feature flags** (indefinite): Retain; non-identifying, purely operational.

---

## GDPR/Privacy Checklist

- [x] All tables have a `createdAt` timestamp for audit trail.
- [x] `userId` is always included for subject access requests (SAR).
- [x] High-impact tables have a retention rule defined above.
- [x] No plaintext passwords, API keys, or credentials stored.
- [x] PII (name, email, phone) stored separately in `User` table; event tables reference by `userId` only.
- [ ] Data minimization: Remove `inputTokens` + `outputTokens` from `LlmUsageEvent` if not strictly necessary (to be evaluated in cost-audit).

---

## Cross-Cutting Notes

- **Logging**: Error logs may contain request metadata (IP, user agent, timestamps). Audit logs subject to 90-day retention (Postgres `audit.log`).
- **Caching**: Redis keys include `userId`. Flushing on user deletion is manual; consider adding `DEL user:<userId>:*` to the delete handler.
- **Analytics**: Segment (or equivalent) receives only anonymized daily cohort stats (no raw events). Subject to separate processor agreement.
- **Third-party integrations**: Any LLM provider (OpenAI, Anthropic, etc.) receives model input only; full chat history NOT sent.
