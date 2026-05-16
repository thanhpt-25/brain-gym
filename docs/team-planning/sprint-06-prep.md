# Sprint 6 Planning — "Next Frontier: AI Coach + Scenarios"

**Date Created:** 2026-06-02 (Sprint 5 retro, US-511)  
**Sprint Duration:** 2026-06-12 → 2026-06-26 (2 weeks)  
**Capacity:** TBD (pending retro + team availability)  
**Version Planning:** v1.4.0 (post v1.3.0-alpha)

---

## 1. Context from Sprint 5

**Sprint 5 Achievements (v1.3.0-alpha):**

- ✅ Predictor validation: r=0.5823 (moderate correlation) → widen rollout approved
- ✅ RLS phase-2: org_groups, org_invites, assessments enforced
- ✅ Behavioral Insights: 3 kinds shipped, nightly job stable
- ✅ Squads: Create/invite/join API + Dashboard skeleton live
- ✅ LLM quota: Daily cap enforced, 429 blocking working
- ✅ Reviewer Queue: MVP shipped, flag backlog cleared
- ✅ Strict TypeScript: New modules all in strict TS mode (RFC-009)

**Velocity:** 44 SP completed / 48 allocated = 91.7%  
**Known Blockers for Sprint 6:**

- Predictor rollout monitoring (ongoing)
- Behavioral Insight accuracy tuning (signal/noise ratio)
- Squad adoption signals (early beta feedback)

---

## 2. Sprint 6 Candidates

### High Priority (Dependencies on Sprint 5)

**US-011: Squad Daily Challenge (~5 SP)**

- **Owner:** Senior FE + BE
- **Description:** Daily themed quiz within squad context; sync with target exam date
- **Dependencies:** ✅ US-505, US-506 (Squads foundation ready)
- **AC:**
  - Squad member sees "Today's challenge: X questions on Domain Y" card
  - Challenge data pre-filtered by squad's certification + difficulty level
  - Results aggregated per squad → leaderboard card
  - Gamification: badges for streak (3 days, 7 days, 30 days)
- **Risks:** UI design scope creep; team appetite for gamification unclear
- **Estimate:** 5 SP (design 1, FE 2, BE 2)

**US-015: Burnout Detection (~3 SP)**

- **Owner:** Senior BE + Data
- **Description:** Alert user if study cadence drops sharply (e.g., no activity 3+ days after 2+ weeks of daily use)
- **Dependencies:** ✅ US-503 (Behavioral Insights pipeline ready)
- **AC:**
  - Detection: N-day activity window → flag if streak broken
  - Alert: Email or in-app banner (PO to decide)
  - Exemption: User can snooze for 1 week
  - Data: Log event to `BehavioralEvent` for retry logic
- **Risks:** False alerts = spam; tuning thresholds requires UX validation
- **Estimate:** 3 SP (detection 2, alerts + exemption 1)

**RFC-010 Hardening: AI Coach 1-1 Beta (~8 SP, blocked on retention analysis)**

- **Owner:** Senior BE + Product
- **Description:** Spike from Sprint 4; hardened for broader beta rollout
- **Dependencies:** Retention analysis of Sprint 4 alpha cohort (user engagement >50% Day 7+)
- **AC:**
  - Retention data analyzed; cohort size and effect size confirmed
  - Session persistence + multi-turn conversation state robust
  - Rate limiting: 10 coach sessions/day per PREMIUM user
  - Cost modeling: LLM cost per session < $0.10 (or revenue impact acceptable)
  - Monitoring: Error logs, session abandonment rate, cost/user/month
- **Risks:** High LLM cost if overused; requires tier-locked rollout
- **Estimate:** 8 SP (if retention passes gate)

### Medium Priority (Nice-to-Have)

**E4 Spike: Scenario Engine — Text Comprehension + Contextual QA (~5 SP spike)**

- **Owner:** Senior BE + ML (spike only; full feature = Sprint 7+)
- **Description:** Proof-of-concept for passage-based questions (read 200–400 word scenario, answer 3–5 questions in context)
- **Dependencies:** None (independent research)
- **Spike AC:**
  - [ ] Evaluate existing prompt template for scenario → QA generation
  - [ ] Assess accuracy vs. single-question generation (compare to Sprint 4 baselines)
  - [ ] Estimate token cost per scenario (pilot cost model)
  - [ ] Design assessment flow UI (FE spike 2 SP)
  - [ ] Document findings in RFC-011 (implementation RFC, deferred to Sprint 7)
- **Risks:** LLM quality may be lower for complex scenarios; may need fine-tuning
- **Estimate:** 5 SP spike; 13 SP for full feature (deferred)

**US-514 Candidate: Squad Activity Feed (Future, ~5 SP)**

- **Owner:** FE
- **Description:** Feed showing member progress, insights, exam dates in squad context
- **Dependencies:** US-506 (Squad Dashboard done); US-011 (Daily Challenge done)
- **Rationale:** Deferred to allow Squad MVP stabilization + adoption signals
- **Hold reason:** Team bandwidth; US-011 + US-015 + RFC-010 hardening take priority

---

## 3. Backlog (Sprint 7+)

- **Squad Settings Page (US-513, ~3 SP):** Edit target exam date, member capacity, squad name
- **Scenario Engine Full Feature (RFC-011, ~13 SP):** Post-spike implementation
- **Predictor Tuning (Sprint 6 backlog, ~5 SP):** If live rollout signal < 0.45 correlation
- **AI Coach Production Rollout (RFC-010 Phase 2, ~5 SP):** Widen beyond beta, tier logic, cost monitoring
- **Burnout Response System (US-015 Phase 2, ~3 SP):** Personalized re-engagement flows

---

## 4. Metrics & Success Criteria

### Sprint 6 Goals

| Goal                                  | Metric                     | Target                          | Owner     |
| ------------------------------------- | -------------------------- | ------------------------------- | --------- |
| **Squads adoption**                   | Active squads created      | >50 squads                      | Product   |
| **Daily Challenge adoption**          | % squad members playing    | >30%                            | Senior FE |
| **Burnout detection accuracy**        | False alert rate           | <5%                             | Senior BE |
| **AI Coach retention (RFC-010 gate)** | Day 7+ retention           | >50%                            | Product   |
| **Scenario spike learnings**          | RFC-011 ready for Sprint 7 | Quality + cost model documented | Senior BE |
| **Code quality**                      | Test coverage on new code  | ≥80%                            | QA        |
| **Performance**                       | Core Web Vitals            | LCP <2.5s, CLS <0.1             | FE        |

---

## 5. Risk Assessment

| Risk                                                           | P×I | Mitigation                                                        |
| -------------------------------------------------------------- | --- | ----------------------------------------------------------------- |
| AI Coach 1-1 retention <50% → RFC-010 cannot harden            | M×H | Analyze data early (Week 1); fallback: defer to Sprint 7          |
| Squad adoption slow (<20 squads) → signal of product fit issue | M×H | Daily Challenge + community nudges may accelerate adoption        |
| LLM costs spike if Coach widely used in beta                   | M×M | Implement session cap + cost alerts before wider rollout          |
| Scenario spike uncovers unsolvable LLM limitation              | L×M | Pre-spike: review prompt template with AI team                    |
| Burnout detection too noisy → user frustration                 | L×H | Start with high threshold (7-day break); tune based on early data |

---

## 6. Cross-Cutting Tasks

| Task                                                          | Owner          | Sprint 6   | Notes                             |
| ------------------------------------------------------------- | -------------- | ---------- | --------------------------------- |
| **Retention analysis (AI Coach gate)**                        | Data/Product   | Week 1     | Blocks RFC-010 hardening decision |
| **Privacy doc: Squad activity, Burnout events**               | Tech Lead      | By Day 4   | Required for feature rollout      |
| **Grafana dashboards: Squad metrics, Burnout triggers**       | Platform       | By Day 4   | Monitoring for all new features   |
| **Feature flags: FF_SQUAD_DAILY_CHALLENGE, FF_BURNOUT_ALERT** | Platform       | By Day 2   | Rollout gates                     |
| **UI design: Daily Challenge card, Burnout UX**               | Design         | By Day 3   | FE implementation depends on      |
| **RFC-010 decision (retain → hardening, or defer)**           | PO + Tech Lead | EOD Week 1 | Go/no-go for broader beta         |

---

## 7. Definition of Ready

**Per story, ensure:**

- [ ] RFC/ADR written (if schema change or architectural decision)
- [ ] AC reviewed and signed by PO
- [ ] Dependency chain verified (nothing blocked)
- [ ] Design mockups approved (FE stories)
- [ ] Capacity allocated (team confirmed availability)

---

## 8. Success Checklist (Sprint 6 Exit)

- [ ] Squad Daily Challenge live behind FF_SQUAD_DAILY_CHALLENGE (if 5+ squads active)
- [ ] Burnout detection running; false-alert rate <5%
- [ ] AI Coach retention analysis complete; RFC-010 decision finalized
- [ ] Scenario Engine spike done; RFC-011 (implementation) queued for Sprint 7
- [ ] All new code ≥80% test coverage
- [ ] Docs updated (RFC-010, RFC-011, privacy docs)
- [ ] Zero CRITICAL/HIGH issues from code review agents
- [ ] Staging demo-able for stakeholder review

---

## 9. Team Capacity Estimate

| Role      | Availability | Allocation (Tentative)                                                                                            |
| --------- | ------------ | ----------------------------------------------------------------------------------------------------------------- |
| Senior FE | 11 SP        | US-011 Daily Challenge (2.5 SP FE portion) + E4 spike design (2) + polish (2) + buffer (2.5)                      |
| FE        | 9 SP         | Daily Challenge (2), Burnout UX (1), testing (2), support (2), buffer (2)                                         |
| Senior BE | 11 SP        | US-015 Burnout (2 SP), RFC-010 retention analysis (1), RFC-010 hardening (4), E4 spike LLM (2), buffer (2)        |
| BE        | 9 SP         | US-011 Daily Challenge (2.5 SP BE portion), US-015 Burnout (1), RFC-010 monitoring (1), support (2), buffer (2.5) |
| Data      | 4 SP         | Retention analysis (2), Burnout threshold tuning (1), dashboards (1)                                              |
| Platform  | 3 SP         | Feature flags, Grafana setup, privacy docs                                                                        |
| **Total** | **~48 SP**   | **Assuming RFC-010 go-ahead**                                                                                     |

**If RFC-010 is no-go**, redistribute 8 SP to: Squad Settings page (US-513), Squad Activity Feed (US-514), or Predictor tuning backlog.

---

## 10. Decision Gates

### Gate 1: AI Coach 1-1 Retention (EOD Week 1)

**Gate Condition:** Day 7+ retention >50% from Sprint 4 alpha cohort  
**Go:** Proceed with RFC-010 hardening (8 SP assigned)  
**No-Go:** Defer RFC-010 to Sprint 7; use 8 SP for US-513 + US-514 + Predictor tuning

### Gate 2: Squad Adoption Signal (EOD Week 2)

**Gate Condition:** ≥5 squads active after 1 week of Sprint 6  
**Go:** Proceed with US-011 Daily Challenge full scope  
**Caution:** If <3 squads, re-evaluate product fit; consider scaling back scope

### Gate 3: LLM Cost Modeling (By Day 3, Sprint 6)

**Gate Condition:** Cost per AI Coach session modeled <$0.10 or budget approved  
**Go:** Roll out wider beta with tier-locking (PREMIUM only)  
**No-Go:** Cap usage further; re-model for Sprint 7

---

## 11. Sprint 6 Calendar

| Week                   | Focus             | Key Deliverables                                                     |
| ---------------------- | ----------------- | -------------------------------------------------------------------- |
| Week 1 (Jun 12–Jun 16) | Discovery + gates | Retention analysis done; RFC-010 decision made; E4 spike research    |
| Week 2 (Jun 19–Jun 23) | Implementation    | Daily Challenge + Burnout live behind flags; Scenario spike finished |
| Week 3 (Jun 26)        | Polish + demo     | Testing, docs, stakeholder review, tag v1.4.0-beta                   |

---

## 12. Artifacts

- **RFC-010 Hardening Decision:** Will be written by PO/Tech Lead by EOD Week 1
- **RFC-011 (Scenarios Implementation):** Will be written by Senior BE post-spike
- **Privacy Documents:** Squad activity + Burnout events retention + usage
- **Monitoring Dashboards:** Squad metrics, Burnout triggers, Coach session costs
- **Retrospective:** Sprint 6 learnings doc (to be completed by Sprint 7 retro)

---

## Sign-Off

- **Product Owner:** ⏳ Pending retro approval
- **Tech Lead:** ⏳ Pending retro approval
- **Engineering Leads:** ⏳ Pending team capacity discussion

**Prepared by:** SM (US-511)  
**Date:** 2026-06-02  
**Status:** DRAFT (awaiting Sprint 5 retro finalization)
