# mf-web — MasterFabric Tracker (web)

Linear-speed issue tracking for MasterFabric teams. Talks to the same **mf-go GraphQL** API as `mf-expo` and `mf-macos`, with org projects/todos via **`particularGraphqlEnvelope`** → particular-project-tracker.

![MasterFabric Tracker](public/og.png)

## Screenshots

| Login | List |
| --- | --- |
| ![Login](docs/screenshots/01-login.png) | ![List](docs/screenshots/02-list.png) |

| Board | Issue drawer |
| --- | --- |
| ![Board](docs/screenshots/03-board.png) | ![Drawer](docs/screenshots/04-drawer.png) |

Brand assets in `public/`:

- `tracker-mark.png` — favicon / sidebar / login mark
- `og.png` — Open Graph + login hero preview

## Features (v1)

- Email/password sign-in (OTP challenge when required)
- Organization + project switcher
- **List** and **Board** views (Open / Done; drag cards between columns)
- Issue detail drawer (title, status, subtasks, delete)
- Keyboard shortcuts: `C` new, `/` search, `1`/`2` views, `Esc` close, `?` help
- Session refresh (single-flight) so board/list mutations survive short-lived access tokens

## Setup

```bash
cd mf-web
cp .env.local.example .env.local
# NEXT_PUBLIC_GRAPHQL_URL=http://localhost:8080/graphql
# NEXT_PUBLIC_MF_BUNDLE_ID=com.masterfabric.monoExpo
# NEXT_PUBLIC_MF_API_KEY=   # optional; X-Bundle-ID alone works when allow_bundle_id_identity
# NEXT_PUBLIC_MF_PROJECT_TRACKER_PARTICULAR=project_tracker
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Start **core-base mf-go** and **particular-project-tracker** first.

## Stack

- Next.js 16 (App Router) + React 19 + Tailwind CSS 4
- Client-side GraphQL via `fetch` (Bearer token + `X-Bundle-ID` / optional `X-API-Key`)

## Notes

- Todo statuses in the API today are **OPEN** and **DONE** only — the board mirrors that.
- Create orgs / invite members from the mobile app if the web workspace has none yet.
