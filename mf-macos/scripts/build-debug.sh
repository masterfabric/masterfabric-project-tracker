#!/usr/bin/env bash
# Regenerate Xcode project and build Debug with Apple Development signing (required for WidgetKit).
set -euo pipefail
cd "$(dirname "$0")/.."
TEAM="${DEVELOPMENT_TEAM:-4GW994398K}"
command -v xcodegen >/dev/null || { echo "Install XcodeGen: brew install xcodegen"; exit 1; }
xcodegen generate
xcodebuild -project MFProjectTracker.xcodeproj -scheme MFProjectTracker -destination 'platform=macOS' \
  -configuration Debug \
  DEVELOPMENT_TEAM="$TEAM" \
  CODE_SIGN_STYLE=Automatic \
  CODE_SIGN_IDENTITY="Apple Development" \
  CODE_SIGNING_REQUIRED=YES CODE_SIGNING_ALLOWED=YES \
  build
echo "Build OK. For Widget Gallery discovery, run: ./scripts/install-debug.sh"
