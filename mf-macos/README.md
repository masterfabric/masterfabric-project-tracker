# MF Project Tracker — macOS menu bar + widgets

SwiftUI companion for [masterfabric-project-tracker](../README.md): a **menu bar** app (`MenuBarExtra`) and **WidgetKit** extensions that talk to the same **mf-go GraphQL** API as mf-expo.

## Features

- Sign in with email/password (same `login` mutation; OTP accounts must finish OTP in the mobile app first)
- **My tasks** — open/due-soon list, toggle complete, quick-add todo
- **Projects** — org + project pickers with OPEN/DONE counts
- **Focus timer** — local 25/15/5 presets (not synced to mf-go)
- **Widgets** — My Tasks, Project Pulse, Focus Timer, Quick Add Todo
- Deep link **Open App** → `masterfabricexpo://`

## Requirements

- macOS 14+
- Xcode 15+ (tested with Xcode 17)
- [XcodeGen](https://github.com/yonaskolb/XcodeGen) (`brew install xcodegen`) to regenerate the project after `project.yml` changes
- Running **mf-go** (default GraphQL URL `http://localhost:8080/graphql`)

## Build & run

```bash
cd mf-macos
xcodegen generate          # refreshes MFProjectTracker.xcodeproj
open MFProjectTracker.xcodeproj
```

In Xcode: select scheme **MFProjectTracker** → Run.

CLI (unsigned local Debug):

```bash
cd mf-macos
xcodegen generate
xcodebuild -scheme MFProjectTracker -destination 'platform=macOS' \
  -configuration Debug CODE_SIGN_IDENTITY="-" CODE_SIGNING_REQUIRED=NO CODE_SIGNING_ALLOWED=NO build
```

Shared kit only:

```bash
cd mf-macos && swift build
```

## Configuration

| Setting | Where |
|---------|--------|
| GraphQL URL | Login sheet, Settings window, or Info.plist `GRAPHQL_URL` (Debug default `http://localhost:8080/graphql`) |
| Client identity | Sends `X-Bundle-ID: com.masterfabric.monoExpo` (required by mf-go); optional `X-API-Key` |
| Session | Keychain (`com.masterfabric.projectTracker.macos`) |
| Widget snapshots / timer | `~/Library/Application Support/com.masterfabric.projectTracker/` |

Todo GraphQL selections omit `dueAt` so older mf-go schemas still work. If `organizationProjects` is missing on the server, the Projects section degrades without breaking tasks/timer.


For distribution builds, set your **Development Team** in Xcode, enable **App Groups** (`group.com.masterfabric.projectTracker`) on both targets if you want the suite-backed path, and turn **Hardened Runtime** on.

## Layout

```
mf-macos/
  Package.swift              # MFTrackerKit SPM
  MFTrackerKit/Sources/…     # GraphQL, auth, models, timer, snapshot store
  App/                       # MenuBarExtra UI
  Widgets/                   # WidgetBundle + App Intents
  Configs/                   # Info.plist + entitlements
  project.yml                # XcodeGen spec
  MFProjectTracker.xcodeproj
```

## Smoke checklist

1. Start mf-go locally.
2. Run the Mac app → menu bar icon appears (no Dock icon; `LSUIElement`).
3. Sign in → open tasks load; complete and create a todo.
4. Pick an org/project → OPEN/DONE counts match Expo.
5. Start a 25m timer → menu bar label shows remaining time.
6. Add widgets from Notification Center / Desktop → they reflect cached snapshot after refresh.

## Notes

- Accounts with **OTP required** on login are not supported in the Mac sheet yet — use an account without OTP or complete login flows that return tokens directly.
- Focus timer is **device-local** only (no mf-go time-tracking schema).
- Widgets read cached snapshots written by the menu bar app after GraphQL refreshes.
