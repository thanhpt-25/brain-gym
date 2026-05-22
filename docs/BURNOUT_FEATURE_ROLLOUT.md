# Burnout Detection Feature Rollout Plan

## Overview

The Burnout Detection feature in CertGym helps identify when users are showing signs of study exhaustion through weighted signal analysis. This document outlines the rollout strategy, user messaging, and monitoring approach for this feature.

## Feature Summary

The burnout detection system monitors four key signals:
- **Score Decline** (35% weight): Recent exam scores trending downward
- **Time Allocation** (25% weight): Extended study sessions without breaks
- **Attempt Frequency** (20% weight): High volume of exam attempts
- **Error Rate** (20% weight): Increased number of incorrect answers

These signals are combined into a severity score with four tiers:
- **Low** (< 0.50): All systems normal, keep current pace
- **Medium** (0.50-0.69): Monitor your study pace
- **High** (0.70-0.84): Significant burnout signals detected
- **Critical** (≥ 0.85): Immediate intervention recommended

## Rollout Strategy

### Phase 1: Beta Testing (2-3 weeks)
**Target**: Internal team + 5-10 beta testers
- Monitor for false positives (features triggering incorrectly)
- Validate signal weights and threshold calculations
- Gather qualitative feedback on messaging clarity
- **Success Criteria**: 
  - Zero critical false positives
  - 80%+ clarity rating on messaging
  - No reported issues with database queries

### Phase 2: Gradual Rollout (2-4 weeks)
**Target**: 25% → 50% → 75% of active users
- Enable feature for subset of users via feature flag
- Monitor signup/retention metrics for rollout cohort
- Track which severity levels are most common
- A/B test messaging variations if needed
- **Success Criteria**:
  - No regression in retention metrics
  - User engagement remains stable
  - Coach usage increases for high-severity users

### Phase 3: Full Release (Ongoing)
**Target**: 100% of users
- Enable for all remaining users
- Maintain ongoing monitoring for accuracy
- Collect user feedback via help docs and support
- Refine signal weights quarterly based on data

## User-Facing Messaging

### What Users See (BurnoutIndicator Component)

#### Low Severity
```
📊 Burnout Monitor
- All looks good. Keep your current pace.
- Recommended action: Continue learning
```

#### Medium Severity
```
⚠️ Burnout Warning
- Score declining 📉 • Long study hours ⏱️
- Recommended action: Monitor your study pace
- Dismiss button (user can acknowledge alert)
```

#### High Severity
```
⚠️ High Burnout Risk
- Score declining 📉 • More mistakes ❌
- Recommended action: Chat with your AI Coach
- 🔴 Consider taking a 15-20 minute break. Pacing your studies improves long-term retention.
```

#### Critical Severity
```
⚠️ Burnout Alert
- Many attempts ⚡ • More mistakes ❌
- Recommended action: Priority coach intervention
- 🔴 Take a 30-minute break. Burnout impacts learning retention. Your coach is ready to help.
```

### Contextual Help

**Help Icon Tooltip** (hover on ? icon):
```
"This feature monitors your study patterns to help prevent burnout. 
Learn more in our user guide: [link to BURNOUT_USER_GUIDE.md]"
```

**Severity-Level Tooltips** (hover on severity title):
- **Critical**: "Your study pattern shows signs of exhaustion. We strongly recommend taking a break. Your AI Coach is ready to help you develop a healthier study plan."
- **High**: "You're showing significant burnout signals. A brief study break is recommended. Your coach can help identify patterns and suggest optimizations."
- **Medium**: "Monitor your study pace closely. Consider spacing out your study sessions to avoid fatigue and maintain long-term progress."
- **Low**: "All looks good! You're maintaining a healthy study pace. Keep up your current rhythm while staying mindful of balance."

## Technical Monitoring

### Metrics to Track

1. **Accuracy Metrics**:
   - % of users with recent low score who get flagged (true positive rate)
   - % of users flagged who don't improve after break (false positive rate)
   - Signal distribution: how many users at each severity level

2. **User Engagement**:
   - % of flagged users who take a break within 2 hours
   - % of flagged users who start a coach session
   - Change in exam attempt frequency before/after flag
   - Return rate of previously flagged users

3. **Quality Metrics**:
   - Coach conversation topics when burnout is mentioned
   - User feedback on clarity of burnout messaging
   - Support tickets mentioning burnout feature

### Log Monitoring

**Location**: Backend burnout detection logs
```bash
docker logs braingym-backend | grep "Burnout"
```

**Expected Patterns**:
- Normal: Most users stay in low/medium range
- Alert: Spike in critical scores after exam releases
- Success: Reduction in severity after coach conversations

## User Documentation

See [BURNOUT_USER_GUIDE.md](./BURNOUT_USER_GUIDE.md) for user-facing documentation:
- What is burnout detection?
- How are scores calculated?
- What should I do if I get a burnout alert?
- FAQ section

## Handling User Feedback

### Common Questions (FAQ for Support)

**"Why did I get a burnout alert when I'm fine?"**
- The system looks at objective patterns (score decline, attempt frequency, etc.), not subjective feelings. Sometimes temporary dips are normal. Take a break if you feel tired, regardless of the alert.

**"How often does the system check for burnout?"**
- Every exam attempt and session. The system is running continuously in the background.

**"Can I disable burnout alerts?"**
- You can dismiss individual alerts. The system will continue monitoring but won't show notifications for 24 hours after dismissal.

**"Does this affect my coaching experience?"**
- No, burnout detection is separate. It just helps your coach understand your situation better and provide more targeted recommendations.

## Rollout Checklist

- [ ] Backend: Implement BurnoutDetector.getRecommendedAction() enhancements
- [ ] Frontend: Update BurnoutIndicator.tsx with tooltips and messaging
- [ ] Documentation: Create BURNOUT_USER_GUIDE.md
- [ ] Testing: Run beta testing with 5-10 users for 2 weeks
- [ ] Monitoring: Set up alerts for high spike in critical-severity detections
- [ ] Feature Flag: Implement gradual rollout via feature flag
- [ ] Analytics: Create dashboard for monitoring key metrics
- [ ] Support: Train support team on burnout detection responses
- [ ] Phase 2 Release: Roll out to 25% of users
- [ ] Phase 3 Release: Roll out to 100% of users

## Timeline

| Phase | Duration | Start Date | Key Milestone |
|-------|----------|-----------|---------------|
| Phase 1 (Beta) | 2-3 weeks | May 22, 2026 | Internal testing complete, no bugs |
| Phase 2 (Gradual) | 2-4 weeks | ~June 5, 2026 | 75% rollout verified, stable metrics |
| Phase 3 (Full) | Ongoing | ~June 19, 2026 | 100% enabled, monitoring active |

## Success Criteria

- [ ] Beta testing shows zero critical false positives
- [ ] User satisfaction with messaging ≥ 80%
- [ ] No regression in platform retention metrics
- [ ] Coach usage increases by 15%+ for flagged users
- [ ] Support tickets related to confusion < 5% of new traffic

## Future Enhancements

- Machine learning-based signal weighting (personalized burnout thresholds)
- Predictive burnout detection (flag before critical stage)
- Integration with rest day recommendations
- Burnout recovery plan templates
- Peer recovery stories and community support
