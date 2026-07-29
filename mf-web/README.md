# mf-web — MasterFabric Tracker (web)

Linear-speed issue tracking for MasterFabric teams. Talks to the same **mf-go GraphQL** API as `mf-expo` and `mf-macos`, with org projects/todos/purchases via **`particularGraphqlEnvelope`** → particular-project-tracker.

![MasterFabric Tracker](public/og.png)

## Screenshots

| Login | List |
| --- | --- |
| ![Login](docs/screenshots/01-login.png) | ![List](docs/screenshots/02-list.png) |

| Board | Issue drawer |
| --- | --- |
| ![Board](docs/screenshots/03-board.png) | ![Drawer](docs/screenshots/04-drawer.png) |

Brand assets in `public/`: `tracker-mark.png`, `og.png`.

## Features (parity with mobile tracker)

- Email/password sign-in (OTP when required)
- Create organization + invite members; accept/decline pending invites
- Organization + project switcher; rename / delete project
- Project roster: add/remove members from org members
- **Issues** — list + board, status filters, **assignee filter**, search
- Create issue with **assignee + due**; drawer edits title / due / status / subtasks
- **Purchases** tab — create, status cycle, delete, product link (same validation ideas as mobile)
- **My todos** — personal mf-go todos with due + subtasks
- Keyboard shortcuts: `C` new, `/` search, `1`/`2` views, `Esc` close, `?` help
- Session refresh so mutations survive short-lived access tokens

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

- Project todo statuses are **OPEN** / **DONE** only; assignee is set at create time (Particular update API has no assignee field yet).
- Admin / org chat / notifications stay mobile-first for now.
