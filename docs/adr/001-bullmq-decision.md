# ADR 001: Job Queue — BullMQ on Redis

## Status

Accepted (implemented in Sprint 2; production queues live in `backend/src/queues/`)

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

Adopt BullMQ v5 on the existing Redis 7 instance, integrated via `@nestjs/bullmq` v11.

## Alternatives Considered

| Option                   | Verdict  | Reason                                                                   |
| ------------------------ | -------- | ------------------------------------------------------------------------ |
| **In-process (current)** | Rejected | No retry, blocks HTTP thread, no visibility, no cost tracking            |
| **BullMQ (chosen)**      | Adopted  | Battle-tested, NestJS native decorator support, Redis already present    |
| **Temporal.io**          | Rejected | Overkill for current scale; adds new infra dependency (Temporal server)  |
| **AWS SQS**              | Rejected | Vendor lock-in, per-message cost, no local dev parity without localstack |
| **Bull (v3)**            | Rejected | BullMQ is the actively maintained successor; Bull is in maintenance mode |

## Queue Naming Convention

Pattern: `<domain>[-<action>]` (kebab-case, no `queue:` prefix)

Queues registered in `backend/src/queues/queues.module.ts`:

- `ai-gen` — LLM question generation
- `SCENARIO_GENERATION` — Scenario content generation
- `digest-generation` — Email digest generation
- `coach-session-monitoring` — Coach session monitoring
- `material-conversion` — Study material conversion
- `burnout-detection` — Burnout risk detection

> Note: The original `queue:<domain>:<action>` naming convention was not adopted. The implementation uses shorter kebab-case names. Dead Letter Queues were not implemented.

## Worker Architecture

- **Same repo, same process**: worker code lives in `backend/src/queues/`; processors run inside the main NestJS process via `QueuesModule` (wired into `AppModule`)
- No separate `worker` container — all processors share the `backend` container in `docker-compose`
- Shares Prisma ORM + Redis connection within the same process
- Retry policy: 3 attempts, exponential backoff (5s base delay), configured in `QueuesModule.defaultJobOptions`
- Concurrency: per processor default (BullMQ default; `WORKER_CONCURRENCY` env var was not implemented)
- Job TTL: completed jobs retained (last 100), failed jobs retained (last 200), per `removeOnComplete`/`removeOnFail` in `QueuesModule`

> Note: The separate `Dockerfile.worker` and `worker` service described in `001-bullmq-worker-dockerfile.md` were not created. Workers run in-process in the main backend container.

## Cost & Observability

- BullMQ OSS is sufficient — BullMQ Pro features (rate limiting, groups) not needed at current scale
- Bull Board dashboard (`@bull-board/nestjs`) is live at `/admin/queues` (configured in `QueuesModule`)
- Job counts exposed via `queue.getJobCounts()` → Prometheus metrics endpoint (deferred)
- Each job record carries `jobId` for correlation with LLM provider logs

## Spike Findings

- BullMQ `@nestjs/bullmq` v11 is compatible with NestJS 11 ✅
- Redis 7 connection: no auth needed in local dev (docker-compose default) ✅
- Queue naming uses kebab-case (e.g., `ai-gen`), not the originally proposed `queue:<domain>:<action>` pattern
- Production module location: `backend/src/queues/` (wired to AppModule as `QueuesModule`) ✅
- Spike POC files remain at `backend/src/jobs/` (not wired to AppModule) — superseded by `backend/src/queues/`
- `MailService` digest emails migrated to `digest-generation` queue ✅
- No new infra needed: Redis already in `docker-compose.yml` ✅

## Consequences

**Positive:**

- Retry logic with exponential backoff eliminates silent LLM failures
- HTTP endpoints return immediately with `{ jobId, status: "queued" }` — no more long-hanging requests
- Job-level cost tracking: token usage can be stored per `GenerationJob` Prisma record
- Queue depth and failure rates become observable
- Redis already provisioned — zero new infrastructure cost

**Negative:**

- Workers run in the same process as the HTTP server — a worker crash or memory leak affects the API. (The separate `Dockerfile.worker` / `worker` service was planned but not implemented.)
- Job payload serialization must handle large inputs carefully (source chunk text can be 50–200KB); consider storing large payloads in DB and passing only IDs in queue
- Frontend must poll or use WebSocket to receive job completion status (vs. current synchronous response)

## Implementation Plan (RFC-004, Sprint 2) — Completed

1. ✅ Install `@nestjs/bullmq` v11 + `bullmq` v5
2. ✅ Wire `QueuesModule` into `AppModule` (module is at `backend/src/queues/`)
3. ✅ Move AI generation to `ai-gen` queue worker (`AiGenProcessor`)
4. ✅ Move mail digest to `digest-generation` queue (`DigestGenerationProcessor`)
5. ✅ Added `SCENARIO_GENERATION`, `material-conversion`, `coach-session-monitoring`, `burnout-detection` queues
6. ✅ Bull Board dashboard at `/admin/queues` (via `@bull-board/nestjs`)
7. ❌ `Dockerfile.worker` and separate `worker` service not created — processors run in-process
8. ✅ Polling endpoint available via `JobsController` for `GenerationJob` status
