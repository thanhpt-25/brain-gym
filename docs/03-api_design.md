# 03 - API Design

Brain Gym exposes a RESTful backend API powered by NestJS.

## 1. Core API Philosophy

- **Global Prefix**: All endpoints are prefixed with `/api/v1`.
- **Authentication**: JWT-based via HTTP Bearer token securely passed in the `Authorization` header.
- **Data Exchange**: JSON exclusively. 
- **Validation**: Strict validation via NestJS `ValidationPipe` leveraging `class-validator` and `class-transformer` decorators.
- **Documentation**: Swagger OpenAPI integration (available at `/api/docs` in dev mode).

## 2. Standardized Responses

Standard successful responses return objects or arrays directly.
Errors map correctly to predictable HTTP Status codes:
- **`400 Bad Request`**: Validation errors, malformed payloads.
- **`401 Unauthorized`**: Missing JWT, expired token.
- **`403 Forbidden`**: Valid JWT, but lacking necessary RBAC permissions (e.g., LEARNER hitting ADMIN route).
- **`404 Not Found`**: Resource does not exist.
- **`500 Internal Server Error`**: Unhandled exception.

## 3. Notable Endpoints & Modules

### `auth/`
- `POST /auth/register`: User enrollment.
- `POST /auth/login`: Returns `accessToken` and `refreshToken`.
- `POST /auth/refresh`: Swaps a valid refresh token for a new access token.

### `users/` & `admin/`
- User profile management. Protected paths limit capabilities based on `UserRole`.

### `certifications/`
- Catalog of vendors, certifications, and sub-domains to drive navigation.

### `questions/`
- **CRUD**: Full lifecycle for question administration.
- **Voting/Reporting**: Community actions applied to existing `Question` entries.

### `exams/` & `attempts/`
- **Exams**: Constructing exam templates natively or via dynamic generation.
- **Attempts**: Handling the Exam Taking simulation. Starting attempts, submitting answers, finishing and returning score summaries.

### `training/`
- Dedicated spaced repetition engine routes. Submits SM-2 review scores, updates schedules.

### `flashcards/` & `capture/`
- Custom `Decks` and flashcard reviews. Mid-exam word highlighting capabilities.

### `ai-question-bank/`
- LLM configuration endpoints.
- Triggers and polling parameters for Question Generation background jobs.

## 4. Internal Mechanics
- Use of `@UseGuards(JwtAuthGuard, RolesGuard)` extensively.
- Services rely on dependency injection for `PrismaService` to execute DB transaction.
