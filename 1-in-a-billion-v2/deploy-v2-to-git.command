#!/usr/bin/env zsh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PARENT_REPO="$(cd "$SCRIPT_DIR/.." && pwd)"
PREFIX="$(basename "$SCRIPT_DIR")"
DEFAULT_BRANCH="codex/v2-backup-split-20260212-consent"

usage() {
  cat <<USAGE
Usage:
  ./deploy-v2-to-git.command "commit message" [split-branch]
  ./deploy-v2-to-git.command --status

Examples:
  ./deploy-v2-to-git.command "feat(v2): migrate next screens"
  ./deploy-v2-to-git.command --status
USAGE
}

if [[ "${1:-}" == "--status" ]]; then
  (cd "$PARENT_REPO" && git status --short -- "$PREFIX")
  exit 0
fi

if [[ $# -lt 1 ]]; then
  usage
  exit 1
fi

MESSAGE="$1"
BRANCH="${2:-$DEFAULT_BRANCH}"

cd "$PARENT_REPO"

echo "[v2] Staging only: $PREFIX"
git add -A -- "$PREFIX"

if git diff --cached --quiet; then
  echo "[v2] No staged changes in $PREFIX."
else
  git commit -m "$MESSAGE"
  echo "[v2] Commit created in parent repo."
fi

echo "[v2] Creating subtree split for $PREFIX..."
SPLIT_SHA="$(git subtree split --prefix="$PREFIX" HEAD)"
echo "[v2] Split SHA: $SPLIT_SHA"

echo "[v2] Pushing split to origin/$BRANCH"
git push origin "$SPLIT_SHA:refs/heads/$BRANCH"

echo "[v2] Done."
