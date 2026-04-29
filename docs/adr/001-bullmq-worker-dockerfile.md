# BullMQ Worker Dockerfile — Reference Spec

> This document is part of [ADR 001](./001-bullmq-decision.md).
> The actual `Dockerfile.worker` will be created in RFC-004 (Sprint 2).

## Worker Entry Point

The worker process boots NestJS with only the `JobsModule` loaded — no HTTP server, no Swagger, no routes. This keeps the worker image lean and prevents accidental HTTP exposure.

```typescript
// backend/src/worker.ts (to be created in RFC-004)
import { NestFactory } from "@nestjs/core";
import { JobsModule } from "./jobs/jobs.module";

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(JobsModule);
  await app.init();
  console.log("Worker started");
}

bootstrap();
```

## Dockerfile

```dockerfile
# backend/Dockerfile.worker (to be created in RFC-004)
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY --from=builder /app/dist ./dist
CMD ["node", "dist/worker.js"]
```

## docker-compose service addition (RFC-004)

```yaml
# Add to docker-compose.yml in RFC-004
worker:
  build:
    context: ./backend
    dockerfile: Dockerfile.worker
  container_name: braingym-worker
  environment:
    DATABASE_URL: "postgresql://${POSTGRES_USER:-braingym}:${POSTGRES_PASSWORD:-braingym_dev_2024}@postgres:${POSTGRES_PORT:-5432}/${POSTGRES_DB:-braingym}?schema=public"
    REDIS_HOST: "redis"
    REDIS_PORT: ${REDIS_PORT:-6379}
    NODE_ENV: ${NODE_ENV:-production}
    WORKER_CONCURRENCY: ${WORKER_CONCURRENCY:-5}
    LLM_KEY_ENCRYPTION_SECRET: "${LLM_KEY_ENCRYPTION_SECRET:-braingym-llm-encryption-secret-change-in-production}"
  depends_on:
    postgres:
      condition: service_healthy
    redis:
      condition: service_healthy
  restart: unless-stopped
```

## Notes

- The worker shares the same `node_modules` build as the API — single `package.json`, two entry points
- No port exposure needed for the worker container
- Scale horizontally by increasing `replicas` (Docker Swarm) or adding worker pods (Kubernetes)
- `WORKER_CONCURRENCY` controls per-queue parallelism; start at 5, tune based on LLM rate limits
