# Use the official Node.js runtime as base image
FROM node:18-slim AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./
RUN npm install --legacy-peer-deps

# Rebuild the source code only when needed
FROM node:18-slim AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build Next.js
ENV NEXT_TELEMETRY_DISABLED 1
ENV DATABASE_URL "postgresql://dummy:dummy@localhost:5432/dummy?schema=public"
ENV SHADOW_DATABASE_URL "postgresql://dummy:dummy@localhost:5432/dummy_shadow?schema=public"
ENV NEXTAUTH_SECRET "dummy_build_secret"
ENV NEXTAUTH_URL "http://localhost"
RUN npx prisma generate
RUN npm run build

# Production image - use full next start instead of standalone
FROM node:18-slim AS runner
WORKDIR /app

# ffmpeg/ffprobe power sermon thumbnail extraction + duration probing
RUN apt-get update && apt-get install -y openssl ca-certificates ffmpeg && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

# Copy built app and node_modules from builder
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.js ./next.config.js
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/middleware.ts ./middleware.ts

# Copy entrypoint script
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["./docker-entrypoint.sh"]

