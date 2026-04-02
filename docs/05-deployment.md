# 05 - Deployment & Infrastructure

Brain Gym aims for simple, highly scalable deployment paradigms capable of running anywhere from a local environment to heavy cloud infrastructure. 

## 1. Containerization

We heavily employ Docker to abstract OS-level requirements.

### Frontend Container
- Multi-stage Docker build (`Dockerfile`).
- **Stage 1 (Builder):** Uses `node` or `bun` base images to compile the React/Vite source code into static assets.
- **Stage 2 (Runner):** Uses an ultra-lightweight `nginx:alpine` image. It copies the generated static assets (`/dist`) into Nginx's HTML root and configures internal routing to serve the SPA reliably.

### Backend Container
- Built via the NestJS CLI flow inside (`backend/Dockerfile`).
- Exposes port 3000 to the internal container network.
- Boots leveraging an entrypoint script to apply Prisma Migrations dynamically (`docker-entrypoint.sh`).

## 2. Composition (`docker-compose.yml`)

The primary development & hosting method stitches three core services:

```yaml
services:
  db:
      image: postgres:15-alpine
      # Serves PostgreSQL for data persistence

  backend:
      build: ./backend
      depends_on: [db]
      # Exposes API on Host :3000

  frontend:
      build: .
      depends_on: [backend]
      # Exposes application on Host :80
```

## 3. Reverse Proxy (Nginx)

The Frontend container functions as both the static file host and a reverse proxy in production variants. The file `nginx-frontend.conf` configures:
1.  **SPA Routing fallback:** All unmapped paths redirect to `index.html`.
2.  **API Gateway Routing:** Anticipates routes targeting `/api/` and reverse-proxies them silently to the internal backend container. This circumvents heavy CORS configuration needs in standard cloud deployments and unifies the domain topology.

## 4. Environment Variables

Both Backend and Frontend rely strictly on `.env` definitions to adjust logic.
- **Frontend Variables**: Defined in `.env.example`. Bound via Vite (`VITE_API_BASE_URL`).
- **Backend Variables**: Defined in `backend/.env.example`. Contains critical runtime secrets like `DATABASE_URL` and `JWT_SECRET`.
