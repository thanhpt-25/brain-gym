# How to Promote DDS Auto-Apply from Shadow to Live

> Admin Guide for promoting the Diverse Dataset System (DDS) auto-apply engine from shadow mode to live (production).

---

## Overview

The DDS auto-apply engine starts in **shadow mode**—it proposes and approves variants automatically but does _not_ modify live questions. This allows us to collect metrics safely before enabling real, production impact.

**Gate 2 Promotion** moves DDS from shadow mode to live, at which point auto-apply decisions _do_ impact the production question bank.

---

## Before You Promote

### Readiness Checklist

Before flipping the switch, verify these conditions:

1. **Clean Approval Count ≥ 30**
   - Visit `/admin/dds/auto-apply`
   - Check the progress bar under "Gate 2 Readiness"
   - Current count must be ≥30 (target: "30/30")
   - **Why**: Statistically significant approval pool to validate consensus scoring

2. **Zero Correctness Violations**
   - On the same admin panel, verify "Violations: 0"
   - If any violations exist, investigate root cause before promoting
   - **Why**: Violations indicate the approval mechanism is accepting incorrect answers; promoting would poison live data

3. **Canary Rollback Rate < 10%**
   - Check Grafana dashboard: `http://grafana.local/d/sprint11-observability`
   - View "DDS Rollback Rate (5-min window)" panel
   - Rate should trend below 10% (alert fires at ≥10%)
   - If rate spikes, wait for it to stabilize before promoting
   - **Why**: High rollback rate indicates approvals are unstable; wait until it settles

4. **No Recent Canary Pauses**
   - Verify the "DDS Canary Safety: Pause/Resume Events" panel
   - No pauses in the last 24 hours
   - If pauses occurred, read the pause reason and investigate
   - **Why**: Pauses indicate detected issues; resolve them first

5. **Approval Quality Trend**
   - Review last 7 days of approval metrics
   - Rollback rate should be stable or declining (not spiking)
   - Consensus scores should be consistent
   - **Why**: Ensures the approval quality is sustainable long-term

---

## Promotion Steps

### Step 1: Get Admin Authorization

Ensure sign-off from:

- **Engineering Lead**: Confirms all test/monitoring ready
- **Product Lead**: Confirms business decision aligned with roadmap
- **Platform/Ops**: Confirms deployment pipeline ready

### Step 2: Document the Decision

Create an entry in the **DDS Promotion Log** (shared doc) with:

- **Date & Time**: When promotion was approved
- **Approver Name**: Who made the decision
- **Readiness Metrics**: Clean approval count, violation count, rollback rate (screenshot or values)
- **Reason for Promotion**: Brief business justification
- **Reference**: ADR-026 (Auto-apply GA policy)

Example:

```
Date: 2026-07-15 10:30 AM
Approver: Product Lead Jane Doe
Metrics: 42 clean approvals, 0 violations, 7.2% rollback rate
Reason: Exceeded ≥30 threshold; rollback rate stable; ready for live impact
Reference: ADR-026
```

### Step 3: Execute the Promotion API Call

As an admin, call the promotion endpoint:

```bash
curl -X POST http://backend:3000/admin/dds/auto-apply/promote \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "approverName": "Jane Doe",
    "reason": "Exceeded 30 clean approvals; rollback rate stable at 7.2%"
  }'
```

**Expected Response** (200 OK):

```json
{
  "success": true,
  "message": "DDS shadow mode disabled; auto-apply now live",
  "timestamp": "2026-07-15T10:35:00Z",
  "previousState": {
    "shadowModeEnabled": true,
    "cleanApprovals": 42,
    "rollbackCount": 3
  },
  "newState": {
    "shadowModeEnabled": false,
    "canaryArmed": true,
    "promotedAt": "2026-07-15T10:35:00Z"
  }
}
```

### Step 4: Verify Promotion in Admin UI

1. Refresh `/admin/dds/auto-apply`
2. Confirm the message: "✓ DDS Auto-Apply is now LIVE"
3. Verify "Promoted At" timestamp matches API response
4. Confirm "Canary Armed" status shows `true`

### Step 5: Monitor First 24 Hours

After promotion, watch these metrics closely:

#### First Hour (Critical)

- **API Error Rate**: Should stay <0.1%
- **Auto-Apply Execution Rate**: Monitor volume of live auto-apply decisions
- **Rollback Rate**: Should remain stable (<10%)
- **Database Commit Rate**: Check for unexpected spike

Check the on-call dashboard every 15 minutes for the first hour.

#### Hours 2-24

- **User-Reported Issues**: Monitor support channel for DDS-related complaints
- **Canary Auto-Pause Events**: Should be 0 (if >0, check reason immediately)
- **Rollback Trend**: Should continue trending downward or flat
- **Correctness**: Spot-check approved variants for factual accuracy

---

## Rollback Procedure (If Issues)

If serious issues occur within 24 hours:

```bash
# Revert to shadow mode
curl -X POST http://backend:3000/admin/dds/auto-apply/revert-to-shadow \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "reason": "Live variant apply caused data corruption; reverting to shadow mode"
  }'
```

Estimated time: <5 minutes.

**Important**: Applied variants are preserved in the database for audit trail, even after revert. No data is lost.

---

## Post-Promotion Monitoring

### Weekly Metrics Review

Every week after promotion, review:

1. **Applied Variant Quality**
   - Sample 20-30 recently applied variants
   - Grade each for correctness, clarity, appropriate difficulty
   - Target: 95%+ pass quality bar

2. **Rollback Analysis**
   - Count rollbacks this week
   - Compare to pre-promotion baseline
   - If trending up, investigate causes

3. **User Impact**
   - Monitor exam scores in cohorts seeing auto-applied questions
   - Spot-check if scores improved/degraded
   - Any user complaints about new questions?

4. **Canary Health**
   - Confirm canary still armed (should show true)
   - Any pause events triggered?
   - If paused, review and resolve before re-arming

### Metrics Dashboard

Keep a running dashboard (Grafana or spreadsheet):

- Date of promotion
- Rollback rate (weekly average)
- Applied variant count (cumulative)
- Correctness violations (cumulative, should stay 0)
- User feedback (qualitative: positive/negative/neutral)

---

## FAQ

**Q: What if clean approval count is only 28, just short of 30?**
A: Wait. The ≥30 threshold exists for statistical significance. Two more approvals will take a few days; rushing risks promoting an unstable system.

**Q: Can I promote if rollback rate is exactly 10%?**
A: No. The alert fires at ≥10%, so 10% is the boundary. Wait until rate drops to <10% consistently.

**Q: What happens to questions after promotion?**
A: Auto-applied variants replace the current live question. The previous version is archived (preserved in version history for audit).

**Q: Can I undo the promotion?**
A: Yes, via `revert-to-shadow` API call. Applied variants stay in the database but future auto-apply decisions go to shadow mode. However, downtime occurs; prefer to fix issues and leave promotion in place if possible.

**Q: Who should be notified after promotion?**
A: Send an all-hands message in Slack (#engineering) summarizing:

- Promotion timestamp
- Readiness metrics at time of promotion
- What users should expect (new AI-generated questions in exams)
- Support contact for issues

---

## Related Documentation

- [ADR-026: DDS Auto-Apply GA & Canary Policy](../adr/adr-026.md)
- [On-Call Runbook: DDS Canary Rollback-Rate Alert](../oncall.md#dds-canary-rollback-rate-high)
- [Admin Dashboard: DDS Auto-Apply Panel](../guides/admin-dashboard.md)
