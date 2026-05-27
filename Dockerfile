# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package and lock files
COPY package*.json ./

# Install dependencies
RUN npm install --legacy-peer-deps

# Copy the rest of the application
COPY . .

# Vite bakes VITE_* vars into the bundle at build time, so it must be
# present during `npm run build` rather than relying on a gitignored .env.
ARG VITE_GOOGLE_CLIENT_ID
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID

# Build the Vite application
RUN npm run build

# Production stage
FROM nginx:stable-alpine

WORKDIR /usr/share/nginx/html

# Remove default nginx static assets
RUN rm -rf ./*

# Copy static assets from builder stage
COPY --from=builder /app/dist .

# Copy custom nginx config for SPA routing
COPY nginx-frontend.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
