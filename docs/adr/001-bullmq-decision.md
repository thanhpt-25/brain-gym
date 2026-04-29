# ADR 001: Job Queue — BullMQ on Redis

## Status

Proposed (Spike completed Sprint 1, RFC-004 target Sprint 2)

## Context

AI question generation in `AiQuestionBankService` is currently executed in-process, synchronously within the HTTP request lifecycle. The `generateQuestions` flow calls an external LLM provider (OpenAI, Anthropic, etc.), runs a quality-critic pass, and persists results — all blocking the HTTP thread for the duration of the LLM round-trip (typically 5–30s depending on payload size).

Problems with the current approach:

- **No retry logic**: if the LLM call fails mid-flight, the job is lost
- **HTTP request blocked**: the API caller must hold the connection open for the full generation duration
- **No cost tracking per execution unit**: LLM token usage cannot be attributed to a discrete job record
- **No visibility**: no dashboard or queue depth metrics to observe backlog or failure rates
- **No backpressure**: concurrent generation requests are unbounded and can exhaust LLM API rate limits

Redis 7 is already provisioned in `docker-compose.yml` and referenced via `REDIS_HOST`/`REDIS_PORT` env vars in the backend service — zero new infrastructure is needed to adopt BullMQ.

## Decision

Adopt BullMQ v5 on the existing Redis 7 instance, integrated via `@nestjs/bullmq` v10.

## Alternatives Considered

| Option                   | Verdict  | Reason                                                                   |
| ------------------------ | -------- | ------------------------------------------------------------------------ |
| **In-process (current)** | Rejected | No retry, blocks HTTP thread, no visibility, no cost tracking            |
| **BullMQ (chosen)**      | Adopted  | Battle-tested, NestJS native decorator support, Redis already present    |
| **Temporal.io**          | Rejected | Overkill for current scale; adds new infra dependency (Temporal server)  |
| **AWS SQS**              | Rejected | Vendor lock-in, per-message cost, no local dev parity without localstack |
| **Bull (v3)**            | Rejected | BullMQ is the actively maintained successor; Bull is in maintenance mode |

## Queue Naming Convention

Pattern: `queue:<domain>:<action>`

Examples:

- `queue:ai:generate` — LLM question generation
- `queue:email:welcome` — Transactional welcome emails
- `queue:email:invite` — Org/assessment invitation emails
- `queue:embedding:compute` — Vector embedding computation (Sprint 3+)
- `queue:report:export` — PDF/CSV export

Dead Letter Queues follow the pattern: `queue:<domain>:<action>:dlq`

## Worker Architecture

- **Same repo, separate process**: worker code lives in `backend/src/jobs/`
- Deployed as a separate `worker` container in `docker-compose` (see `001-bullmq-worker-dockerfile.md`)
- Shares Prisma ORM + Redis connection with the API container
- Retry policy: 3 attempts, exponential backoff (1s → 5s → 25s)
- Concurrency: 5 workers per queue (configurable via `WORKER_CONCURRENCY` env var)
- Job TTL: completed jobs retained for 24h, failed jobs retained for 7 days

## Cost & Observability

- BullMQ OSS is sufficient — BullMQ Pro features (rate limiting, groups) not needed at current scale
- Bull Board dashboard (`@bull-board/nestjs`) for local dev and staging visibility
- Job counts exposed via `queue.getJobCounts()` → Prometheus metrics endpoint (Sprint 4+)
- Each job record carries `jobId` for correlation with LLM provider logs

## Spike Findings

- BullMQ `@nestjs/bullmq` is compatible with NestJS 11 ✅
- Redis 7 connection: no auth needed in local dev (docker-compose default) ✅
- Queue naming convention `queue:<domain>:<action>` validated ✅
- POC files location: `backend/src/jobs/` (NOT wired to AppModule — Sprint 2 task)
- Estimated migration effort for AI generation: 1 BE engineer × 3 days (RFC-004)
- No new infra needed: Redis already in `docker-compose.yml` ✅
- `MailService` (nodemailer, in-process) is a secondary migration candidate after AI generation

## Consequences

**Positive:**

- Retry logic with exponential backoff eliminates silent LLM failures
- HTTP endpoints return immediately with `{ jobId, status: "queued" }` — no more long-hanging requests
- Job-level cost tracking: token usage can be stored per `GenerationJob` Prisma record
- Queue depth and failure rates become observable
- Redis already provisioned — zero new infrastructure cost

**Negative:**

- Workers require a separate deployment unit (new `Dockerfile.worker` + `worker` service in docker-compose)
- Job payload serialization must handle large inputs carefully (source chunk text can be 50–200KB); consider storing large payloads in DB and passing only IDs in queue
- Frontend must poll or use WebSocket to receive job completion status (vs. current synchronous response)

## Implementation Plan (RFC-004, Sprint 2)

1. Install `@nestjs/bullmq` + `bullmq` (already added to `package.json`)
2. Wire `JobsModule` into `AppModule`
3. Move `AiQuestionBankService.generateQuestions` to `queue:ai:generate` worker
4. Move `MailService` calls to `queue:email:welcome` / `queue:email:invite`
5. Add `queue:embedding:compute` for pgvector embeddings (Sprint 3)
6. Add Bull Board dev dashboard
7. Add `Dockerfile.worker` and `worker` service to `docker-compose.yml`
8. Frontend: add polling endpoint for `GenerationJob` status
