# Squads API Documentation

## Overview

The Squads API provides endpoints for creating user-led study groups (Squads), generating token-based invite links, and joining squads. Squads are built on top of the existing Organization infrastructure with a special `kind = 'SQUAD'` designation.

**Base URL:** `/api/v1`  
**Feature Flag:** `FF_SQUADS_BETA` (required to enable squads feature)

---

## Authentication

All endpoints require a valid JWT Bearer token in the `Authorization` header:

```
Authorization: Bearer <jwt_token>
```

**Error Response (401):**
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

---

## Data Models

### SquadDto

Response model for squad operations. Represents a Squad with basic metadata.

```json
{
  "id": "uuid",
  "name": "AWS SAA-C03 Study Group",
  "slug": "aws-saa-c03-study-group-abc123",
  "certificationId": "uuid",
  "targetExamDate": "2026-06-15T00:00:00Z",
  "memberCount": 3,
  "createdAt": "2026-05-16T10:30:00Z"
}
```

**Fields:**
- `id` (UUID): Unique squad identifier
- `name` (string): Squad name (max 100 characters)
- `slug` (string): URL-safe identifier, auto-generated from name with random suffix for uniqueness
- `certificationId` (UUID): Associated certification
- `targetExamDate` (ISO 8601 date, optional): Target exam date for the squad
- `memberCount` (number): Current member count
- `createdAt` (ISO 8601 datetime): Squad creation timestamp

### InviteLinkDto

Response model for invite link generation.

```json
{
  "token": "550e8400-e29b-41d4-a716-446655440000",
  "expiresAt": "2026-05-23T10:30:00Z",
  "squadName": "AWS SAA-C03 Study Group",
  "joinUrl": "https://app.certgym.com/squads/join/550e8400-e29b-41d4-a716-446655440000"
}
```

**Fields:**
- `token` (UUID string): Unique, single-use invite token (7-day TTL)
- `expiresAt` (ISO 8601 datetime): Token expiration timestamp
- `squadName` (string): Name of the squad being invited to
- `joinUrl` (string): Full URL for joining the squad

---

## Endpoints

### 1. Create Squad

Create a new study group (Squad).

```
POST /squads
```

**Authentication:** Required (JWT Bearer token)

**Request Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "name": "AWS SAA-C03 Study Group",
  "certificationId": "550e8400-e29b-41d4-a716-446655440000",
  "targetExamDate": "2026-06-15"
}
```

**Request Parameters:**
- `name` (string, required): Squad name, max 100 characters
- `certificationId` (UUID, required): ID of the certification to study for
- `targetExamDate` (ISO 8601 date, optional): Target exam date in YYYY-MM-DD format

**Success Response (201 Created):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "name": "AWS SAA-C03 Study Group",
  "slug": "aws-saa-c03-study-group-def456",
  "certificationId": "550e8400-e29b-41d4-a716-446655440000",
  "targetExamDate": "2026-06-15T00:00:00Z",
  "memberCount": 1,
  "createdAt": "2026-05-16T10:30:00Z"
}
```

**Error Responses:**

| Status | Code | Message | Reason |
|--------|------|---------|--------|
| 400 | BAD_REQUEST | "Certification not found" | Provided certificationId doesn't exist |
| 400 | BAD_REQUEST | "Invalid name" | Name is empty or exceeds 100 characters |
| 401 | UNAUTHORIZED | "Unauthorized" | Missing or invalid JWT token |
| 403 | FORBIDDEN | "Free users cannot create squads" | User has FREE plan |

**cURL Example:**
```bash
curl -X POST http://localhost:3000/api/v1/squads \
  -H "Authorization: Bearer eyJhbGc..." \
  -H "Content-Type: application/json" \
  -d '{
    "name": "AWS SAA-C03 Study Group",
    "certificationId": "550e8400-e29b-41d4-a716-446655440000",
    "targetExamDate": "2026-06-15"
  }'
```

**Constraints:**
- Only PREMIUM and ENTERPRISE users can create squads
- Squad creator is automatically added as OWNER
- Squads cannot own ExamCatalogItem or Assessment (enforced at service layer)

---

### 2. Generate Invite Link

Create a token-based invite link for a squad.

```
POST /squads/:id/invites
```

**Authentication:** Required (JWT Bearer token) + OWNER/ADMIN role in squad

**Request Headers:**
```
Authorization: Bearer <jwt_token>
```

**Path Parameters:**
- `id` (UUID): Squad ID

**Request Body:** Empty

**Success Response (201 Created):**
```json
{
  "token": "550e8400-e29b-41d4-a716-446655440002",
  "expiresAt": "2026-05-23T10:30:00Z",
  "squadName": "AWS SAA-C03 Study Group",
  "joinUrl": "https://app.certgym.com/squads/join/550e8400-e29b-41d4-a716-446655440002"
}
```

**Error Responses:**

| Status | Code | Message | Reason |
|--------|------|---------|--------|
| 400 | BAD_REQUEST | "Daily invite limit reached" | Max 10 invite links created today by this user |
| 401 | UNAUTHORIZED | "Unauthorized" | Missing or invalid JWT token |
| 403 | FORBIDDEN | "Only OWNER and ADMIN can generate invites" | User is not OWNER/ADMIN of squad |
| 404 | NOT_FOUND | "Squad not found" | Squad ID doesn't exist |

**Rate Limiting:**
- Max **10 invite links per owner per day** (calendar day, UTC)
- Returns `429 Too Many Requests` when limit exceeded
- Response includes `Retry-After` header with seconds until limit reset

**cURL Example:**
```bash
curl -X POST http://localhost:3000/api/v1/squads/550e8400-e29b-41d4-a716-446655440001/invites \
  -H "Authorization: Bearer eyJhbGc..."
```

**Token Characteristics:**
- Format: UUID v4 string
- TTL: 7 days from creation
- Single-use: Marked as ACCEPTED after first successful join
- Revocable: Can be revoked by updating OrgInvite.status to REVOKED (admin-only)

---

### 3. Join Squad

Accept an invite link and join a squad.

```
POST /squads/join/:token
```

**Authentication:** Required (JWT Bearer token)

**Request Headers:**
```
Authorization: Bearer <jwt_token>
```

**Path Parameters:**
- `token` (UUID string): Invite token from InviteLinkDto

**Request Body:** Empty

**Success Response (200 OK):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "name": "AWS SAA-C03 Study Group",
  "slug": "aws-saa-c03-study-group-def456",
  "certificationId": "550e8400-e29b-41d4-a716-446655440000",
  "targetExamDate": "2026-06-15T00:00:00Z",
  "memberCount": 4,
  "createdAt": "2026-05-16T10:30:00Z"
}
```

**Error Responses:**

| Status | Code | Message | Reason |
|--------|------|---------|--------|
| 400 | BAD_REQUEST | "Invite expired" | Token TTL has passed (>7 days) |
| 400 | BAD_REQUEST | "Invite no longer valid" | Token status is REVOKED or DECLINED |
| 400 | BAD_REQUEST | "Squad at capacity" | Squad has reached maxSeats limit |
| 401 | UNAUTHORIZED | "Unauthorized" | Missing or invalid JWT token |
| 404 | NOT_FOUND | "Invite not found" | Token doesn't match any pending invite |

**cURL Example:**
```bash
curl -X POST http://localhost:3000/api/v1/squads/join/550e8400-e29b-41d4-a716-446655440002 \
  -H "Authorization: Bearer eyJhbGc..."
```

**Behavior:**
- Idempotent: Re-joining with same token doesn't create duplicate members
- Automatic member role: User added as MEMBER (not OWNER)
- Invite status: Updated from PENDING to ACCEPTED
- Capacity check: Enforced against org.maxSeats
- RLS filtering: Automatic via org_id isolation

---

## Common Workflows

### Workflow 1: Create Squad and Share Invite

1. **Create squad:**
   ```bash
   POST /api/v1/squads
   {
     "name": "CKAD Study Group",
     "certificationId": "...",
     "targetExamDate": "2026-07-01"
   }
   ```
   Response includes squad ID.

2. **Generate invite link:**
   ```bash
   POST /api/v1/squads/{squadId}/invites
   ```
   Response includes `joinUrl`.

3. **Share `joinUrl` with friends** — they can join at any time within 7 days.

### Workflow 2: Join via Invite Link

1. **Receive invite link** from a squad member (in email, chat, etc.)
   ```
   https://app.certgym.com/squads/join/550e8400-e29b-41d4-a716-446655440002
   ```

2. **Click link or call API:**
   ```bash
   POST /api/v1/squads/join/550e8400-e29b-41d4-a716-446655440002
   Authorization: Bearer <jwt_token>
   ```

3. **User is now a member** of the squad with MEMBER role.

---

## Rate Limits

| Endpoint | Limit | Window | Status Code |
|----------|-------|--------|------------|
| POST /squads | 5/min per user | Sliding window | 429 |
| POST /squads/:id/invites | 10/day per user | Calendar day (UTC) | 429 |
| POST /squads/join/:token | 1/request | Per token | N/A |

**Rate Limit Headers:**
```
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 8
X-RateLimit-Reset: 1684756800
```

---

## Constraints & Validation

### Squad Constraints

1. **Plan-based access:**
   - FREE users cannot create squads
   - PREMIUM and ENTERPRISE users can create unlimited squads

2. **Catalog & Assessment ownership:**
   - Squads cannot own ExamCatalogItem
   - Squads cannot own Assessment
   - Enforced via CHECK constraints in database

3. **Invite limits:**
   - Max 10 invite links per owner per calendar day
   - Verified via query on OrgInvite with created_at filter

4. **Token TTL:**
   - All tokens expire after 7 days
   - Tokens are UUID v4 format
   - Single-use behavior recommended (status → ACCEPTED on join)

5. **Capacity:**
   - Limited by org.maxSeats (inherited from Organization)
   - Default: 50 (configurable per organization)

### Data Validation

```
name:
  - Required
  - Max 100 characters
  - Trimmed, non-empty

certificationId:
  - Required
  - Valid UUID
  - Must exist in Certification table

targetExamDate:
  - Optional
  - ISO 8601 date format (YYYY-MM-DD)
  - Must be in future
```

---

## Security Considerations

### Token Security

- Tokens are **not** JWTs; they are opaque UUIDs
- Transmitted over **HTTPS only** in production
- No sensitive data embedded in tokens
- Tokens should be treated as single-use secrets

### Role-Based Access

- **OWNER**: Can generate invites, manage squad settings
- **ADMIN**: Same as OWNER (configurable by organization)
- **MEMBER**: Can view squad data, participate in exams
- Enforced via `OrgRoleGuard` decorator on controller endpoints

### Row-Level Security (RLS)

- All squad data filtered by org_id via database policies
- Users cannot access squads they don't belong to
- Enforced at database layer for defense-in-depth

---

## Examples

### Example 1: Creating a Squad and Inviting Members

```bash
# 1. Create squad
curl -X POST http://localhost:3000/api/v1/squads \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "AWS Solutions Architect Associate",
    "certificationId": "550e8400-e29b-41d4-a716-446655440000",
    "targetExamDate": "2026-06-30"
  }'

# Response:
{
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "name": "AWS Solutions Architect Associate",
  "slug": "aws-solutions-architect-associate-xyz",
  ...
}

# 2. Generate invite link
curl -X POST http://localhost:3000/api/v1/squads/550e8400-e29b-41d4-a716-446655440001/invites \
  -H "Authorization: Bearer <token>"

# Response:
{
  "token": "550e8400-e29b-41d4-a716-446655440002",
  "expiresAt": "2026-05-23T...",
  "squadName": "AWS Solutions Architect Associate",
  "joinUrl": "https://app.certgym.com/squads/join/550e8400-e29b-41d4-a716-446655440002"
}

# 3. Share joinUrl with friend
# Friend receives email/Slack with link and clicks it

# 4. Friend joins
curl -X POST http://localhost:3000/api/v1/squads/join/550e8400-e29b-41d4-a716-446655440002 \
  -H "Authorization: Bearer <friend_token>"

# Response:
{
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "memberCount": 2,  # Increased from 1
  ...
}
```

### Example 2: Error Scenarios

```bash
# Attempt to create squad as FREE user
curl -X POST http://localhost:3000/api/v1/squads \
  -H "Authorization: Bearer <free_token>" \
  -H "Content-Type: application/json" \
  -d '{"name": "Study Group", "certificationId": "..."}'

# Response (403):
{
  "statusCode": 403,
  "message": "Free users cannot create squads",
  "error": "Forbidden"
}

# Attempt to join with expired token
curl -X POST http://localhost:3000/api/v1/squads/join/550e8400-e29b-41d4-a716-446655440099 \
  -H "Authorization: Bearer <token>"

# Response (400):
{
  "statusCode": 400,
  "message": "Invite expired",
  "error": "Bad Request"
}

# Exceed daily invite limit
curl -X POST http://localhost:3000/api/v1/squads/{id}/invites \
  -H "Authorization: Bearer <token>"

# Response (429):
{
  "statusCode": 429,
  "message": "Daily invite limit reached",
  "error": "Too Many Requests"
}
```

---

## Database Schema

### Key Tables

**Organization** (with kind = 'SQUAD')
```
id (UUID PK)
kind (OrgKind enum): 'SQUAD', 'COMPANY', ...
name (string)
slug (string, unique per owner)
certificationId (UUID FK → Certification)
targetExamDate (timestamp, nullable)
maxSeats (int, default 50)
createdAt (timestamp)
```

**OrgMember**
```
id (UUID PK)
orgId (UUID FK → Organization)
userId (UUID FK → User)
role (OrgRole enum): 'OWNER', 'ADMIN', 'MEMBER'
isActive (boolean)
joinedAt (timestamp)
```

**OrgInvite**
```
id (UUID PK)
orgId (UUID FK → Organization)
email (string, nullable for token-based invites)
token (string, nullable, unique)
status (InviteStatus enum): 'PENDING', 'ACCEPTED', 'REVOKED', 'DECLINED'
invitedBy (UUID FK → User)
expiresAt (timestamp)
createdAt (timestamp)
```

### Indexes

```sql
CREATE INDEX idx_orginvite_squad_daily_limit
  ON OrgInvite(org_id, invited_by, created_at)
  WHERE status = 'PENDING';
```

This index optimizes the daily rate limit query for invite generation.

---

## Changelog

### Version 1.0 (2026-05-16)

- Initial release of Squads API
- Three core endpoints: create, invite, join
- Token-based invites with 7-day TTL
- Rate limiting: 10 invites per owner per day
- Plan-based access control
- RLS enforcement at database layer
