# 06 - Security & Authentication

## 1. Authentication Flow (JWT)

CertGym uses stateless JWT authentication implemented in `backend/src/auth/auth.service.ts`.

### Token issuance

When a user logs in (email/password or OAuth social login), `generateTokens()` signs two JWTs using `@nestjs/jwt`:

| Token | Secret env var | Expiry env var | Default expiry |
|---|---|---|---|
| `accessToken` | `JWT_SECRET` | `JWT_EXPIRES_IN` | `15m` |
| `refreshToken` | `JWT_REFRESH_SECRET` | `JWT_REFRESH_EXPIRES_IN` | `7d` |

Both tokens carry the same payload: `{ sub: userId, email, role }`.

The response also includes the user object and the list of active organization memberships (slug, name, org-level role).

### Token refresh

`POST /auth/refresh` accepts a `refreshToken`, verifies it against `JWT_REFRESH_SECRET`, looks up the user by `sub`, and issues a fresh token pair. Any verification failure (expired, tampered, unknown user) returns HTTP 401.

### Frontend storage and auto-refresh

The frontend stores tokens in the Zustand auth store (`src/stores/auth.store.ts`). The Axios instance in `src/services/api.ts` attaches `Authorization: Bearer <accessToken>` to every request. When a 401 response is received, the interceptor pauses the outgoing request queue, calls `/auth/refresh`, replaces the tokens, and retries queued requests. On refresh failure it calls `logout()`.

### Social login (OAuth)

`POST /auth/social/:provider` (currently Google) accepts the provider's ID token, verifies it via the registered `OAuthProviderRegistry`, and upserts the user record and `OAuthAccount` link. The same token pair is issued as for email/password login.

### Account status checks

`JwtStrategy.validate()` (called on every authenticated request) enforces account status in addition to token validity:

- `BANNED` users receive HTTP 403 on every request, regardless of token validity.
- `SUSPENDED` users receive HTTP 403 if `suspendedUntil` is still in the future. If the suspension window has passed, the request proceeds; the account is fully reactivated on the next explicit login.

Login (`auth.service.ts`) applies the same checks before issuing tokens.

## 2. Guards and Decorators

### `JwtAuthGuard` (`backend/src/auth/guards/jwt-auth.guard.ts`)

Extends `AuthGuard('jwt')` from Passport. Applied globally via `APP_GUARD` in `AppModule`. It checks for the `@Public()` decorator metadata key (`isPublic`):

- On a `@Public()` route: a request with no `Authorization` header is allowed through (user is `null`). A request with an `Authorization` header that fails JWT verification returns HTTP 401 — invalid tokens on public routes are not silently downgraded to anonymous.
- On a protected route: any missing or invalid token returns HTTP 401.

### `RolesGuard` (`backend/src/auth/guards/roles.guard.ts`)

Reads the `roles` metadata set by the `@Roles()` decorator. If no roles are required the guard passes. If the authenticated user's `role` is `ADMIN`, the guard passes regardless of the required roles. Otherwise the user's role must be included in the required list.

**Usage:**
```typescript
@UseGuards(RolesGuard)
@Roles(UserRole.CONTRIBUTOR, UserRole.ADMIN)
```

### `OrgRoleGuard` (`backend/src/organizations/guards/org-role.guard.ts`)

Used on organization-scoped routes. Reads the `orgRoles` metadata set by `@OrgRoles()`. Resolves the organization by `orgId` or `slug` from route params, looks up an active `OrgMember` record for the current user, and attaches `request.orgMembership` for downstream use. If the membership is not found, HTTP 403 is returned. If `@OrgRoles()` specifies roles, the member's role must be in that list.

**Usage:**
```typescript
@UseGuards(JwtAuthGuard, OrgRoleGuard)
@OrgRoles(OrgRole.ADMIN)
```

### `@Public()` decorator

Marks a route as publicly accessible. The `JwtAuthGuard` allows unauthenticated requests through but still validates the token if one is present.

### `@CurrentUser()` decorator

A parameter decorator that extracts `request.user` (or a specific field if a key is passed) populated by `JwtStrategy`.

## 3. Platform Roles (RBAC)

The `UserRole` enum from Prisma defines four platform-wide roles:

| Role | Scope |
|:---|:---|
| `LEARNER` (default) | Consume public exams, track personal attempts, manage private flashcard decks, comment, and upvote. |
| `CONTRIBUTOR` | Learner permissions, plus submit new questions and build public exams. Actions may land in `PENDING` status awaiting review. |
| `REVIEWER` | Contributor permissions, plus approve pending content queues and modify community metadata. |
| `ADMIN` | Full platform access: manage vendors and certifications, process bans and suspensions, view audit logs. `RolesGuard` grants `ADMIN` users unconditional access to any role-protected endpoint. |

## 4. Organization Roles

Organization membership uses a separate `OrgRole` enum. `OrgRoleGuard` enforces membership and role within the organization context. The current user's `OrgMember` record is attached to `request.orgMembership` for controllers to read.

## 5. Password Storage

Passwords are hashed using `bcryptjs` (`backend/src/users/users.service.ts`). The salt is generated with `bcrypt.genSalt()` (default rounds: 10, the bcryptjs library default). The resulting hash is stored in the `passwordHash` column. Plaintext passwords are never persisted or logged.

During login, `bcrypt.compare()` validates the supplied password against the stored hash. OAuth users who have never set a password have a `null` `passwordHash`; they cannot log in via the email/password flow.

## 6. CORS

CORS is configured in `backend/src/main.ts`:

```typescript
const corsOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim())
  : ['http://localhost', 'http://localhost:8080', 'http://localhost:5173'];
app.enableCors({ origin: corsOrigins, credentials: true });
```

In production, `CORS_ORIGINS` is set by the Terraform ECS task definition to the CloudFront domain and the custom domain name. The development fallback allows the Vite dev server on ports 8080 and 5173 and plain `http://localhost`.

## 7. Input Validation

`ValidationPipe` is registered globally in `main.ts` with:

- `whitelist: true` — strips any properties not declared in the DTO, preventing mass-assignment attacks.
- `transform: true` — coerces incoming request data to the declared DTO types.

## 8. Rate Limiting

`ThrottlerModule` from `@nestjs/throttler` is configured globally in `AppModule`:

```
ttl: 60000ms (1 minute window)
limit: 300 requests per window
```

This applies to all endpoints by default. Individual controllers or handlers can override the limit with `@Throttle()` or opt out with `@SkipThrottle()`. The AI question bank controller and the assessment candidate controller use `@Throttle()` with custom limits; the org-questions controller uses `@SkipThrottle()`.

## 9. SQL Injection

The application uses Prisma ORM exclusively for all database access. Prisma sends parameterized queries to PostgreSQL, eliminating SQL injection risks from application-layer query construction.

## 10. Frontend Security Headers

The frontend container's Nginx config (`nginx-frontend.conf`) sets the following response headers on all requests:

| Header | Value |
|---|---|
| `Content-Security-Policy-Report-Only` | `default-src 'self'`; allows inline scripts/styles, Google Fonts, and known AI API origins; blocks frames and objects. Report-only mode — violations are logged but not blocked. |
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` |

The `Content-Security-Policy-Report-Only` header is a transition step; the comment in the config notes it should be promoted to an enforcing `Content-Security-Policy` once no legitimate violations are observed.

## 11. Required Secrets at Startup

`main.ts` validates the following environment variables at process startup and throws if any are missing:

- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `DATABASE_URL`

The application will not start without these three variables set.
