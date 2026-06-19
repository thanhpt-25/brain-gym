# MCP API Keys — Secure LLM Question Intake

**Date:** 2026-06-19  
**Status:** Approved  
**Contributor:** Pham Tien Thanh

## Problem

As a Contributor, I want Claude (or any MCP-compatible LLM tool) to generate certification exam questions in CertGym's format and push them into the review queue — so I don't have to author questions manually.

An MCP server (`backend/src/mcp-server.ts`) and intake endpoint (`POST /api/v1/ai-questions/mcp/intake`) already exist but have three security gaps:

1. The MCP server authenticates using the contributor's full-access JWT — a leaked config file gives an attacker complete account access.
2. The intake endpoint has no rate limiting (unlike `/generate` which caps at 10/hr).
3. No audit log is written when questions arrive via MCP.

## Scope

- Dedicated, revocable MCP API keys (scoped to the intake endpoint only)
- Per-key rate limiting: 100 questions per hour per API key (counted per intake request, not per question in the payload) via the existing Redis throttler
- Audit logging for every MCP intake call
- Settings UI for key management (generate, list, revoke)
- Update `mcp-server.ts` to use the new `X-API-Key` header

Out of scope: review UI changes, notifications, per-user daily quota, multi-scope keys.

---

## Architecture

```
[Claude Desktop / any MCP client]
        │  stdio
        ▼
[mcp-server.ts]  ──X-API-Key──►  POST /api/v1/ai-questions/mcp/intake
                                          │
                              ┌───────────┴───────────┐
                        ApiKeyAuthGuard          ThrottleGuard
                        (SHA-256 hash lookup,    (100 q/hr per key,
                         hydrate req.user)        Redis-backed)
                                          │
                                   mcpIntake()
                                          │
                              ┌───────────┴───────────┐
                         quality gate              audit log
                         (≥0.85 → APPROVED,        (MCP_INTAKE action,
                          0.60–0.84 → PENDING,      keyId, saved/discarded)
                          <0.60 → discard)
                                          │
                                   questions table
```

Questions in `PENDING` status surface in the existing reviewer queue — no new review UI needed.

---

## Data Model

### New Prisma model: `McpApiKey`

```prisma
model McpApiKey {
  id         String    @id @default(cuid())
  userId     String
  user       User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  name       String                     // contributor label, e.g. "My Claude Desktop"
  keyHash    String    @unique          // SHA-256(raw key) — plaintext never stored
  prefix     String                     // first 8 chars of raw key for display
  lastUsedAt DateTime?
  createdAt  DateTime  @default(now())
  revokedAt  DateTime?                  // null = active; set on revoke, never deleted

  @@index([userId])
}
```

**Key format:** `mcp_` + 32 cryptographically random bytes encoded as base64url (total ~47 chars).  
**Plaintext** is returned once at creation and never stored. Only `SHA-256(key)` is persisted.  
**Revocation** sets `revokedAt`; the row is kept for audit trail purposes.

---

## Backend

### New: `ApiKeyAuthGuard` (`backend/src/auth/guards/api-key-auth.guard.ts`)

1. Read `X-API-Key` header — `401` if missing.
2. Validate format (`mcp_` prefix, expected length) — `401` immediately on bad format (no DB hit, avoids leaking which check failed).
3. Compute `SHA-256(rawKey)`, query `McpApiKey` where `keyHash = hash AND revokedAt IS NULL`.
4. `401` if not found — same generic message as step 2.
5. Set `req.user` from `key.user`, set `req.mcpKeyId = key.id` for downstream use.
6. Update `lastUsedAt` asynchronously (fire-and-forget — does not block the request).

### Updated: `AiQuestionBankController.mcpIntake`

```typescript
@Post('mcp/intake')
@Throttle({ mcp: { ttl: 3_600_000, limit: 100 } })  // 100 requests/hr per key
@UseGuards(ApiKeyAuthGuard)
mcpIntake(@Req() req: McpRequest, @Body() dto: McpIntakeDto) {
  return this.service.mcpIntake(req.user.id, req.mcpKeyId, dto);
}
```

The throttler uses `req.mcpKeyId` as the tracker key via a `McpThrottlerGuard` subclass that overrides `getTracker()`. Revoking a key therefore also kills its rate-limit bucket on next Redis TTL expiry (≤1 hr).

### Updated: `AiQuestionBankService.mcpIntake`

Adds audit log call after saving questions:

```typescript
await this.audit.log({
  action: 'MCP_INTAKE',
  userId,
  metadata: { keyId, saved: saved.length, discarded: discarded.length, certificationId: dto.certificationId },
});
```

### New: `McpKeysController` (`backend/src/mcp-keys/`)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/mcp-keys` | List active keys (prefix + metadata, no hash) |
| `POST` | `/api/v1/mcp-keys` | Generate new key — returns plaintext once |
| `DELETE` | `/api/v1/mcp-keys/:id` | Revoke key (sets `revokedAt`) |

All endpoints use `JwtAuthGuard`. Ownership is enforced: `DELETE` verifies `key.userId === req.user.id`.

---

## Frontend

A new **"MCP API Keys"** tab card added to the existing Settings page (`src/pages/Settings/`).

**List view:** displays `name`, `prefix`, `createdAt`, `lastUsedAt` per key with a "Revoke" button.

**Generate flow:**
1. "Generate new key" button → modal with a `name` text input.
2. On submit → `POST /api/v1/mcp-keys` → success shows a one-time code block with copy button and warning: *"This key will not be shown again. Copy it now and paste it into your Claude Desktop config."*
3. On modal close → key appears in list by prefix only.

---

## MCP Server Changes (`backend/src/mcp-server.ts`)

- Rename env var `BRAIN_GYM_BEARER_TOKEN` → `BRAIN_GYM_API_KEY`.
- Replace `Authorization: Bearer ${token}` header with `X-API-Key: ${apiKey}`.
- Update error message, README example, and `claude_desktop_config.json` snippet in the file header.
- No logic changes — the tool schema and quality gate behavior are unchanged.

---

## Security Properties

| Threat | Mitigation |
|--------|-----------|
| Stolen API key floods review queue | Per-key rate limit: 100 questions/hr via Redis throttler |
| Stolen API key grants full account access | Key is scoped to intake only; `ApiKeyAuthGuard` only hydrates `req.user` — no session, no cookie, no JWT |
| Key leaks from config file | Key shown once, never retrievable; contributor can revoke instantly from Settings |
| Timing-based key enumeration | SHA-256 constant-time hash comparison; same 401 message for all failure modes |
| Malformed / oversized payloads | Existing `class-validator` on `McpIntakeDto`; NestJS body size limit already in place |
| Undetectable abuse | Audit log entry on every intake call; `lastUsedAt` visible in Settings UI |

---

## Migration

One new migration: create `McpApiKey` table. No changes to existing tables.

---

## Open Questions

None — all design decisions resolved in review.
