# MasterFabric Monorepo — Agent Conventions

## Agentic document version

**`AGENTS_BASE_VERSION`:** `1.0.1` (semver for *this document’s* guidance, not the app release).

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
- **Scopes:** `mf-expo`, `mf-go`, `mf-expo,mf-go`, `feedback`, `changelog`, etc.

Examples from this repo:

- `feat(mf-expo): Profile Account + delete UX polish (GFG-35) (#38)`
- `fix(mf-expo,mf-go): auth safe-area scroll + revoke sessions on role change (GFG-37) (#39)`
- `docs(changelog): mf-go password history foundation (GFG-33)`

### Type 2 — Ticket-first (`GFG-XX`)

Use when the work is driven by a single tracked issue:

- `feat(GFG-31): OTP-gated sign-in email change (#31)`
- `fix(GFG-23): block todos for inactive/suspended users`

### Type 3 — Short area prefix

Use for small, internal slices without a formal type prefix:

- `mf-go: Redis cache for appSettings, productRelease, user settings (#28)`
- `mf-expo(ios): fix Xcode search paths, align extension SDK, embed React`

**Reminder:** Type 1 = default; Type 2 = ticket IS the subject; Type 3 = smallest slices only.

---

## Project Overview

| Project | Path | Description |
|---------|------|-------------|
| **mf-expo** | `mf-expo/` | React Native + Expo mobile app (TypeScript) |
| **mf-go** | `mf-go/` | Go GraphQL backend (Auth, User, Settings, Admin) |

**mf-expo** consumes **mf-go** via GraphQL at `EXPO_PUBLIC_GRAPHQL_URL` from repo-root `local.env` (default: `http://localhost:8080/graphql`).

## Quick Start

```bash
cd mf-go && make docker-infra && make run
cd mf-expo && npm install && npm start
```

## Structure

```
masterfabric-expo-base/
├── mf-expo/          # app/, src/screens/, src/shared/, packages/masterfabric-expo-core/
├── mf-go/            # cmd/, internal/{domain,application,infrastructure}, sdk/
└── .cursor/          # rules/, commands/
```

## mf-go Layers

```
GraphQL resolvers → Application (use cases) → Domain (entities) ← Infrastructure (Postgres, Redis)
```

- **Schema**: `internal/infrastructure/graphql/schema/` — source of truth
- **Use cases**: `internal/application/` — `Execute(ctx, req) → (resp, error)`
- **SDK**: `sdk/` — generated, do not edit by hand. After schema changes: `make generate-all`

## mf-expo

- **GraphQL**: `graphql-client.ts` — `graphqlRequest`, `setGraphQLAuthToken`, `clearGraphQLAuthToken`
- **API**: `mf-go-api.ts` — Auth, User, Settings
- **Store**: `useAppStore` + `mfGoSession`, `useMfGoAuthSync` for token sync
- **Toast**: `useToast()` — `success()`, `error()`, `warning()`, `info()`

## Cross-Project

1. Add schema in mf-go → `make generate-all`
2. In mf-expo: add to `mf-go-api.ts` or use `graphqlRequest` directly
3. When finishing **mf-go** work that changes the API or env contract: update **only** `mf-go/postman/masterfabric.collection.json` and `mf-go/postman/masterfabric.environment.json` (single collection + single env — no extra Postman collection files) and repo-root `CHANGELOG.md` — see `.cursor/rules/mf-go-ship-checklist.mdc`
4. When finishing **mf-expo** work that is user-visible, touches GraphQL usage, or belongs in release notes: update **both** `en.json` and `tr.json` for new copy and repo-root `CHANGELOG.md` (`mf-expo:` bullets) — see `.cursor/rules/mf-expo-ship-checklist.mdc`
5. **Pull requests:** keep scope coherent, describe verify steps, and link paired backend/frontend changes — see `.cursor/rules/pr-reviews.mdc`

## MCP

Prefer **Context7** for docs, **Supabase** for Supabase, **GitLens** for git.
