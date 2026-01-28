#!/usr/bin/env bash
set -euo pipefail

# Quick helper to publish an EAS Update for the frontend app
# Usage: ./publish-eas-update.sh [branch] [message]
#
# AUTH: Expo disabled legacy API keys / eas login. Use a Personal Access Token:
#   1. Go to https://expo.dev/settings/access-tokens
#   2. Create a token, copy it
#   3. Run: EXPO_TOKEN=your_token ./scripts/publish-eas-update.sh
#   Or export EXPO_TOKEN in your shell / .env before running.
BRANCH="${1:-main}"
MSG="${2:-"chore: OTA update via EAS"}"

echo "Publishing EAS update to branch: $BRANCH"
echo "Message: $MSG"

if [[ -z "${EXPO_TOKEN:-}" ]]; then
  echo ""
  echo "⚠️  EXPO_TOKEN not set. Expo disabled legacy eas login / API keys."
  echo "   Create a token at https://expo.dev/settings/access-tokens"
  echo "   Then run: EXPO_TOKEN=your_token $0 $*"
  echo ""
  exit 1
fi

if ! command -v eas >/dev/null 2>&1; then
  echo "eas CLI not found. Installing locally..."
  npm i -g eas-cli >/dev/null 2>&1 || true
  if ! command -v eas >/dev/null 2>&1; then
    echo "Failed to install eas-cli. Please install it manually and re-run."
    exit 1
  fi
fi

EXPO_TOKEN="$EXPO_TOKEN" eas update --branch "$BRANCH" --message "$MSG" --non-interactive
