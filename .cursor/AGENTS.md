# MasterFabric Project Tracker — Agent Conventions

## Agentic document version

**`AGENTS_BASE_VERSION`:** `2.0.0` (semver for *this document’s* guidance, not the app release).

| Bump | When |
|------|------|
| **PATCH** | Typos, clarifications, same intent |
| **MINOR** | New non-breaking sections or workflows for agents |
| **MAJOR** | Removed or incompatible changes to required agent behavior |

When you change agent-facing rules here in a meaningful way, bump `AGENTS_BASE_VERSION` in the same commit and mention it in the PR if reviewers should re-read AGENTS.

---

## Git commit conventions (this repo)

History uses several complementary styles; pick one per commit and stay consistent within a PR.

### Which type? (quick)

1. **Single tracked issue is the headline** — reviewers will grep `GFG-XX` — use **Type 2**.
2. **Tiny, obvious slice** in one package and `feat`/`fix` would be ceremony without adding signal — use **Type 3**.
3. **Default** — normal or PR-sized work, multi-scope, or changelog/docs with a clear verb — use **Type 1**.

Keep one style per logical change set in a PR when you can (avoid alternating 2 vs 3 for the same story without reason). Merge commits and GitHub `Merge pull request #…` messages need no reformatting.

### Type 1 — Conventional Commits + scope(s)

`type(scope): imperative summary` with optional ticket and PR reference.

- **Types:** `feat`, `fix`, `docs`, `chore`, `refine`, …
- **Scopes:** `mf-expo`, `mf-web`, `mf-macos`, `changelog`, etc.

Examples from this repo:

- `feat(mf-expo): Profile Account + delete UX polish (GFG-35) (#38)`
- `fix(mf-expo): auth safe-area scroll (GFG-37)`
- `docs(changelog): note Particular hop for org projects`

### Type 2 — Ticket-first (`GFG-XX`)

Use when the work is driven by a single tracked issue:

- `feat(GFG-31): OTP-gated sign-in email change (#31)`
- `fix(GFG-23): block todos for inactive/suspended users`

### Type 3 — Short area prefix

Use for small, internal slices without a formal type prefix:

- `mf-expo(ios): fix Xcode search paths, align extension SDK, embed React`

**Reminder:** Type 1 = default; Type 2 = ticket IS the subject; Type 3 = smallest slices only.

---

## Project Overview

| Project | Path | Description |
|---------|------|-------------|
| **mf-expo** | `mf-expo/` | React Native + Expo mobile app (TypeScript) |
| **mf-web** | `mf-web/` | Next.js Linear-style tracker |
| **mf-macos** | `mf-macos/` | SwiftUI menu bar + widgets |

**Backend is not in this repo:**

| Sibling | Role |
|---------|------|
| **masterfabric-core-base** | `mf-go` GraphQL (auth, orgs, personal todos, Particular BFF hop) |
| **masterfabric-particulars** | `particular-project-tracker` (org projects / todos / purchases) |

Clients use GraphQL at `EXPO_PUBLIC_GRAPHQL_URL` / `EXPO_PUBLIC_DEV_GRAPHQL_URL` from repo-root `local.env` (default: `http://localhost:8080/graphql` on core-base mf-go).

## Quick Start

```bash
# Sibling: core-base
cd ../masterfabric-core-base/mf-go && make docker-infra && make run

# Sibling: particulars
cd ../masterfabric-particulars && ./scripts/setup-project-tracker.sh --start

# This repo
npm install && npm run start-all   # mf-expo only
```

## Structure

```
masterfabric-project-tracker/
├── mf-expo/          # app/, src/screens/, src/shared/, packages/masterfabric-expo-core/
├── mf-web/
├── mf-macos/
└── .cursor/          # rules/, commands/
```

## mf-expo

- **GraphQL**: `graphql-client.ts` — `graphqlRequest`, `setGraphQLAuthToken`, `clearGraphQLAuthToken`
- **API**: `mf-go-api.ts` — Auth, User, Settings; org projects via Particular envelope helpers
- **Store**: `useAppStore` + `mfGoSession`, `useMfGoAuthSync` for token sync
- **Toast**: `useToast()` — `success()`, `error()`, `warning()`, `info()`

## Cross-repo

1. Platform schema → **masterfabric-core-base** `mf-go` (`make generate` / ship checklist there)
2. Domain project API → **masterfabric-particulars** `particular-project-tracker`
3. In this repo: update `mf-go-api.ts` / envelope clients to match
4. When finishing **mf-expo** work that is user-visible, touches GraphQL usage, or belongs in release notes: update **both** `en.json` and `tr.json` for new copy and repo-root `CHANGELOG.md` (`mf-expo:` bullets) — see `.cursor/rules/mf-expo-ship-checklist.mdc`
5. **Pull requests:** keep scope coherent, describe verify steps, and link sibling backend PRs — see `.cursor/rules/pr-reviews.mdc` and `.cursor/rules/backend-ownership.mdc`

## MCP

Prefer **Context7** for docs, **Supabase** for Supabase, **GitLens** for git.
