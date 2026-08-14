# MF Project Tracker — macOS menu bar + Desktop widgets

Visual reference (hosted via GitHub Releases API, not in git): [`docs/WIDGETS.md`](docs/WIDGETS.md).

SwiftUI companion for Project Tracker: **MenuBarExtra** (primary UI + GraphQL refresh) + **WidgetKit** widgets you pin on the **Desktop** or Notification Center (same gallery as Weather / Calendar).

Talks to the **same backend as mf-expo**:

| Surface | Data path |
|---------|-----------|
| Auth, `myOrganizations`, personal `myTodos` / create / update | **Direct** mf-go GraphQL (`http://127.0.0.1:8080/graphql`) |
| Org projects / project todos / Project Pulse | mf-go **`particularGraphqlEnvelope`** → Particular key **`project_tracker`** (capability `project.tracker.graphql`) — never call the Particular host directly |
| Desktop / NC widgets | Read **cached snapshots** written by the menu bar after GraphQL refresh (App Group `group.com.masterfabric.projectTracker`, mirrored under Application Support) |

Empty API / no org project selected → widgets look empty even when signed in. **Settings → Application → Load demo data** (signed-in only) writes a fake snapshot (tasks, pulse %, chat) and calls `WidgetCenter.reloadAllTimelines`. Demo is never auto-applied on refresh, and signed-out widgets never show demo or zero-inbox chrome.

`dueAt` is requested first (full schema); on GraphQL validation errors about unknown `dueAt`, the client **retries without `dueAt`** (same idea as Expo `isDueAtSchemaMismatchError`).

## Features

- Sign in (email/password; OTP accounts must finish OTP in mobile first)
- **Menu bar only** for interactive work: AppKit status item strip `Tasks · Chat · Projects [· Focus] · PT`; open popover is one scroll with the same section order
- **Desktop dashboard widget** + focused widgets (tasks, pulse, timer, quick add)
- Deep link **Open App** → `masterfabricexpo://`

## Where is the macOS widget feature?

There are **two** surfaces (no separate Dashboard app window):

| Surface | What it is | Code |
|---------|------------|------|
| **Menu bar** | Always-on icon + extended popover (all actions) | [`App/MenuBarRootView.swift`](App/MenuBarRootView.swift), [`App/MenuSections.swift`](App/MenuSections.swift) |
| **Desktop dashboard (always works)** | Menu bar → **Pin Desktop Dashboard** (floating window) | [`App/DesktopDashboardView.swift`](App/DesktopDashboardView.swift) |
| **Desktop / NC WidgetKit** | Edit Widgets gallery (needs signed `/Applications` install) | [`Widgets/`](Widgets/) → search **Project Tracker** |

**Widgets are not inside the menu bar.**

1. **Always works now:** menu bar → **Pin Desktop Dashboard** (floating overview window).
2. **Edit Widgets gallery:** Apple Development–signed install under `/Applications` (see below). DerivedData-only / ad-hoc launches stay invisible to `pluginkit`.

```bash
cd mf-macos && ./scripts/install-widgets.sh
# or: ./scripts/install-debug.sh
```

Requires a local **Apple Development** identity for team `4GW994398K` (MASTERFABRIC). Then:

1. Right-click **Desktop** → **Edit Widgets**, or click the **clock** → Notification Center → **Edit Widgets**
2. Search **`Project Tracker`** (also works: `pro`, `tracker`, `MF`)
3. Add **Project Tracker Dashboard** (Medium or Large) to the **Desktop** — drag from the gallery

Widget sources:

```
mf-macos/Widgets/
  MFTrackerWidgets.swift       # WidgetBundle
  TrackerDashboardWidget.swift # Desktop overview (tasks + pulse + timer)
  ChatNotificationsWidget.swift # Notification-style org chat feed
  TasksDueWidget.swift
  ProjectPulseWidget.swift
  FocusTimerWidget.swift
  QuickAddWidget.swift
```

## Requirements

- macOS 14+
- Xcode 15+ / XcodeGen (`brew install xcodegen`)
- Same stack as Expo: **mf-go** + **particular-project-tracker** registered for `project_tracker`

## Build & run

```bash
cd mf-macos
xcodegen generate
open MFProjectTracker.xcodeproj
# Scheme: MFProjectTracker → Run
```

Ad-hoc signed Debug (required for WidgetKit):

```bash
cd mf-macos && ./scripts/build-debug.sh
# For gallery discovery (recommended):
./scripts/install-debug.sh
```

`install-debug.sh` copies to `/Applications/MF Project Tracker.app`, ad-hoc codesigns, registers the appex with `pluginkit`, and launches the menu bar app.

## Add the Desktop dashboard widget

1. Run **`./scripts/install-debug.sh`** once (menu bar icon appears) and **Sign In** so snapshots refresh.
2. **Remove any old Project Tracker tiles** from the Desktop (stale chronod chrome), then right-click Desktop → **Edit Widgets** (or Notification Center → Edit Widgets).
3. Search **`Project Tracker`** (or `pro` / `tracker`).
4. Add **Project Tracker Dashboard** (Medium or Large) to the **Desktop** (click Add / drag — macOS does not auto-pin).
5. Optional: also add Project Tracker Tasks, Pulse, Focus, Quick Add, Notifications.
6. After menu bar **Refresh**, widgets update from the shared snapshot — Me / Proj / Chat / Done match the menu-bar strip (personal open · chat unread · project open).
7. **Signed out:** every widget shows a **Sign in** empty state (tap → `mfprojecttracker://login` opens the menu bar Sign In sheet). No zeros / “Inbox clear” / demo data while logged out.
8. If signed in but widgets stay empty: **Settings (gear) → Load demo data**, or create real todos / pick a project and Refresh.

| Widget | Source |
|--------|--------|
| **Project Tracker Dashboard** | Combined open tasks + project pulse + focus timer (Desktop overview) |
| **Project Tracker Notifications** | Notification-style org chat cards for Notification Center / Desktop |
| **Project Tracker Tasks** | Personal `myTodos` snapshot (core-base) |
| **Project Tracker Pulse** | Selected org project counts via Particular envelope |
| **Project Tracker Focus** | Local pomodoro linked to a selected personal/project task |
| **Project Tracker Quick Add** | App Intent → opens Tasks compose (Desktop-safe); Shortcuts can still `CreateTrackerTaskIntent` with a title |

## Configuration

Env must match Expo / `local.env` — **especially `EXPO_PUBLIC_MF_APP_API_KEY`**. Without the API key, Sign In and Particular hops fail against mf-go.

```bash
# From monorepo root (writes Configs/GeneratedEnv.xcconfig + seeds App Group):
npm run mf-macos:env
# or: ./mf-macos/scripts/sync-env.sh
# or: ./scripts/sync-desktop-env.sh --macos

cd mf-macos && ./scripts/install-debug.sh   # runs sync-env automatically
```

| Setting | Source / default |
|---------|------------------|
| GraphQL URL | `EXPO_PUBLIC_DEV_GRAPHQL_URL` → Info.plist `GRAPHQL_URL` / App Group (`http://127.0.0.1:8080/graphql`) |
| `X-Bundle-ID` | `EXPO_PUBLIC_MF_BUNDLE_ID` → `MF_CLIENT_BUNDLE_ID` (`com.masterfabric.monoExpo`) |
| `X-API-Key` | `EXPO_PUBLIC_MF_APP_API_KEY` → `MF_APP_API_KEY` (**required** for registered client) |
| Particular key | `EXPO_PUBLIC_MF_PROJECT_TRACKER_PARTICULAR` → `MF_PROJECT_TRACKER_PARTICULAR` (`project_tracker`) |

See [`mf-macos/.env.example`](.env.example). Override anytime in menu bar **Settings → Server**.

## Layout

```
mf-macos/
  MFTrackerKit/   # GraphQL + auth + App Support snapshots
  App/            # MenuBarExtra only (interactive)
  Widgets/        # WidgetKit for Desktop / NC
  Configs/        # Env.xcconfig + GeneratedEnv.xcconfig (gitignored)
  project.yml
```

## Notes

- OTP-required login is not in the Mac sheet yet.
- Focus timer is a local pomodoro linked to a selected personal/project task (no backend time tracking).
- Widgets do not call GraphQL themselves for display; keep the menu bar app signed in and refresh. Mutating intents (complete / create) use the same App Group GraphQL URL + shared Keychain session.
- Auth presence (`isAuthenticated` + short `userLabel`) is written into the App Group snapshot on login / logout / `persistSnapshot`. WidgetKit reads the same bytes as the menu bar.
- **Desktop interactivity (macOS 14+):** `widgetURL` alone is often ignored on Desktop — tiles use full-area `Button(intent:)` (`OpenLoginIntent` / `OpenTrackerDestinationIntent`) **plus** `widgetURL`, and the appex activates the host via App Group pending flag + distributed notification + `NSWorkspace.open(mfprojecttracker://…)`. Accessory app polls pending destinations.
- Verify while app is running: `open 'mfprojecttracker://login'` → menu bar popover + inline LoginView.
- Re-install after intent / layout / env changes: `./scripts/install-debug.sh` (widget build **1.0.11 / 11**). **Remove ALL old Desktop tiles**, then re-add from Edit Widgets so chronod drops archived chrome.
- After menu-bar Sign In, App Group `widgetAuthAuthenticated` must be `1` and widgets re-read via CFPreferences (warm UserDefaults caches are busted). Tap Sign in on a stale tile while already authed opens Tasks and forces a timeline reload.
