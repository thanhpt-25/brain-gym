# Building stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package and lock files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies including devDependencies for build
RUN npm ci

# Copy the rest of the application
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build the NestJS application
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma

EXPOSE 3000

# Start: migrate schema, seed initial data (all upserts — safe to re-run), then serve
CMD npx prisma migrate deploy && \
    npx ts-node --compiler-options '{"module":"CommonJS"}' --transpile-only prisma/seed.ts && \
    npm run start:prod
