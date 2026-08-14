#!/usr/bin/env bash
# Sync mf-desktop/.env (+ optional mf-web/.env.local) from repo-root local.env
# (same source as Expo: print-mf-project-tracker-env.sh → local.env).
#
# Usage:
#   ./scripts/sync-desktop-env.sh
#   ./scripts/sync-desktop-env.sh --web     # also refresh mf-web/.env.local
#   ./scripts/sync-desktop-env.sh --macos   # also mf-macos xcconfig + App Group
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOCAL_ENV="${ROOT}/local.env"
DESKTOP_ENV="${ROOT}/mf-desktop/.env"
WEB_ENV="${ROOT}/mf-web/.env.local"
DO_WEB=0
DO_MACOS=0

for arg in "$@"; do
  case "$arg" in
    --web) DO_WEB=1 ;;
    --macos) DO_MACOS=1 ;;
    -h|--help)
      echo "Usage: $0 [--web] [--macos]"
      exit 0
      ;;
  esac
done

if [[ ! -f "$LOCAL_ENV" ]]; then
  echo "Missing ${LOCAL_ENV}" >&2
  echo "Generate it first:" >&2
  echo "  ../masterfabric-particulars/scripts/print-mf-project-tracker-env.sh > local.env" >&2
  exit 1
fi

# shellcheck disable=SC1090
set -a
# shellcheck source=/dev/null
source "$LOCAL_ENV"
set +a

GRAPHQL_URL="${EXPO_PUBLIC_DEV_GRAPHQL_URL:-${EXPO_PUBLIC_GRAPHQL_URL:-http://127.0.0.1:8080/graphql}}"
# Prefer 127.0.0.1 for Electron (avoids localhost → IPv6 quirks)
GRAPHQL_URL="${GRAPHQL_URL//localhost/127.0.0.1}"
BUNDLE_ID="${EXPO_PUBLIC_MF_BUNDLE_ID:-com.masterfabric.monoExpo}"
API_KEY="${EXPO_PUBLIC_MF_APP_API_KEY:-${EXPO_PUBLIC_MF_API_KEY:-}}"
PARTICULAR="${EXPO_PUBLIC_MF_PROJECT_TRACKER_PARTICULAR:-project_tracker}"

mkdir -p "$(dirname "$DESKTOP_ENV")"
cat > "$DESKTOP_ENV" <<EOF
# Synced from repo-root local.env by scripts/sync-desktop-env.sh ($(date -u +%Y-%m-%dT%H:%M:%SZ))
# Do not commit. Regenerate: npm run env:sync --prefix mf-desktop
# or: ./scripts/sync-desktop-env.sh
VITE_GRAPHQL_URL=${GRAPHQL_URL}
VITE_MF_PROJECT_TRACKER_PARTICULAR=${PARTICULAR}
VITE_MF_BUNDLE_ID=${BUNDLE_ID}
VITE_MF_API_KEY=${API_KEY}
EOF

echo "Wrote ${DESKTOP_ENV}"
echo "  VITE_GRAPHQL_URL=${GRAPHQL_URL}"
echo "  VITE_MF_BUNDLE_ID=${BUNDLE_ID}"
echo "  VITE_MF_API_KEY=$([ -n "$API_KEY" ] && echo '(set)' || echo '(empty)')"

if [[ "$DO_WEB" -eq 1 ]]; then
  mkdir -p "$(dirname "$WEB_ENV")"
  cat > "$WEB_ENV" <<EOF
# Synced from repo-root local.env by scripts/sync-desktop-env.sh ($(date -u +%Y-%m-%dT%H:%M:%SZ))
NEXT_PUBLIC_GRAPHQL_URL=${GRAPHQL_URL}
NEXT_PUBLIC_MF_PROJECT_TRACKER_PARTICULAR=${PARTICULAR}
NEXT_PUBLIC_MF_BUNDLE_ID=${BUNDLE_ID}
NEXT_PUBLIC_MF_API_KEY=${API_KEY}
EOF
  echo "Wrote ${WEB_ENV}"
fi

if [[ "${DO_MACOS:-0}" -eq 1 ]]; then
  bash "${ROOT}/mf-macos/scripts/sync-env.sh"
fi
