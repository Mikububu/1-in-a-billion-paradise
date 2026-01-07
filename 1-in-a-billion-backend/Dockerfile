FROM node:22-bookworm-slim

# Install ffmpeg, Python, and build tools for native modules (swisseph)
RUN apt-get update && apt-get install -y --no-install-recommends \
  ffmpeg ca-certificates python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install deps first (better layer caching)
COPY package.json package-lock.json ./
RUN npm ci

# Rebuild native modules for container architecture (critical for swisseph)
RUN npm rebuild swisseph

# Copy source
COPY . .

# Explicitly ensure ephemeris files are present (critical for Swiss Ephemeris)
COPY ephe /app/ephe

# Build TypeScript
RUN npm run build

# Runtime settings
ENV NODE_ENV=production
ENV PORT=8787

EXPOSE 8787

# Copy entrypoint script
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Use entrypoint (supports RUN_MODE=server|worker)
ENTRYPOINT ["/docker-entrypoint.sh"]









