# 06 - Security & Authentication

System integrity and content reliability are core tenets of the Brain Gym platform. All security mechanisms flow through the central identity system.

## 1. Authentication Flow (JWT)

Brain Gym relies on stateless JWT authentication.

1.  **Login**: User authenticates with Email/Password.
2.  **Issuance**: The API returns an `accessToken` (Short-lived, e.g., 15-60m) and a `refreshToken` (Long-lived, e.g., 7-30d).
3.  **Local Storage**: The frontend persists tokens securely within the Zustand client-side store hook.
4.  **Auto-refresh**: When the Axios interceptor attempts an API request and catches a `401 Unauthorized` response, it pauses the queue, uses the `refreshToken` to hit the `/auth/refresh` API endpoint, and replaces the tokens dynamically to resume the queue without interrupting UX.

## 2. Authorization & RBAC

Role-Based Access Control limits system capabilities based on the `UserRole` enum. The NestJS backend implements this via `@UseGuards(RolesGuard)` combined with `@Roles('CONTRIBUTOR', 'ADMIN')` metadata decorators on specific API endpoints.

| Role | Scope |
| :--- | :--- |
| **LEARNER (Default)** | Can consume public exams, track personal attempts, own private flashcard decks, comment, and upvote. |
| **CONTRIBUTOR** | Learner permissions + Can submit new Questions, build Public Exams. Actions often land in a `PENDING` status. |
| **REVIEWER** | Contributor permissions + Can approve `PENDING` content queues and modify existing community metadata. |
| **ADMIN** | God-mode. Modifies platform taxonomies (Vendors, Certifications), processes bans, views Audit logs. |

## 3. Threat Mitigation

- **Password Storage**: Passwords are mathematically hashed natively using strict bcrypt rounds before saving to the DB (`password_hash`).
- **CORS Protection**: The NestJS server controls allowed origins securely leveraging the `CORS_ORIGINS` environment setup to thwart browser-based cross-site forgery behaviors.
- **Prisma Injection Protection**: The platform sidesteps SQL injection risks entirely by relying exclusively on the Prisma ORM which leverages parameterized statements.
- **Rate-limiting (Future)**: Intended to be handled at the Nginx ingress boundary, limiting DDOS vectors and spam generation constraints.
