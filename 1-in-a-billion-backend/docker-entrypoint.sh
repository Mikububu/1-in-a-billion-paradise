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
  audiobook-worker)
    echo "[entrypoint] Starting audiobook worker..."
    exec node dist/workers/audiobookQueueWorker.js
    ;;
  
  # ═══════════════════════════════════════════════════════════════════════════
  # COMBINED WORKER (runs text + PDF + audio in one container)
  # ═══════════════════════════════════════════════════════════════════════════
  worker)
    echo "[entrypoint] Starting combined worker (text + PDF + audio)..."
    
    node dist/workers/textWorker.js &
    TEXT_PID=$!
    node dist/workers/pdfWorker.js &
    PDF_PID=$!
    node dist/workers/audioWorker.js &
    AUDIO_PID=$!

    echo "[entrypoint] Started text worker pid=${TEXT_PID}, PDF worker pid=${PDF_PID}, audio worker pid=${AUDIO_PID}"

    # Forward signals
    trap 'echo "[entrypoint] Caught signal, stopping..."; kill -TERM ${TEXT_PID} ${PDF_PID} ${AUDIO_PID} 2>/dev/null || true; wait ${TEXT_PID} ${PDF_PID} ${AUDIO_PID} 2>/dev/null || true; exit 0' TERM INT

    wait ${TEXT_PID} ${PDF_PID} ${AUDIO_PID}
    ;;
  
  # ═══════════════════════════════════════════════════════════════════════════
  # API SERVER (default)
  # ═══════════════════════════════════════════════════════════════════════════
  app|*)
    echo "[entrypoint] Starting API server..."
    exec node dist/server.js
    ;;
esac
