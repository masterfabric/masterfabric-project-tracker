#!/usr/bin/env bash
# Boot the dedicated "MF Project Tracker" iOS Simulator and run mf-expo
# against masterfabric-core-base GraphQL + particular-project-tracker (:39205).
# Does NOT start any in-repo mf-go (removed from this client repo).
#
# Usage (from masterfabric-project-tracker root):
#   ./scripts/run-ios-simulator.sh
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PARTICULARS="${MASTERFABRIC_PARTICULARS_ROOT:-$(cd "$ROOT/../masterfabric-particulars" 2>/dev/null && pwd || true)}"
SIM_NAME="${MF_PT_SIM_NAME:-MF Project Tracker}"
RUNTIME="${MF_PT_SIM_RUNTIME:-com.apple.CoreSimulator.SimRuntime.iOS-26-4}"
DEVICE_TYPE="${MF_PT_SIM_TYPE:-com.apple.CoreSimulator.SimDeviceType.iPhone-17}"
GRAPHQL_URL="${EXPO_PUBLIC_GRAPHQL_URL:-http://127.0.0.1:8080/graphql}"

echo "→ Checking core-base GraphQL ($GRAPHQL_URL)"
if ! curl -sf "$GRAPHQL_URL" -H 'Content-Type: application/json' -d '{"query":"{ __typename }"}' >/dev/null; then
  echo "core-base mf-go is not reachable at $GRAPHQL_URL" >&2
  echo "Start it from masterfabric-core-base (e.g. cd mf-go && make run)." >&2
  exit 1
fi

echo "→ Checking particular-project-tracker (:39205)"
if ! curl -sf http://127.0.0.1:39205/health >/dev/null; then
  if [[ -z "$PARTICULARS" || ! -d "$PARTICULARS/particular-project-tracker" ]]; then
    echo "Particular not healthy and masterfabric-particulars not found." >&2
    exit 1
  fi
  echo "  starting particular on :39205"
  (cd "$PARTICULARS/particular-project-tracker" && \
    PARTICULAR_JWT_SECRET="${PARTICULAR_JWT_SECRET:-local-dev-secret-not-for-production-use!!}" \
    PORT=39205 go run .) >/tmp/particular-project-tracker.log 2>&1 &
  sleep 2
  curl -sf http://127.0.0.1:39205/health >/dev/null || {
    echo "Failed to start particular — see /tmp/particular-project-tracker.log" >&2
    exit 1
  }
fi

UDID=$(xcrun simctl list devices available | sed -n "s/.*${SIM_NAME} (\([A-F0-9-]*\)).*/\1/p" | head -1)
if [[ -z "$UDID" ]]; then
  echo "→ Creating simulator \"$SIM_NAME\""
  UDID=$(xcrun simctl create "$SIM_NAME" "$DEVICE_TYPE" "$RUNTIME")
fi
echo "→ Booting $SIM_NAME ($UDID)"
xcrun simctl boot "$UDID" 2>/dev/null || true
open -a Simulator --args -CurrentDeviceUDID "$UDID"

if [[ -x "$PARTICULARS/scripts/print-mf-project-tracker-env.sh" ]]; then
  echo "→ Refreshing local.env from particulars"
  "$PARTICULARS/scripts/print-mf-project-tracker-env.sh" >"$ROOT/local.env" || true
  cp "$ROOT/local.env" "$ROOT/mf-expo/.env.development" 2>/dev/null || true
fi

echo "→ expo run:ios --device $UDID (GraphQL → core-base, projects → Particular :39205)"
cd "$ROOT/mf-expo"
exec ./node_modules/.bin/expo run:ios --device "$UDID"
