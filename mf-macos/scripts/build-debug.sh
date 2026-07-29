#!/usr/bin/env bash
# Regenerate Xcode project and build Debug (unsigned) for local smoke tests.
set -euo pipefail
cd "$(dirname "$0")"
command -v xcodegen >/dev/null || { echo "Install XcodeGen: brew install xcodegen"; exit 1; }
xcodegen generate
xcodebuild -scheme MFProjectTracker -destination 'platform=macOS' \
  -configuration Debug \
  CODE_SIGN_IDENTITY="-" CODE_SIGNING_REQUIRED=NO CODE_SIGNING_ALLOWED=NO \
  build
echo "Build OK. Open MFProjectTracker.xcodeproj and Run, or launch the app from DerivedData."
