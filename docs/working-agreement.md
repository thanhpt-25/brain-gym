# Working Agreement — CertGym Scrum Team

Effective from Sprint 1 (2026-04-29). Reviewed at the end of each quarter.

## 5 Mandatory Norms

1. **PR ≤ 400 LOC** — If exceeded, notify the Scrum Master and provide a clear justification.
2. **CI must be green before merge** — Do not bypass with `--no-verify`. CI includes: lint, type-check-strict, unit tests, and e2e smoke.
3. **A story is Done only when it can be demoed on staging** — Local machine does not count.
4. **Blockers lasting > 4 hours must be escalated to the SM** — Do not stay silent for the rest of the day.
5. **Observed tech debt must be logged immediately** — Create a Linear ticket on the spot; do not fix it silently inside a feature PR.

## Ceremonies (2-week Sprint, Wed → Tue)

- **Wed W1**: Sprint Planning (90 min)
- **Mon + Thu**: Blocker sync (15 min)
- **Tue W2**: Sprint Review + Demo (45 min) → Retrospective (45 min)
- **Thu biweekly**: Backlog Refinement (60 min)
- **Fri weekly**: Tech Sync (30 min)

## Communication

- Async-first: standups, status updates, and code reviews via Slack
- Sync only for: planning, retros, incidents, major architecture decisions, and conflict resolution
- A Slack thread with > 10 replies must be converted to a doc + a meeting
