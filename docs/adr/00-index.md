# Architecture Decision Record (ADR) Index

This directory contains architecture decision records for CertGym. Each ADR documents a significant technical or organizational decision, its context, and rationale.

## Status Legend

- **Accepted** — Implemented and in production
- **Proposed** — Under discussion
- **Superseded** — Replaced by a newer ADR
- **Deprecated** — No longer recommended

---

## Active ADRs

| ID  | Title                                           | Status   | Sprint | Last Updated |
| --- | ----------------------------------------------- | -------- | ------ | ------------ |
| 001 | BullMQ for async job processing                 | Accepted | S9     | 2026-04-29   |
| 002 | Question SRS field schema                       | Accepted | S9     | 2026-04-29   |
| 003 | Pass predictor v0 model architecture            | Accepted | S9     | 2026-05-02   |
| 009 | Strict TypeScript rollout (tsconfig strictness) | Accepted | S10    | 2026-05-16   |
| 024 | DDS auto-apply proposal-to-approval workflow    | Accepted | S10    | 2026-05-24   |
| 025 | Reputation model and tier thresholds            | Accepted | S10    | 2026-05-24   |
| 026 | DDS auto-apply GA & canary promotion policy     | Accepted | S11    | 2026-05-24   |
| 027 | Reputation anti-gaming detection thresholds     | Accepted | S11    | 2026-05-24   |

---

## Related RFCs

- **RFC-007:** Knowledge graph schema (accepted, S10)
- **RFC-010:** Study plan auto-scheduling (accepted, S10)

---

## Reading Guide

**For new team members:**
Start with ADR-009 (TypeScript policy) and ADR-025 (reputation model) to understand project standards.

**For implementing DDS auto-apply:**
Read ADR-024 (workflow), then ADR-026 (GA canary policy) in sequence.

**For reputation/peer-review work:**
Read ADR-025 (tiers) then ADR-027 (anti-gaming) together.

---

## Historical ADRs (Not Currently Active)

Legacy ADRs prior to S9 are archived in the git history but not linked here as they have been superseded by more recent decisions.
