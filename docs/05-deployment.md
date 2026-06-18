# 05 - Deployment & Infrastructure

CertGym runs in two modes: a local Docker Compose stack for development and a production AWS environment managed with Terraform.

## 1. Containerization

All services are packaged as Docker images. Both Dockerfiles use a two-stage build on `node:20-alpine`.

### Frontend Container (`Dockerfile`)

- **Stage 1 (builder):** installs npm dependencies with `--legacy-peer-deps`, then runs `npm run build` via Vite. The build-time arg `VITE_GOOGLE_CLIENT_ID` is accepted as a Docker `ARG` and baked into the bundle; it must be supplied at image build time.
- **Stage 2 (runner):** copies the compiled `dist/` into an `nginx:stable-alpine` image at `/usr/share/nginx/html`. The file `nginx-frontend.conf` is copied in as the Nginx default config (see section 3 below).

### Backend Container (`backend/Dockerfile`)

- **Stage 1 (builder):** installs npm dependencies, copies the `prisma/` schema, runs `npx prisma generate`, then compiles the NestJS app with `npm run build`.
- **Stage 2 (runner):** copies the compiled `dist/`, `node_modules/`, `prisma/`, and `docker-entrypoint.sh` from the builder. The entrypoint script is made executable.
- Exposes port 3000. The default `CMD` is `sh docker-entrypoint.sh` (start mode).

## 2. Composition (`docker-compose.yml`)

The Compose file defines six services for local development and self-hosted deployments:

| Service | Image / Build | Container name | Exposed ports |
|---|---|---|---|
| `postgres` | `postgres:16-alpine` | `braingym-postgres` | `5432` (host-mapped) |
| `redis` | `redis:7-alpine` | `braingym-redis` | `6379` (host-mapped) |
| `backend` | `./backend/Dockerfile` | `braingym-backend` | `3000` (internal only) |
| `frontend` | `./Dockerfile` | `braingym-frontend` | `80` (internal only) |
| `markitdown` | `./lambda/markitdown/Dockerfile.local` | `braingym-markitdown` | `8001` (internal only) |
| `nginx` | `nginx:stable-alpine` | `braingym-nginx` | `${NGINX_PORT:-80}:80` |

The `backend` service waits for `postgres` and `redis` health checks to pass before starting. `VITE_GOOGLE_CLIENT_ID` is a required build arg for the `frontend` service — the Compose file will error if it is not set.

### Key environment variables (backend service)

| Variable | Default in Compose | Notes |
|---|---|---|
| `DATABASE_URL` | Derived from postgres service | `postgresql://braingym:braingym_dev_2024@postgres:5432/braingym` |
| `JWT_SECRET` | `braingym-jwt-secret-change-in-production` | Must be replaced in production |
| `JWT_EXPIRES_IN` | `15m` | Configurable via env var |
| `JWT_REFRESH_SECRET` | `braingym-refresh-secret-change-in-production` | Must be replaced in production |
| `JWT_REFRESH_EXPIRES_IN` | `7d` | Configurable via env var |
| `REDIS_HOST` | `redis` | Internal service hostname |
| `LLM_KEY_ENCRYPTION_SECRET` | `braingym-llm-encryption-secret-change-in-production` | Must be replaced in production |
| `MARKITDOWN_LOCAL_URL` | `http://markitdown:8001` | Internal service URL |

## 3. Nginx Configuration

The Compose stack uses a dedicated `nginx` service (`nginx:stable-alpine`) with `nginx/default.conf` mounted read-only. It acts as the single ingress point and reverse-proxies to the other containers:

- **`/api/v1`** → `http://backend:3000/api/v1` — passes WebSocket upgrade headers; allows request bodies up to 50 MB (matching the Multer limit in the backend).
- **`/api/docs`** → `http://backend:3000/api/docs` — proxies the NestJS Swagger UI.
- **`/uploads`** → `http://backend:3000/uploads` — proxies locally stored avatar files served as NestJS static assets.
- **`/`** (default) → `http://frontend:80` — passes WebSocket upgrade headers; SPA routing is handled by the frontend container's own Nginx config.

The frontend container runs its own Nginx config (`nginx-frontend.conf`) which handles SPA routing internally (`try_files $uri $uri/ /index.html`). This config also sets security headers (see section 06-security).

## 4. Entrypoint Script (`backend/docker-entrypoint.sh`)

The script accepts an optional positional argument (`start` or `migrate`) and defaults to `start`.

**`start` mode (default at container startup):**
- In non-production environments (`NODE_ENV != production`): runs migrations then conditionally seeds (`RUN_SEED=true` required; off by default).
- In production: skips migrations (they are run separately by the CI/CD pipeline before the service is deployed) and jumps straight to `exec npm run start:prod`.

**`migrate` mode (used by CI/CD):**
- Runs `npx prisma migrate deploy`.
- Handles a P3005 error (non-empty database with no migration history) by baselining all known migrations with `prisma migrate resolve --applied`, then retrying deploy.
- Resolves two specific previously-failed migrations (`20260328000002_fix_schema_drift` and `20260530000001_dds_ensure_default_live`) with `--rolled-back` before attempting deploy.
- Exits non-zero on any other failure.

## 5. CI/CD (GitHub Actions)

Two workflows govern the delivery pipeline:

### CI (`.github/workflows/ci.yml`) — runs on every pull request to `main`

Jobs run in this order (parallel where possible):

1. **Type / Strict FE Services** — runs `npm run type-check:strict` against the frontend services layer.
2. **Lint / Frontend** and **Lint / Backend** — ESLint checks (run in parallel).
3. **Test / Frontend Unit** (after lint) and **Test / Backend Unit** (after backend lint) — Vitest and Jest unit tests.
4. **Test / Backend E2E** (after backend unit tests) — spins up `postgres:16-alpine` and `redis:7-alpine` service containers, runs Prisma migrations, then executes the NestJS e2e suite.
5. **Test / Frontend E2E Smoke** (after frontend lint) — runs Playwright smoke tests against Chromium.
6. **Build / Frontend** and **Build / Backend** — production builds, artifacts uploaded and retained for 7 days.
7. **Docker / Build Images** — builds both Docker images (no push) to validate Dockerfiles; uses GitHub Actions cache.

### Deploy (`.github/workflows/deploy.yml`) — runs on push to `main`; also manually dispatchable

Target environment defaults to `staging` on automatic runs; can be set to `production` via `workflow_dispatch`. Deploys to AWS `ap-southeast-1`.

Jobs in dependency order:

1. **Setup** — determines the target environment and image tag (commit SHA).
2. **Build & Push Backend** and **Build & Push Markitdown Lambda** (parallel) — builds Docker images and pushes to ECR. The Markitdown image is pushed with OCI media-type compatibility flags required by AWS Lambda.
3. **Migrate Database** (after backend push) — registers a new revision of the `braingym-backend-migrate` ECS task definition pinned to the new image SHA, runs it as a one-off Fargate task invoking `docker-entrypoint.sh migrate`, and polls for completion (5-minute timeout).
4. **Deploy Backend** (after migrations) — renders a new revision of the `braingym-backend` ECS task definition with the SHA-pinned image and deploys it to the `braingym-<environment>` ECS cluster, waiting for service stability.
5. **Deploy Frontend** (parallel to backend deploy) — builds the React app with environment-specific `VITE_*` vars, syncs `dist/` to the S3 bucket (hashed assets cached for 1 year; `index.html` cached for 1 hour), then creates a CloudFront invalidation for `/*`.
6. **Smoke Test** (after both deploys) — polls `$DEPLOYMENT_ENDPOINT/api/v1/health` up to 30 times with 5-second intervals.
7. **Notify** — reports overall pass/fail status.

## 6. Production Infrastructure (Terraform)

The `infra/` directory contains Terraform that provisions the production AWS environment. Key resources:

- **RDS PostgreSQL 16** (`rds.tf`) — private, encrypted (`gp3` storage), multi-AZ configurable, automated backups, deletion protection enabled in production. Password is auto-generated (32 chars, URL-safe symbols only) and stored in AWS Secrets Manager.
- **ElastiCache Redis** (`elasticache.tf`) — used for backend caching.
- **ECS Fargate** (`ecs.tf`) — two task definitions: `braingym-backend` (long-running service) and `braingym-backend-migrate` (one-off migration task). The service has a deployment circuit breaker with automatic rollback enabled. Secrets (`JWT_SECRET`, `JWT_REFRESH_SECRET`, `DATABASE_URL`, `LLM_KEY_ENCRYPTION_SECRET`) are injected from AWS Secrets Manager at task launch.
- **Application Load Balancer** (`alb.tf`) — HTTPS termination, forwards to the ECS service on port 3000.
- **CloudFront + S3** (`s3_cloudfront.tf`) — three origins: private S3 bucket (frontend SPA), private S3 avatars bucket, and the ALB (backend API). API requests matching `/api/v1/*` are forwarded to the ALB uncached. Frontend assets are cached with aggressive TTLs. CloudFront returns `index.html` for 403/404 responses to support client-side SPA routing. TLS minimum version is `TLSv1.2_2021`.
- **AWS Lambda** (`lambda.tf`) — a containerized Markitdown service (`braingym-<env>-markitdown`) used for document-to-markdown conversion, updated by the CI/CD pipeline on each deploy.
- **ECR** (`ecr.tf`) — separate repositories for `braingym-backend` and `braingym-markitdown` images.

## 7. Environment Variables

### Frontend

Configured via `.env` files (Vite-style). `VITE_*` variables are baked into the static bundle at build time; they are not available at runtime.

| Variable | Purpose |
|---|---|
| `VITE_API_BASE_URL` | Overrides the default `/api/v1` base URL for the Axios instance |
| `VITE_GOOGLE_CLIENT_ID` | Google OAuth client ID for social login |
| `VITE_DDS_SHADOW_MODE` | Feature flag: `false` = live mode, any other value = shadow mode |

### Backend

Configured via environment variables (injected by Compose or ECS). See `backend/.env.example` for a full reference.

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | Yes | Validated at startup; process exits if missing |
| `JWT_SECRET` | Yes | Validated at startup; process exits if missing |
| `JWT_REFRESH_SECRET` | Yes | Validated at startup; process exits if missing |
| `JWT_EXPIRES_IN` | No | Defaults to `15m` |
| `JWT_REFRESH_EXPIRES_IN` | No | Defaults to `7d` |
| `REDIS_HOST` / `REDIS_PORT` | No | Defaults to `localhost` / `6379` |
| `CORS_ORIGINS` | No | Comma-separated allowed origins; defaults to `http://localhost`, `http://localhost:8080`, `http://localhost:5173` |
| `PORT` | No | Defaults to `3000` |
| `LLM_KEY_ENCRYPTION_SECRET` | No | Required for AI features |
| `RUN_SEED` | No | Set to `true` to run `prisma/seed.ts` on startup (non-production only) |
