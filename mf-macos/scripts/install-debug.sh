#!/usr/bin/env bash
# Build Debug (Apple Development signed), install to /Applications, register WidgetKit extension.
# Ad-hoc / DerivedData-only builds are invisible to pluginkit and Edit Widgets on modern macOS.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

DEST="/Applications/MF Project Tracker.app"
TEAM="${DEVELOPMENT_TEAM:-4GW994398K}"
IDENTITY="${CODE_SIGN_IDENTITY:-Apple Development: Nurhayat Yurtaslan (4966TR63WP)}"

command -v xcodegen >/dev/null || { echo "Install XcodeGen: brew install xcodegen"; exit 1; }

echo "==> Sync env from repo-root local.env (GraphQL / API key / Bundle ID / Particular)"
bash "$ROOT/scripts/sync-env.sh"

echo "==> Generating Xcode project"
xcodegen generate

echo "==> Quitting running instances (Applications + DerivedData + bundle id)"
# Kill by process name AND by macOS bundle id — install can leave two status items.
pkill -9 -f "MF Project Tracker" 2>/dev/null || true
pkill -9 -f "MFTrackerWidgets" 2>/dev/null || true
pkill -9 -f "com.masterfabric.projectTracker.macos" 2>/dev/null || true
# LaunchServices may still list a second instance launched from DerivedData.
while IFS= read -r pid; do
  [[ -n "$pid" ]] || continue
  kill -9 "$pid" 2>/dev/null || true
done < <(pgrep -f "/MF Project Tracker.app/Contents/MacOS/MF Project Tracker" 2>/dev/null || true)
sleep 1
# Verify a single (or zero) instance before we launch the fresh build.
# pgrep exits 1 when nothing matches — do not trip `set -o pipefail`.
REMAINING="$( { pgrep -f "/MF Project Tracker.app/Contents/MacOS/MF Project Tracker" || true; } | wc -l | tr -d ' ' )"
if [[ "${REMAINING}" != "0" ]]; then
  echo "WARN: ${REMAINING} MF Project Tracker process(es) still alive after kill — continuing"
fi

echo "==> Cleaning prior Debug products for this scheme"
xcodebuild -project MFProjectTracker.xcodeproj -scheme MFProjectTracker \
  -destination 'platform=macOS' -configuration Debug \
  DEVELOPMENT_TEAM="$TEAM" \
  CODE_SIGN_STYLE=Automatic \
  CODE_SIGN_IDENTITY="Apple Development" \
  CODE_SIGNING_REQUIRED=YES CODE_SIGNING_ALLOWED=YES \
  clean >/dev/null || true

echo "==> Building Debug (team $TEAM)"
xcodebuild -project MFProjectTracker.xcodeproj -scheme MFProjectTracker \
  -destination 'platform=macOS' -configuration Debug \
  DEVELOPMENT_TEAM="$TEAM" \
  CODE_SIGN_STYLE=Automatic \
  CODE_SIGN_IDENTITY="Apple Development" \
  CODE_SIGNING_REQUIRED=YES CODE_SIGNING_ALLOWED=YES \
  build

BUILT="$(find "$HOME/Library/Developer/Xcode/DerivedData" -path '*/Build/Products/Debug/MF Project Tracker.app' -type d 2>/dev/null | head -1 || true)"
[[ -d "$BUILT" ]] || { echo "Built app not found"; exit 1; }
APPEX="$BUILT/Contents/PlugIns/MFTrackerWidgets.appex"
[[ -d "$APPEX" ]] || { echo "Missing MFTrackerWidgets.appex in $BUILT"; exit 1; }

echo "==> Installing to $DEST"
rm -rf "$DEST"
ditto "$BUILT" "$DEST"
xattr -cr "$DEST" || true

# Ensure Info.plist embeds env from local.env (xcconfig can lose empty-overridden keys).
if [[ -f "${ROOT}/../local.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "${ROOT}/../local.env"
  set +a
fi
INJECT_GRAPHQL="${EXPO_PUBLIC_DEV_GRAPHQL_URL:-${EXPO_PUBLIC_GRAPHQL_URL:-http://127.0.0.1:8080/graphql}}"
INJECT_GRAPHQL="${INJECT_GRAPHQL//localhost/127.0.0.1}"
INJECT_BUNDLE="${EXPO_PUBLIC_MF_BUNDLE_ID:-com.masterfabric.monoExpo}"
INJECT_API="${EXPO_PUBLIC_MF_APP_API_KEY:-${EXPO_PUBLIC_MF_API_KEY:-}}"
INJECT_PART="${EXPO_PUBLIC_MF_PROJECT_TRACKER_PARTICULAR:-project_tracker}"
for PLIST in \
  "$DEST/Contents/Info.plist" \
  "$DEST/Contents/PlugIns/MFTrackerWidgets.appex/Contents/Info.plist"
do
  /usr/libexec/PlistBuddy -c "Set :GRAPHQL_URL ${INJECT_GRAPHQL}" "$PLIST" 2>/dev/null \
    || /usr/libexec/PlistBuddy -c "Add :GRAPHQL_URL string ${INJECT_GRAPHQL}" "$PLIST"
  /usr/libexec/PlistBuddy -c "Set :MF_CLIENT_BUNDLE_ID ${INJECT_BUNDLE}" "$PLIST" 2>/dev/null \
    || /usr/libexec/PlistBuddy -c "Add :MF_CLIENT_BUNDLE_ID string ${INJECT_BUNDLE}" "$PLIST"
  /usr/libexec/PlistBuddy -c "Set :MF_PROJECT_TRACKER_PARTICULAR ${INJECT_PART}" "$PLIST" 2>/dev/null \
    || /usr/libexec/PlistBuddy -c "Add :MF_PROJECT_TRACKER_PARTICULAR string ${INJECT_PART}" "$PLIST"
  if [[ -n "$INJECT_API" ]]; then
    /usr/libexec/PlistBuddy -c "Set :MF_APP_API_KEY ${INJECT_API}" "$PLIST" 2>/dev/null \
      || /usr/libexec/PlistBuddy -c "Add :MF_APP_API_KEY string ${INJECT_API}" "$PLIST"
  fi
done
echo "  Info.plist injected GRAPHQL_URL=${INJECT_GRAPHQL} API_KEY=$([ -n "$INJECT_API" ] && echo set || echo empty)"

# Fail loudly if Sign In would be broken (empty API key / missing GraphQL).
if [[ -z "$INJECT_API" ]]; then
  echo "ERROR: EXPO_PUBLIC_MF_APP_API_KEY is empty in local.env — Sign In will fail without X-API-Key." >&2
  echo "  Fix: ../masterfabric-particulars/scripts/print-mf-project-tracker-env.sh > ../local.env && ./scripts/sync-env.sh" >&2
  exit 1
fi
if [[ -z "$INJECT_GRAPHQL" || -z "$INJECT_BUNDLE" ]]; then
  echo "ERROR: GraphQL URL or Bundle ID missing after env sync." >&2
  exit 1
fi

# Clear stale Keychain session so a previous TOKEN_INVALID state cannot block a clean Sign In.
echo "==> Clearing stale Keychain auth session (if any)"
security delete-generic-password -s "com.masterfabric.projectTracker.macos" -a "authSession" 2>/dev/null || true
# Also clear signed-out snapshot auth flag so widgets show Sign in until login.
GROUP_SUPPORT="${HOME}/Library/Group Containers/group.com.masterfabric.projectTracker/Library/Application Support/com.masterfabric.projectTracker"
PREF_DOMAIN="${HOME}/Library/Group Containers/group.com.masterfabric.projectTracker/Library/Preferences/group.com.masterfabric.projectTracker"
/usr/bin/defaults write "$PREF_DOMAIN" widgetAuthAuthenticated -string "0" 2>/dev/null || true
/usr/bin/defaults delete "$PREF_DOMAIN" widgetAuthUserLabel 2>/dev/null || true
/usr/bin/defaults delete "$PREF_DOMAIN" widgetSnapshot 2>/dev/null || true
rm -f "${GROUP_SUPPORT}/widgetSnapshot.json" 2>/dev/null || true
# Do not kill cfprefsd — that hangs subsequent defaults/UserDefaults across the session.

# Expand $(AppIdentifierPrefix) — codesign does not substitute Xcode build settings.
TMP_ENT="$(mktemp -d)/ents"
mkdir -p "$TMP_ENT"
sed "s/\$(AppIdentifierPrefix)/${TEAM}./g" "$ROOT/Configs/Widgets.entitlements" > "$TMP_ENT/Widgets.entitlements"
sed "s/\$(AppIdentifierPrefix)/${TEAM}./g" "$ROOT/Configs/App.entitlements" > "$TMP_ENT/App.entitlements"

echo "==> Codesign with $IDENTITY"
# Sign appex first, then deep-sign the app so nested *.debug.dylib seals stay valid
# (partial outer-only resign caused launchd spawn failure 163).
codesign --force --sign "$IDENTITY" --entitlements "$TMP_ENT/Widgets.entitlements" \
  --timestamp=none "$DEST/Contents/PlugIns/MFTrackerWidgets.appex"
codesign --force --deep --sign "$IDENTITY" --entitlements "$TMP_ENT/App.entitlements" \
  --timestamp=none "$DEST"
rm -rf "$TMP_ENT"

echo "==> Clear WidgetKit / chronod caches for this extension"
rm -rf "$HOME/Library/Caches/com.apple.chrono/snapshot-cache"/* 2>/dev/null || true
rm -rf "$HOME/Library/Caches/com.apple.chrono/widget-relevance-cache"/* 2>/dev/null || true
# Stale Desktop chrome often lives here (snapshots/placeholders/timelines dated older than the binary).
WIDGET_CHRONO="$HOME/Library/Containers/com.masterfabric.projectTracker.macos.widgets/Data/SystemData/com.apple.chrono"
if [[ -d "$WIDGET_CHRONO" ]]; then
  echo "  clearing $WIDGET_CHRONO/{snapshots,placeholders,timelines,relevance}"
  rm -rf "$WIDGET_CHRONO/snapshots" "$WIDGET_CHRONO/placeholders" \
         "$WIDGET_CHRONO/timelines" "$WIDGET_CHRONO/relevance" 2>/dev/null || true
  mkdir -p "$WIDGET_CHRONO/snapshots" "$WIDGET_CHRONO/placeholders" \
           "$WIDGET_CHRONO/timelines" "$WIDGET_CHRONO/relevance"
fi
# Also wipe any archived Desktop widget chrome under chronod's global caches.
find "$HOME/Library/Caches/com.apple.chrono" -iname '*projectTracker*' -exec rm -rf {} + 2>/dev/null || true
find "$HOME/Library/Containers" -maxdepth 4 -iname '*projectTracker*' 2>/dev/null | while read -r p; do
  echo "  note: $p"
done || true

echo "==> LaunchServices + pluginkit register"
/System/Library/Frameworks/CoreServices.framework/Versions/Current/Frameworks/LaunchServices.framework/Versions/Current/Support/lsregister -f "$DEST"
pluginkit -a "$DEST/Contents/PlugIns/MFTrackerWidgets.appex" 2>/dev/null || true
pluginkit -e use -i com.masterfabric.projectTracker.macos.widgets 2>/dev/null || true

echo "==> Restart widget hosts"
killall -9 NotificationCenter 2>/dev/null || true
killall -9 chronod 2>/dev/null || true
killall -9 WidgetKit 2>/dev/null || true
sleep 1

echo "==> Launching app (registers widgets)"
open "$DEST" || true
sleep 2

WIDGET_VER="$(plutil -extract CFBundleShortVersionString raw "$DEST/Contents/PlugIns/MFTrackerWidgets.appex/Contents/Info.plist" 2>/dev/null || true)"
WIDGET_BUILD="$(plutil -extract CFBundleVersion raw "$DEST/Contents/PlugIns/MFTrackerWidgets.appex/Contents/Info.plist" 2>/dev/null || true)"
echo "==> Installed widget extension ${WIDGET_VER} build ${WIDGET_BUILD}"

echo "==> pluginkit check"
if pluginkit -mAvvv -p com.apple.widgetkit-extension 2>/dev/null | grep -iE 'masterfabric|projectTracker|MFTracker|Project Tracker'; then
  echo "OK: extension visible to pluginkit"
else
  echo "WARN: still not listed — check Signing & Capabilities / App Group group.com.masterfabric.projectTracker on team $TEAM"
fi

echo ""
echo "IMPORTANT: remove ALL old Project Tracker Desktop tiles, then re-add from Edit Widgets."
echo "Widget build ${WIDGET_VER:-?}/${WIDGET_BUILD:-?} — chronod keeps signed-out chrome until tiles are re-added once."
echo "Next: Desktop → Edit Widgets → search \"Project Tracker\" or \"pro\""
echo "Add \"Project Tracker Dashboard\" (Medium) — labels should be Me / Proj / Chat / Done (not Pe…)."
echo "Signed out: tap Sign in → menu bar LoginView. Signed in: metrics match the menu-bar strip."
echo "Verify: open 'mfprojecttracker://login'   Env: npm run mf-macos:env before install if local.env changed."
echo "After Sign In: defaults read …/group.com.masterfabric.projectTracker widgetAuthAuthenticated → 1"
API_EMBEDDED="$(plutil -extract MF_APP_API_KEY raw "$DEST/Contents/Info.plist" 2>/dev/null || true)"
GQL_EMBEDDED="$(plutil -extract GRAPHQL_URL raw "$DEST/Contents/Info.plist" 2>/dev/null || true)"
BID_EMBEDDED="$(plutil -extract MF_CLIENT_BUNDLE_ID raw "$DEST/Contents/Info.plist" 2>/dev/null || true)"
echo "Embedded GRAPHQL_URL: ${GQL_EMBEDDED:-'(empty)'}"
echo "Embedded MF_CLIENT_BUNDLE_ID: ${BID_EMBEDDED:-'(empty)'}"
echo "Embedded MF_APP_API_KEY: $([ -n "$API_EMBEDDED" ] && echo '(set)' || echo '(empty)')"
if [[ -z "$API_EMBEDDED" || -z "$GQL_EMBEDDED" || -z "$BID_EMBEDDED" ]]; then
  echo "ERROR: post-install Info.plist missing required Sign In env keys." >&2
  exit 1
fi
echo "Sign In UI: Email + Password only (server config → Settings → Server)."
