# Working Agreement — CertGym Scrum Team

Hieu luc tu Sprint 1 (2026-04-29). Review cuoi moi quy.

## 5 Quy uoc bat buoc

1. **PR <= 400 LOC** — Neu vuot, phai thong bao SM va co ly do ro rang.
2. **CI phai xanh truoc merge** — Khong bypass `--no-verify`. CI bao gom: lint, type-check-strict, unit test, e2e smoke.
3. **Story chi Done khi demo duoc tren staging** — Khong tinh local machine.
4. **Blocker > 4 gio phai goi SM** — Khong im lang ket ca ngay.
5. **Tech debt thay la log ngay** — Tao Linear ticket ngay, khong sua len trong PR feature.

## Ceremonies (Sprint 2 tuan, Wed→Tue)

- **Wed W1**: Sprint Planning (90 phut)
- **Mon + Thu**: Sync blocker (15 phut)
- **Tue W2**: Sprint Review + Demo (45 phut) → Retrospective (45 phut)
- **Thu biweekly**: Backlog Refinement (60 phut)
- **Fri hang tuan**: Tech Sync (30 phut)

## Communication

- Async-first: standup, status update, code review qua Slack
- Sync chi khi: planning, retro, incident, kien truc lon, conflict
- Thread Slack > 10 reply → tao doc + meeting
