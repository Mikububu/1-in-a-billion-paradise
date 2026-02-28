# Build stage — cache bust: 2026-02-28
FROM node:22-bookworm-slim AS builder

# Install build tools for native modules
RUN apt-get update && apt-get install -y --no-install-recommends \
  python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install ALL dependencies (including devDependencies for build)
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# Remove devDependencies after build
RUN npm prune --omit=dev

# Production stage
FROM node:22-bookworm-slim

# Install only runtime dependencies (ffmpeg for audio)
RUN apt-get update && apt-get install -y --no-install-recommends \
  ffmpeg ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Copy built app and production node_modules from builder (includes compiled native modules)
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules

# Copy assets (fonts for PDF generation)
COPY --from=builder /app/assets ./assets

# CRITICAL: Copy prompts folder (required by promptLoader.ts for deep readings)
COPY --from=builder /app/prompts ./prompts

# V2 prompt-layer engine reads Markdown from this folder at runtime.
COPY --from=builder /app/prompt-layers ./prompt-layers

# Copy runtime files
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Runtime settings
ENV NODE_ENV=production
ENV PORT=8787

EXPOSE 8787

# Use entrypoint (supports RUN_MODE=server|worker)
ENTRYPOINT ["/docker-entrypoint.sh"]








