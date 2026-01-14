#!/usr/bin/env bash
set -euo pipefail

# Detect process type from Fly.io's FLY_PROCESS_GROUP env var
PROCESS_GROUP="${FLY_PROCESS_GROUP:-app}"
echo "[entrypoint] FLY_PROCESS_GROUP=${PROCESS_GROUP}"

case "$PROCESS_GROUP" in
  # ═══════════════════════════════════════════════════════════════════════════
  # DEDICATED WORKER PROCESSES (run single worker type)
  # ═══════════════════════════════════════════════════════════════════════════
  watchdog)
    echo "[entrypoint] Starting watchdog worker..."
    exec node dist/workers/watchdogWorker.js
    ;;
  song-worker)
    echo "[entrypoint] Starting song worker..."
    exec node dist/workers/songWorker.js
    ;;
  audio-worker)
    echo "[entrypoint] Starting audio worker..."
    exec node dist/workers/audioWorker.js
    ;;
  pdf-worker)
    echo "[entrypoint] Starting PDF worker..."
    exec node dist/workers/pdfWorker.js
    ;;
  people-scaling-worker)
    echo "[entrypoint] Starting people scaling worker..."
    exec node dist/workers/peopleScalingWorker.js
    ;;
  audiobook-worker)
    echo "[entrypoint] Starting audiobook worker..."
    exec node dist/workers/audiobookQueueWorker.js
    ;;
  
  # ═══════════════════════════════════════════════════════════════════════════
  # COMBINED WORKER (runs text + PDF + audio in one container)
  # ═══════════════════════════════════════════════════════════════════════════
  worker)
    echo "[entrypoint] Starting text worker (worker group)..."
    # Dedicated PDF/audio workers run in their own process groups.
    exec node dist/workers/textWorker.js
    ;;
  
  # ═══════════════════════════════════════════════════════════════════════════
  # API SERVER (default)
  # ═══════════════════════════════════════════════════════════════════════════
  app|*)
    echo "[entrypoint] Starting API server..."
    exec node dist/server.js
    ;;
esac
