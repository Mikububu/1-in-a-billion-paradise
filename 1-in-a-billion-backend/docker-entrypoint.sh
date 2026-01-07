#!/usr/bin/env bash
set -euo pipefail

# Detect process type from Fly.io's FLY_PROCESS_GROUP env var
# or fallback to RUN_MODE env var
if [[ "${FLY_PROCESS_GROUP:-}" == "worker" ]] || [[ "${FLY_PROCESS_GROUP:-}" == "audiobook-worker" ]]; then
  RUN_MODE="worker"
  # Set WORKER_KIND based on process group
  if [[ "${FLY_PROCESS_GROUP:-}" == "audiobook-worker" ]]; then
    WORKER_KIND="audiobook"
  else
    WORKER_KIND="${WORKER_KIND:-combined}" # combined | text | audio | pdf
  fi
else
  RUN_MODE="${RUN_MODE:-server}"
  WORKER_KIND="${WORKER_KIND:-combined}"
fi

if [[ "$RUN_MODE" == "worker" ]]; then
  echo "[entrypoint] RUN_MODE=worker WORKER_KIND=${WORKER_KIND}"

  case "$WORKER_KIND" in
    text)
      exec node dist/workers/textWorker.js
      ;;
    audio)
      exec node dist/workers/audioWorker.js
      ;;
    audiobook)
      exec node dist/workers/audiobookQueueWorker.js
      ;;
    pdf)
      exec node dist/workers/pdfWorker.js
      ;;
    combined)
      # Run all workers in the same container (text → PDF → audio workflow)
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
    *)
      echo "[entrypoint] Unknown WORKER_KIND=${WORKER_KIND}" >&2
      exit 1
      ;;
  esac
else
  echo "[entrypoint] RUN_MODE=server"
  exec node dist/server.js
fi
