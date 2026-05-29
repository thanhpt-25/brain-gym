# Sprint 12 GA Readiness Checklist

**Target Release:** v2.0.0 GA (full cohort)  
**Timeline:** 2026-07-08 → 2026-07-22 (2 weeks)  
**Objective:** Remove cohort gates, load test, final polish → GA release

---

## Pre-Release (Week 1: Jul 08–12)

### Cohort Gate Removal

- [ ] Remove `betaRewritersCohort` gate: DDS auto-apply open to all users
- [ ] Remove `betaScholarsCohort` gate: Reputation anti-gaming open to all users
- [ ] Verify feature flags: all flags set to true in production
- [ ] Database migration: no impact to existing data

### Monitoring & Incident Response

- [ ] Grafana dashboards staffed: on-call rotation created
- [ ] PagerDuty escalation: alerts route to on-call engineer
- [ ] Incident response playbook: document for each alert type
- [ ] War room setup: Slack channel #v2-ga-incident

### Customer Communication

- [ ] GA announcement email drafted and reviewed
- [ ] Blog post: "v2.0 in production — 50% faster DDS, reputation safety"
- [ ] Release notes polished (fix typos, verify links, update dates)
- [ ] Social media: Twitter, LinkedIn posts scheduled

---

## Performance Testing (Week 1–2: Jul 08–15)

### Load Test: 10k Concurrent Study Sessions

**Metrics to Monitor:**

- [ ] Embed API latency p95 <500ms
- [ ] DDS latency p95 <200ms
- [ ] DB connection pool utilization <80%
- [ ] API error rate <0.1%
- [ ] Frontend Lighthouse score ≥95

**Timeline:**

- Mon 07-08: Set up load test environment
- Tue 07-09: Run baseline test
- Wed 07-10: Tune if needed
- Thu 07-11: Final validation run

### Database Performance Profile

- [ ] Identify N+1 queries introduced in v2.0
- [ ] Overlap compute latency: <2s for 500 questions
- [ ] Reputation query latency: <500ms for vote-ring detection

---

## Quality & Accessibility (Week 2: Jul 15–22)

### Lighthouse Audit: Mobile ≥95

- [ ] Dark mode: ≥95
- [ ] Light mode: ≥95
- [ ] Performance: <3.5s LCP
- [ ] Accessibility: WCAG AA all pages

### Accessibility Deep Dive

- [ ] Keyboard navigation: Tab through all elements
- [ ] Reduced-motion: animations honor preference
- [ ] Screen reader testing: logical heading hierarchy
- [ ] Color contrast: WCAG AA minimum (4.5:1)
- [ ] Mobile touch targets: 48×48px minimum

### Cross-Browser Testing

- [ ] Chrome, Firefox, Safari, Edge desktop
- [ ] iOS Safari, Android Chrome mobile
- [ ] Responsive layout: no overflow on 375px width
- [ ] Touch interactions: buttons tappable

---

## Observability & Monitoring (Week 1–2)

### Grafana Dashboard Extensions

- [ ] DDS latency histogram (p50, p95, p99)
- [ ] Reputation false-positive rate
- [ ] KG recompute frequency + duration
- [ ] LLM cost per cert, token usage
- [ ] DB connection pool utilization

### Alert Tuning Post-RC

- [ ] Rollback-rate threshold: adjust if needed (currently 5%)
- [ ] Jailbreak detection: assess alert volume
- [ ] Embedding timeout: set realistic p95 threshold

---

## Post-Release Monitoring (Week 2–3: Jul 22–Aug 04)

### 48-Hour Post-GA Watch

**On-Call Team:** Security + Backend + DevOps (8-hour shifts)

**Metrics to Watch:**

- [ ] DDS approval rate: expect >80%
- [ ] Rollback rate: expect <5%
- [ ] Jailbreak attempt rate: expect <5/hour
- [ ] API error rate: expect <0.05%

### First Week (Jul 22–28)

- [ ] Monitor #feedback Slack channel
- [ ] Collect customer success feedback
- [ ] Check feature adoption rates
- [ ] Verify latency targets in production

### False Positive Tuning

- [ ] Reputation anti-gaming: monitor cleared vs. confirmed ratio
- [ ] Jailbreak detection: review flagged attempts

---

## Sign-Off Checklist

**Ready for GA when:**

- [ ] Load test passed (all metrics within targets)
- [ ] Lighthouse audit: ≥95 on mobile
- [ ] Cross-browser testing: all major browsers pass
- [ ] Customer comms: GA email + blog ready
- [ ] Monitoring: on-call rotation, incident playbook

**Approval Workflow:**

1. Tech Lead: Performance + load test sign-off
2. Product Lead: Feature readiness
3. Security Lead: Threat model review
4. Head of Eng: Final GA decision

**Go-Live:** Thu 2026-07-22 (assuming all checks pass)

---

**Created by:** Security & Release team  
**Date:** 2026-05-29
