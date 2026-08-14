#!/usr/bin/env bash
# Regenerate PNG app/tray icons from SVG sources (requires rsvg-convert / librsvg).
set -euo pipefail
cd "$(dirname "$0")/.."

if ! command -v rsvg-convert >/dev/null 2>&1; then
  echo "rsvg-convert not found. Install librsvg (e.g. brew install librsvg)." >&2
  exit 1
fi

rsvg-convert -w 1024 -h 1024 resources/icon.svg -o resources/icon.png
rsvg-convert -w 512 -h 512 resources/icon.svg -o resources/icon-512.png
rsvg-convert -w 32 -h 32 resources/tray-icon.svg -o resources/trayTemplate.png
rsvg-convert -w 64 -h 64 resources/tray-icon.svg -o resources/trayTemplate@2x.png
echo "Wrote resources/icon.png, icon-512.png, trayTemplate.png, trayTemplate@2x.png"
