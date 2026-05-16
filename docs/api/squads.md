# Squads API

Squad management endpoints for creating study groups, generating invites, and joining squads.

## Overview

Squads are user-led study groups for collaborative certification exam preparation. Implemented as Organizations with `kind='SQUAD'`, squads inherit all multi-tenant isolation and RBAC from the organization infrastructure.

**Feature Flag:** `FF_SQUADS_BETA`

**Base URL:** `/api/v1/squads`

---

## POST /api/v1/squads

Create a new squad.

**Authentication:** Required (AuthGuard + JWT)

**Authorization:** User must have PREMIUM or ENTERPRISE plan

### Request

```typescript
{
  name: string;                    // Squad display name (e.g., "AWS SAA-C03 Study Group")
  certificationId: string;         // UUID of certification this squad is studying for
  targetExamDate?: string;         // Optional target exam date (ISO 8601 format, e.g., "2026-06-15")
}
```

### Response

**Status:** `201 Created`

```typescript
{
  id: string;                      // UUID of the created squad (Organization)
  name: string;                    // Squad display name
  slug: string;                    // URL-friendly slug (auto-generated from name)
  certificationId: string;         // UUID of the certification
  targetExamDate?: Date;           // Target exam date (ISO 8601)
  memberCount: number;             // Number of members (creator=1 initially)
  createdAt: Date;                 // Creation timestamp
}
```

### Example

**Request:**
```bash
curl -X POST https://brain-gym.com/api/v1/squads \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "AWS SAA-C03 Study Group",
    "certificationId": "550e8400-e29b-41d4-a716-446655440000",
    "targetExamDate": "2026-06-15"
  }'
```

**Response:**
```json
{
  "id": "org-123456",
  "name": "AWS SAA-C03 Study Group",
  "slug": "aws-saa-c03-study-group",
  "certificationId": "550e8400-e29b-41d4-a716-446655440000",
  "targetExamDate": "2026-06-15T00:00:00Z",
  "memberCount": 1,
  "createdAt": "2026-05-16T12:00:00Z"
}
```

### Error Codes

| Code | Message | Cause |
|------|---------|-------|
| 400 | "Free users cannot create squads" | User plan is FREE |
| 400 | "Certification not found" | certificationId doesn't exist |
| 401 | Unauthorized | Missing or invalid JWT token |
| 422 | Validation error | Invalid request body (name not string, certificationId not UUID, etc.) |

---

## POST /api/v1/squads/:id/invites

Generate a new invite link for the squad.

**Authentication:** Required (AuthGuard + JWT)

**Authorization:** User must be OWNER or ADMIN of the squad (OrgRoleGuard)

**Rate Limit:** Max 10 invite links per owner per 24-hour period

### Request

No body required.

**Path Parameters:**
- `id` (string): Squad ID (Organization UUID)

### Response

**Status:** `201 Created`

```typescript
{
  token: string;                   // UUID token for accepting the invite
  expiresAt: Date;                 // Expiration timestamp (7 days from now)
  squadName: string;               // Name of the squad
  joinUrl: string;                 // Full URL to join (includes app domain + token)
}
```

### Example

**Request:**
```bash
curl -X POST https://brain-gym.com/api/v1/squads/org-123456/invites \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response:**
```json
{
  "token": "a1b2c3d4-e5f6-41d4-a716-446655440000",
  "expiresAt": "2026-05-23T12:00:00Z",
  "squadName": "AWS SAA-C03 Study Group",
  "joinUrl": "https://brain-gym.com/squads/join/a1b2c3d4-e5f6-41d4-a716-446655440000"
}
```

### Error Codes

| Code | Message | Cause |
|------|---------|-------|
| 400 | "Squad not found" | Squad (Organization) doesn't exist |
| 400 | "Daily invite limit reached (max 10 per day)" | Owner has already generated 10 invites in the past 24h |
| 401 | Unauthorized | Missing or invalid JWT token |
| 403 | Forbidden | User is not OWNER/ADMIN of the squad |

---

## POST /api/v1/squads/join/:token

Accept an invite and join a squad.

**Authentication:** Required (AuthGuard + JWT)

### Request

No body required.

**Path Parameters:**
- `token` (string): Invite token from the invite link

### Response

**Status:** `200 OK`

Returns squad details after user is added as MEMBER:

```typescript
{
  id: string;                      // Squad ID (Organization UUID)
  name: string;                    // Squad name
  slug: string;                    // URL-friendly slug
  certificationId: string;         // Certification UUID
  targetExamDate?: Date;           // Target exam date
  memberCount: number;             // Updated member count (including new member)
  createdAt: Date;                 // Squad creation timestamp
}
```

### Example

**Request:**
```bash
curl -X POST https://brain-gym.com/api/v1/squads/join/a1b2c3d4-e5f6-41d4-a716-446655440000 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response:**
```json
{
  "id": "org-123456",
  "name": "AWS SAA-C03 Study Group",
  "slug": "aws-saa-c03-study-group",
  "certificationId": "550e8400-e29b-41d4-a716-446655440000",
  "targetExamDate": "2026-06-15T00:00:00Z",
  "memberCount": 2,
  "createdAt": "2026-05-16T12:00:00Z"
}
```

### Error Codes

| Code | Message | Cause |
|------|---------|-------|
| 400 | "Invite link has expired" | Token expired (>7 days old) |
| 400 | "Invite has already been accepted" | Token status is not PENDING |
| 400 | "Squad is at full capacity" | Squad has reached maxSeats limit |
| 400 | "Squad not found" | Squad doesn't exist |
| 401 | Unauthorized | Missing or invalid JWT token |

---

## Rate Limiting

**Daily Invite Limit:** Max 10 invite links per owner per 24-hour period

When limit is exceeded, the API returns `400 Bad Request` with message: "Daily invite limit reached (max 10 per day)"

The limit resets every 24 hours, calculated from the creation time of the oldest invite.

---

## Token TTL

Invite tokens expire after **7 days** from creation.

After expiration, attempting to join with that token returns `400 Bad Request` with message: "Invite link has expired"

---

## Constraints

### Squads Cannot Own Assets

By design, squads (Organizations with `kind='SQUAD'`) cannot:
- Create or own ExamCatalogItem
- Create or own Assessment

These are restricted to regular organizations.

Attempting to create catalog items or assessments on a squad organization will fail with a database-level CHECK constraint.

---

## FAQ

### How many people can join a squad?
Default capacity is 50 members per squad. This can be adjusted via the `maxSeats` field on the Organization row.

### Can an invite token be used multiple times?
No. After one person accepts an invite (status transitions to ACCEPTED), that token can no longer be used. Generate a new invite link for additional members.

### What if I lose my invite link?
Request a new invite from the squad OWNER. There is no way to recover or list previous tokens.

### Can I join multiple squads?
Yes. A user can be a member of multiple squads simultaneously.

### Who can generate invites?
Only OWNER and ADMIN roles within the squad can generate invites. MEMBER role cannot.

---

## Integration Notes

### RLS (Row-Level Security)

All squad endpoints automatically inherit org-level RLS policies:
- Users can only see/modify squads they're members of
- Cross-org data access is automatically blocked at the database level

### Feature Flag

Squads are gated behind `FF_SQUADS_BETA` feature flag. Ensure the flag is enabled for users before they can create or join squads.

### Plan Restrictions

Only PREMIUM and ENTERPRISE plan users can create squads. FREE users receive `400 Bad Request` with message: "Free users cannot create squads"

---

## Errors Summary

| Scenario | Endpoint | Status | Error |
|----------|----------|--------|-------|
| FREE user creates squad | POST /squads | 400 | "Free users cannot create squads" |
| Certification missing | POST /squads | 400 | "Certification not found" |
| Invite limit exceeded | POST /:id/invites | 400 | "Daily invite limit reached (max 10 per day)" |
| Token expired | POST /join/:token | 400 | "Invite link has expired" |
| Token already accepted | POST /join/:token | 400 | "Invite has already been accepted" |
| Squad at capacity | POST /join/:token | 400 | "Squad is at full capacity" |
| Missing auth | All | 401 | "Unauthorized" |
| Non-OWNER/ADMIN | POST /:id/invites | 403 | "Forbidden" |
