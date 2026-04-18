#!/usr/bin/env bash
# Bump mf-expo app version for deploy (package.json, lockfile, app.json, iOS Info.plist).
#
# Usage:
#   ./scripts/app-deploy-version.sh <version> [buildNumber]
# Examples:
#   ./scripts/app-deploy-version.sh 1.0.5
#   ./scripts/app-deploy-version.sh 1.0.5 4
#
# From repo root with npm:
#   npm run mf-expo:version -- 1.0.5
#   npm run mf-expo:version -- 1.0.5 4
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
MF_EXPO="$REPO_ROOT/mf-expo"

VERSION="${1:-}"
BUILD="${2:-}"

if [[ -z "$VERSION" ]]; then
  echo "Usage: $0 <version> [buildNumber]" >&2
  echo "  version     — semver shown in stores (e.g. 1.0.5)" >&2
  echo "  buildNumber — optional; sets iOS CFBundleVersion, expo.ios.buildNumber, expo.android.versionCode" >&2
  exit 1
fi

PKG_JSON="$MF_EXPO/package.json"
PKG_LOCK="$MF_EXPO/package-lock.json"
APP_JSON="$MF_EXPO/app.json"
PLIST="$MF_EXPO/ios/MFProjectTracker/Info.plist"

for f in "$PKG_JSON" "$PKG_LOCK" "$APP_JSON" "$PLIST"; do
  if [[ ! -f "$f" ]]; then
    echo "Missing: $f" >&2
    exit 1
  fi
done

export VERSION
export BUILD
export PKG_JSON PKG_LOCK APP_JSON PLIST

node <<'NODE'
const fs = require("fs");

const version = process.env.VERSION;
const build = process.env.BUILD;
const pkgJsonPath = process.env.PKG_JSON;
const pkgLockPath = process.env.PKG_LOCK;
const appJsonPath = process.env.APP_JSON;

const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, "utf8"));
pkg.version = version;
fs.writeFileSync(pkgJsonPath, JSON.stringify(pkg, null, 2) + "\n");

const lock = JSON.parse(fs.readFileSync(pkgLockPath, "utf8"));
lock.version = version;
if (lock.packages && lock.packages[""]) {
  lock.packages[""].version = version;
}
fs.writeFileSync(pkgLockPath, JSON.stringify(lock, null, 2) + "\n");

const app = JSON.parse(fs.readFileSync(appJsonPath, "utf8"));
if (!app.expo) {
  console.error("app.json: missing expo root");
  process.exit(1);
}
app.expo.version = version;
if (build) {
  const bStr = String(build).trim();
  const code = parseInt(bStr, 10);
  if (Number.isNaN(code) || String(code) !== bStr) {
    console.error("buildNumber must be a non-negative integer string, got:", build);
    process.exit(1);
  }
  app.expo.ios = app.expo.ios || {};
  app.expo.ios.buildNumber = bStr;
  app.expo.android = app.expo.android || {};
  app.expo.android.versionCode = code;
}
fs.writeFileSync(appJsonPath, JSON.stringify(app, null, 2) + "\n");
NODE

perl -i -pe '
  BEGIN { $v = $ENV{VERSION}; die "VERSION missing" unless defined $v && length $v; }
  s{(<key>CFBundleShortVersionString</key>\s*<string>)[^<]*(</string>)}{$1$v$2};
' "$PLIST"

if [[ -n "$BUILD" ]]; then
  export BUILD
  perl -i -pe '
    BEGIN { $b = $ENV{BUILD}; die "BUILD missing" unless defined $b && length $b; }
    s{(<key>CFBundleVersion</key>\s*<string>)[^<]*(</string>)}{$1$b$2};
  ' "$PLIST"
fi

echo "Updated mf-expo version to ${VERSION}"
[[ -n "$BUILD" ]] && echo "Set build number to ${BUILD} (app.json + CFBundleVersion)"
echo "  $PKG_JSON"
echo "  $PKG_LOCK"
echo "  $APP_JSON"
echo "  $PLIST"
