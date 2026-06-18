# ADR-024 — DDS Auto-Apply Policy

**Status:** Accepted  
**Date:** 2026-05-23  
**Deciders:** AI Lead, Tech Lead, Platform  
**Related:** RFC-010 (DDS spec), US-1003, US-1004

---

## Context

Sprint 9 shipped the Dynamic Difficulty Scaling (DDS) pipeline in propose-only mode: questions could be rewritten by the LLM, but every variant required a human reviewer to approve before it was applied. As adoption grows, the manual review bottleneck will prevent DDS from scaling. Sprint 10 adds an **auto-apply gate** that allows high-confidence variants to be applied automatically once a cohort has accumulated sufficient clean approvals.

The key constraints:

1. **Correctness invariant** — a variant must not change the correct answer identity, only rephrase distractors/stem.
2. **Reversibility** — any auto-applied variant must be rollback-able to the original in one action.
3. **Kill-switch** — disabling the feature must halt new auto-applies immediately, without touching already-applied variants.
4. **Privacy/audit** — every auto-apply must be traceable: who triggered it, why, and when.

---

## Decision

### Feature flag and cohort gating

Auto-apply is controlled by environment variables:

| Variable                   | Default | Meaning                                                           |
| -------------------------- | ------- | ----------------------------------------------------------------- |
| `DDS_AUTO_APPLY_ENABLED`   | `false` | Master kill-switch. Must be `"true"` to enable.                   |
| `DDS_AUTO_APPLY_THRESHOLD` | `30`    | Minimum number of APPROVED variants before auto-apply fires.      |
| `DDS_SHADOW_MODE`          | `true`  | Used only during cohort promotion (`POST …/promote`) to set the initial `DdsConfig.shadowModeEnabled` DB flag. At runtime, `tryAutoApply` reads `DdsConfig.shadowModeEnabled` from the database, not this env var. |

**Shadow mode is the safe default.** Each cohort's live/shadow state is stored in `DdsConfig.shadowModeEnabled`. This allows the decision logic to run in production — logging decisions — without touching data. The Gate 2 sign-off (≥30 clean approvals, 0 correctness violations) is required before promoting a cohort to live mode via `POST /ai-question-bank/dds/auto-apply/promote`.

### Decision algorithm (`evaluateAutoApply`)

1. If `DDS_AUTO_APPLY_ENABLED ≠ "true"` → `shouldApply=false`, reason="disabled"
2. If variant not found or not PENDING → `shouldApply=false`
3. Count APPROVED variants in system
4. `shouldApply = approvedCount ≥ DDS_AUTO_APPLY_THRESHOLD`

### Execution path (`tryAutoApply`)

When `shouldApply=true` and `DDS_SHADOW_MODE="false"`:

1. Reuse `approve()` transaction — identical path to human review.
2. Set `reviewedBy = "auto"`, `reviewNote = "auto-applied (cohort=…, threshold=…, approvedCount=…)"`.
3. The existing `diff.originalChoices` in the variant preserves the pre-apply state; `rollback()` restores it atomically.

### Quota guard (`proposeVariant`)

`proposeVariant` calls `LlmQuotaService.enforceQuota(orgId)` **before** any LLM call. If the org is over quota, HTTP 429 is thrown; no variant is created and no token usage is logged.

---

## Rationale

**Why reuse `approve()` rather than a separate path?**  
The approve transaction is the battle-tested path for applying a variant. Duplicating it for auto-apply would create divergence risk. By reusing it with `reviewedBy='auto'`, the audit trail is identical in structure to human review.

**Why threshold-based rather than per-question confidence?**  
A per-question confidence model would require a calibration layer on top of LLM outputs — more complexity, more surface for miscalibration. The threshold approach is conservative, predictable, and auditable: the system only auto-applies when it has demonstrated sustained quality at the cohort level.

**Why shadow mode default?**  
We cannot verify correctness violations in the wild until we have production data. Shadow mode accumulates evidence (logged decisions) without risk. Gate 2 converts evidence into confidence before live applies begin.

---

## Consequences

**Positive:**

- Auto-apply scales DDS to thousands of variants without linear reviewer growth.
- Kill-switch and shadow mode provide two independent safety layers.
- Rollback is always available; no auto-applied change is permanent.
- Audit trail (`reviewedBy='auto'`, `reviewNote`) is queryable for compliance.

**Risks:**

- Threshold-based gating does not distinguish per-question quality — a high threshold mitigates but does not eliminate the risk of a bad auto-apply.
- Shadow mode state is stored in `DdsConfig.shadowModeEnabled` (DB flag per cohort); canary auto-pause updates this without a redeploy. Manual promotion still requires an authenticated API call.

---

## Review Gate (Gate 2)

Before setting `DDS_SHADOW_MODE=false`:

| Condition                                                          | Outcome                      |
| ------------------------------------------------------------------ | ---------------------------- |
| ≥30 APPROVED variants, 0 correctness violations, rollback verified | GO                           |
| Any correctness violation or rollback failure                      | HOLD — remain in shadow mode |

Owner: AI Lead. Gate 2 outcome recorded in Sprint 10 execution log.
