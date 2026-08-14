#!/usr/bin/env bash
# Install signed MF Project Tracker into /Applications and register WidgetKit.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
ID='Apple Development: Nurhayat Yurtaslan (4966TR63WP)'
xcodegen generate
xcodebuild -scheme MFProjectTracker -configuration Release -destination 'platform=macOS' \
  CODE_SIGN_IDENTITY='-' CODE_SIGNING_REQUIRED=NO CODE_SIGNING_ALLOWED=NO \
  DEVELOPMENT_TEAM='' \
  build

PRODUCT="$(ls -d "$HOME"/Library/Developer/Xcode/DerivedData/MFProjectTracker-*/Build/Products/Release/"MF Project Tracker.app" | head -1)"
APPEX="$PRODUCT/Contents/PlugIns/MFTrackerWidgets.appex"
TEAM="${DEVELOPMENT_TEAM:-4GW994398K}"
TMP_ENT="$(mktemp -d)"
sed "s/\$(AppIdentifierPrefix)/${TEAM}./g" "$ROOT/Configs/Widgets.entitlements" > "$TMP_ENT/Widgets.entitlements"
sed "s/\$(AppIdentifierPrefix)/${TEAM}./g" "$ROOT/Configs/App.entitlements" > "$TMP_ENT/App.entitlements"
ENT_APP="$TMP_ENT/App.entitlements"
ENT_W="$TMP_ENT/Widgets.entitlements"

codesign --force --sign "$ID" --entitlements "$ENT_W" --timestamp=none --options runtime "$APPEX"
codesign --force --sign "$ID" --entitlements "$ENT_APP" --timestamp=none --options runtime --deep "$PRODUCT"

pkill -f 'MF Project Tracker' 2>/dev/null || true
sleep 1
rm -rf "/Applications/MF Project Tracker.app"
cp -R "$PRODUCT" "/Applications/MF Project Tracker.app"
codesign --force --sign "$ID" --entitlements "$ENT_W" --timestamp=none --options runtime \
  "/Applications/MF Project Tracker.app/Contents/PlugIns/MFTrackerWidgets.appex"
codesign --force --sign "$ID" --entitlements "$ENT_APP" --timestamp=none --options runtime --deep \
  "/Applications/MF Project Tracker.app"

pluginkit -a "/Applications/MF Project Tracker.app/Contents/PlugIns/MFTrackerWidgets.appex" || true
pluginkit -e use -i com.masterfabric.projectTracker.macos.widgets || true
open -a "/Applications/MF Project Tracker.app"
sleep 2
echo "--- pluginkit ---"
pluginkit -mAvvv -p com.apple.widgetkit-extension 2>/dev/null | rg -i 'masterfabric|projectTracker|Project Tracker' \
  || echo "WidgetKit gallery may still hide team-dev widgets; use menu bar → Pin Desktop Dashboard."
echo "Done. Menu bar: Pin Desktop Dashboard. Gallery search: Project Tracker"
