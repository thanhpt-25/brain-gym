# Understanding Reputation Flags

> Learn how CertGym protects fair voting through automatic fraud detection and how it affects your points.

---

## What Are Reputation Flags?

Reputation flags are a **safety mechanism** that temporarily holds your points if we detect suspicious voting behavior. This protects the community leaderboard from fraud while we review the activity.

**In short**: If you vote in an unusual pattern, your vote might be flagged. When flagged, your points from that vote are held (on-hold status) until a moderator reviews and either clears you or confirms the flag.

---

## Why Do Flags Exist?

### The Problem They Solve

Without flags, bad actors could:

- Vote on the same question 5+ times in 10 seconds (artificial vote boost)
- Rally friends to vote on their content within a short time window (vote rings)
- Manipulate the leaderboard through coordinated voting

**Flags catch these patterns** before they damage the integrity of the ranking system.

### How Points Are Protected

- **Flagged votes hold points** → they don't count toward your leaderboard rank yet
- **Moderators review within 24 hours** → they clear the flag if it was a false alarm, or confirm if it was fraud
- **Cleared flags release points** → you get full points immediately upon clearance
- **Confirmed flags forfeit points** → your points stay held; leaderboard reflects only unflagged votes

---

## What Gets Flagged?

### Automatic Patterns We Detect

#### 1. Velocity Burst

**Trigger**: ≥5 votes on the same question in a 10-second window.

**Example**:

- You vote for Question X at 10:00:00 AM
- You vote for Question X again at 10:00:05 AM
- You vote for Question X again at 10:00:08 AM
- (total: 3 votes, not flagged yet)
- A friend votes for Question X at 10:00:09 AM
- A friend votes for Question X at 10:00:10 AM
- (total: 5 votes, in 10 seconds → **flagged**)

**Why**: Legitimate voting on the same question is rare. Rapid re-voting suggests spam or manipulation.

**False alarm risk**: Low. Honest users usually vote once per question.

#### 2. Vote Ring

**Trigger**: 3+ votes on the same user's content within a 60-second window.

**Example**:

- User Alice votes for Bob's question at 10:00:00 AM
- User Charlie votes for Bob's question at 10:00:15 AM
- User Diana votes for Bob's question at 10:00:30 AM
- (total: 3 votes, in 60 seconds → **flagged**)

**Why**: Coordinated voting boosts reputation artificially. This pattern often indicates friends voting together.

**False alarm risk**: Medium. If a question is good and popular, honest users might vote together legitimately.

---

## What Happens When You're Flagged?

### Step 1: Flag Created

When a suspicious pattern is detected:

- A flag is created against your vote
- Points are moved to **on-hold** status
- You see this on the leaderboard: "X points on hold"
- Email sent to you explaining the flag

### Step 2: Moderator Review (within 24 hours)

A CertGym moderator reviews your voting pattern:

- Looks at vote context (Is this a popular question? Were multiple users voting naturally?)
- Checks your history (Is this the first time? Repeat offender?)
- Makes a decision: **Clear** or **Confirm**

### Step 3a: Flag Cleared (False Alarm)

**If the moderator finds no fraud**:

- Flag is marked as cleared
- Your points are immediately released
- You see them fully counted on the leaderboard
- Email confirmation sent to you

### Step 3b: Flag Confirmed (Real Fraud)

**If the moderator confirms the flag**:

- Your points from that vote are forfeited
- They do _not_ count toward your leaderboard rank
- Email sent explaining the confirmation
- You can appeal within 7 days

---

## If You're Flagged: What to Do

### Immediate Action

**Don't panic.** Flags are a normal part of the system. Even honest users get flagged occasionally.

1. **Check your email** for the flag notification
   - Explains which vote was flagged
   - Shows the timestamp and question involved
   - Links to the flag review page

2. **Review the flag reason**
   - Is it a velocity burst or vote ring?
   - Does it make sense given what you did?

3. **Don't vote on the same content again** until the flag is resolved
   - Additional votes may trigger secondary flags
   - More flags = higher moderator scrutiny

### Appeal a Confirmed Flag

**If you believe a confirmed flag is wrong**, you can appeal:

1. Go to `/account/flags`
2. Find the confirmed flag
3. Click "Appeal"
4. Explain your side of the story (max 500 characters)
   - Example: "My study group was reviewing this question together during class"
   - Example: "I accidentally voted twice on my phone—not intentional spam"
5. Submit the appeal
6. Moderator reviews within 48 hours

**Appeals succeed** if you provide context the moderator didn't have during the first review.

---

## How to Avoid Flags

### Safe Voting Practices

1. **Vote once per question**
   - One upvote or downvote
   - If you change your mind, you can change your vote (but don't vote multiple times rapidly)

2. **Don't coordinate voting**
   - If studying with friends, vote independently
   - Don't say "everyone upvote this question"
   - Organic voting is fine; coordinated campaigns are not

3. **Spread votes over time**
   - Vote on different questions across your study session
   - Not all your votes on one creator's content

4. **Be honest**
   - Vote based on question quality, not friendship
   - Upvote good questions; downvote unclear/incorrect ones
   - System works best when votes reflect quality

### Common Misconceptions

**"Multiple votes on the same question should be allowed if I'm changing my mind"**

- Changing your vote once is fine
- But clicking upvote→downvote→upvote rapidly looks like spam
- Best practice: think before voting

**"My study group should all vote the same way"**

- Your study group _can_ upvote the same good question
- But rapid voting (all 5 people in 10 seconds) looks like coordination
- Stagger your votes over minutes/hours

**"Flagged = banned"**

- False. Flags are temporary holds, not punishments
- Your account isn't at risk
- You can continue voting normally
- Flag is just a safety check

---

## Leaderboard Impact

### How Points Are Calculated

**Leaderboard rank = sum of all unflagged votes + bonus for cleared flags**

Example:

- You vote 100 times: earn 100 points
- 5 votes get flagged: 95 points released, 5 on hold
- 3 of the 5 get cleared: 98 points released, 2 forfeited
- **Your leaderboard shows 98 points** (not 100)

### Visible Indicators

On your profile, you'll see:

- **Leaderboard Points**: Sum of unflagged + cleared votes
- **Points On Hold**: Pending moderator review
- **Forfeited Points**: Confirmed as fraud (not counted)

---

## FAQ

**Q: If I'm flagged, can I still vote?**
A: Yes. A flag on one vote doesn't freeze your account. You can vote on other questions. Just avoid repeating the pattern that triggered the flag.

**Q: How long until a flag is resolved?**
A: Moderators review within 24 hours. Most flags are cleared or confirmed by then. Appeals take up to 48 hours.

**Q: What if I have multiple flags?**
A: Multiple flags suggest a pattern. Moderators look at your history. Repeat flagging (even if cleared) can result in stricter review. Be more careful with future votes.

**Q: Do cleared flags affect my reputation long-term?**
A: No. Cleared flags are forgiven. They don't appear on your profile after resolution. Only confirmed flags show in your history.

**Q: Can I see which of my votes are flagged?**
A: Yes. Visit `/account/flags` to see all flagged votes, their status (pending/cleared/confirmed), and flag reasons.

**Q: What if I think the flag system is unfair?**
A: Provide feedback in `/help/contact-us`. The team reviews suggestions for threshold adjustments.

---

## Related Documentation

- [ADR-027: Reputation Anti-Gaming Thresholds](../adr/ADR-027-reputation-anti-gaming-thresholds.md)
- [Admin: Reputation Flag Review Dashboard](../admin/reputation-flags.md)
- [On-Call Runbook: Reputation Flag Volume Spike](../oncall.md#reputation-anti-gaming-flag-rate)
