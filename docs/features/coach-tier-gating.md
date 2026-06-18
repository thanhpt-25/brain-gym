# Coach Feature Tier-Lock Mechanics

## Overview

The AI Coach feature in CertGym is gated by subscription tier to manage API costs and ensure service quality. This document describes how tier-based access control is implemented and enforced.

## Feature Availability by Tier

| Tier | Access | Session Limit | Session Duration |
|------|--------|---------------|------------------|
| Free | ❌ No access | — | — |
| Pro | ✅ Full access | 10 sessions/day | Unlimited |
| Enterprise | ✅ Full access | Unlimited | Unlimited |

## Implementation Details

### Where Tier Checks Happen

**File**: `backend/src/training/coach/coach.controller.ts`

The tier check is enforced at the controller level when users:
1. Request a coach session (`GET /training/coach/session/:userId`)
2. Send a message to the coach (`POST /training/coach/session/:sessionId/message`)

**Implementation Pattern**:
```typescript
// In coach.controller.ts
@Post('session/:sessionId/message')
async sendMessage(@Param('sessionId') sessionId: string, @Req() req: any) {
  // 1. Verify user's org tier
  const userTier = await this.getOrganizationTier(req.user.id);
  
  // 2. Check tier access
  if (userTier === 'free' || userTier === 'FREE') {
    throw new ForbiddenException('Coach feature is not available on free tier. Please upgrade to Pro or Enterprise tier.');
  }
  
  // 3. Check session rate limit
  const sessionCount = await this.coachService.getSessionCount(req.user.id);
  if (userTier === 'pro' && sessionCount >= 10) {
    throw new BadRequestException('Daily session limit (10) reached');
  }
  
  // 4. Proceed with coach interaction
  return this.coachService.sendMessage(sessionId, req.user.id, userMessage);
}
```

### Session Rate Limiting

**File**: `backend/src/training/coach/coach.service.ts` (lines ~113-116)

The service enforces daily session limits:
```typescript
// In coach.service.ts
async sendMessage(sessionId: string, userId: string, userMessage: string) {
  const sessionCount = await this.getSessionCount(userId);
  if (sessionCount >= 10) {
    throw new BadRequestException("Daily session limit reached");
  }
  // ... rest of implementation
}

async getSessionCount(userId: string): Promise<number> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return this.prisma.coachSession.count({
    where: { userId, createdAt: { gte: today } }
  });
}
```

### How to Extend Tier Limits

To change tier limits, modify the constants in `coach.controller.ts`:

```typescript
// Define tier-specific limits
const TIER_LIMITS = {
  free: { enabled: false, sessionsPerDay: 0 },
  pro: { enabled: true, sessionsPerDay: 10 },
  enterprise: { enabled: true, sessionsPerDay: 999999 }, // Effectively unlimited
};

// Use in rate limit check
if (TIER_LIMITS[userTier].sessionsPerDay > 0 && 
    sessionCount >= TIER_LIMITS[userTier].sessionsPerDay) {
  throw new BadRequestException('Daily session limit reached');
}
```

### Row-Level Security (RLS)

CertGym uses multi-tenant isolation with RLS at the database level:

**Principle**: Users can only access coach sessions they created.

**Enforcement**:
- User's `id` is automatically attached to each CoachSession via foreign key
- Database policies ensure only the session owner can read/write their sessions
- CoachService validates session ownership: `session.userId === userId`

**File**: `backend/src/training/coach/coach.service.ts` (line ~110)
```typescript
// Verify session ownership
const session = await this.prisma.coachSession.findUnique({
  where: { id: sessionId }
});

if (!session || session.userId !== userId) {
  throw new BadRequestException("Session not found or unauthorized");
}
```

## Testing Tier-Lock Behavior

### Test 1: Free Tier Blocked Access
```bash
# Authenticate as free-tier user
curl -H "Authorization: Bearer $FREE_TOKEN" \
  POST http://localhost:3000/api/v1/training/coach/session

# Expected: 403 Forbidden
# Response: "Coach feature not available on Free tier"
```

### Test 2: Pro Tier Session Limit
```bash
# Create 10 sessions for pro-tier user (loop 10 times)
for i in {1..10}; do
  curl -H "Authorization: Bearer $PRO_TOKEN" \
    POST http://localhost:3000/api/v1/training/coach/session/:sessionId/message \
    -d '{"message": "test"}'
done

# 11th attempt should fail with 400
curl -H "Authorization: Bearer $PRO_TOKEN" \
  POST http://localhost:3000/api/v1/training/coach/session/:sessionId/message \
  -d '{"message": "test"}'

# Expected: 400 Bad Request
# Response: "Daily session limit reached"
```

### Test 3: Enterprise Tier Unlimited Access
```bash
# Enterprise users should not hit session limits
# Create 20+ sessions - all should succeed
for i in {1..20}; do
  curl -H "Authorization: Bearer $ENTERPRISE_TOKEN" \
    POST http://localhost:3000/api/v1/training/coach/session/:sessionId/message \
    -d '{"message": "test"}'
done

# All should return 200 OK
```

### Test 4: Session Ownership Isolation
```bash
# User A creates session
curl -H "Authorization: Bearer $USER_A_TOKEN" \
  GET http://localhost:3000/api/v1/training/coach/session/user-a-id

# User B tries to access User A's session
curl -H "Authorization: Bearer $USER_B_TOKEN" \
  GET http://localhost:3000/api/v1/training/coach/session/user-a-session-id

# Expected: 400 Bad Request
# Response: "Session not found or unauthorized"
```

## Monitoring Tier-Lock Effectiveness

**Metrics to track**:
1. **Tier distribution**: % of users on each tier
2. **Coach adoption**: % of tier-eligible users using coach
3. **Session velocity**: Average sessions/day by tier
4. **Compliance**: Any unauthorized access attempts (should be 0)

**Log locations**:
- Coach service logs: `docker logs braingym-backend | grep "Coach"`
- Authorization failures: `docker logs braingym-backend | grep "unauthorized"`

## Future Enhancements

- [ ] Add per-org tier limits (handle shared org accounts)
- [ ] Implement session quota rollover/banking
- [ ] Add tiered response quality (faster/slower LLM models by tier)
- [ ] Create admin dashboard for tier management
- [ ] Track per-org API spending against tier limits
