# RLS Rollout Status — RFC-006

This document tracks Row-Level Security (RLS) rollout progress across all multi-tenant tables.
RLS policies use `current_setting('app.org_id', true)` set per-request by `RlsInterceptor`.

---

## Phase Status

| Phase | Tables                                     | Migration                   | Status      | Sprint |
| ----- | ------------------------------------------ | --------------------------- | ----------- | ------ |
| 1     | `org_members`, `org_questions`             | `20260509000000_rls_phase1` | ✅ Complete | S4     |
| 2     | `org_groups`, `org_invites`, `assessments` | `20260529000004_rls_phase2` | ✅ Complete | S5     |
| 3     | `org_exam_catalog`, `org_analytics`        | TBD                         | ⏳ Planned  | S6     |

---

## Phase-1 Detail (Sprint 4)

**Tables:** `org_members`, `org_questions`

**Policy:** `FOR ALL USING (org_id::text = COALESCE(current_setting('app.org_id', true), ''))`

**Test coverage:** `backend/test/security/rls.cross-org.e2e-spec.ts` — `org_members RLS`, `org_questions RLS`

---

## Phase-2 Detail (Sprint 5 — US-502)

**Tables:** `org_groups`, `org_invites`, `assessments`

**Policy:** Same pattern as Phase-1 — `FOR ALL USING / WITH CHECK` on `org_id`.

**Test coverage:** `backend/test/security/rls.cross-org.e2e-spec.ts` — `org_groups RLS`, `org_invites RLS`, `assessments RLS`

**Guard layer:** `OrgRoleGuard` on all three route groups enforces `app.org_id` at application level; RLS adds defense-in-depth at DB level.

---

## Superuser Bypass

DB superuser connections (e.g., migrations, seed scripts) bypass RLS by default.
Application runtime uses a restricted role (`app_user`) that respects RLS policies.
Ensure migration runner uses a role with `BYPASSRLS` privilege if running `ALTER TABLE … FORCE ROW LEVEL SECURITY`.

---

## Monitoring

- `pg_stat_user_tables` — monitor seq scans; RLS adds index-unfriendly filter if `org_id` index is missing.
- All tables covered by phase-1 and phase-2 have `org_id` indexed (`org_id_idx`).
