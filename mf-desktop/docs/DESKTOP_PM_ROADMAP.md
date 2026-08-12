# mf-desktop — Agile Project Management Roadmap

**Status:** Phase 0 + Phase 1 core **implemented** (boardColumn / SP / sprints / Linear nav). Later phases (time, GH sync, full burndown, integrations hub, MCP) still planned.  
**Date:** 2026-08-11 (updated 2026-08-11 implementation)  
**Primary surfaces:** `mf-desktop` · `packages/mf-tracker-client` · `particular-project-tracker` · mf-go (auth/orgs/personal/chat)  
**Sibling clients:** `mf-web`, `mf-expo` (parity noted; desktop leads Agile UX)

---

## 1. Vision

MasterFabric Project Tracker desktop (`mf-desktop`) should become the **operator’s primary Agile cockpit** for MasterFabric orgs: engineers, tech leads, and small ops teams who already live in org → project → issue workflows and want a keyboard-first, always-available Electron app that feels closer to Linear/Jira Desktop than a thin web wrapper. “Best desktop PM” here means: honest Agile process (backlog, sprints, story points, real board columns, time + reviews, reports), deep GitHub/task linkage, reliable tray/widget/offline habits, and — later — a clear **Integrations hub** plus optional **AI agent connectors** (not Cursor’s editor MCP). Brand stays MasterFabric: slate neutrals, Inter / existing tracker tokens (`packages/mf-tracker-ui`), shadcn primitives — no parallel chrome system.

---

## 2. Current state gaps

### Audit summary (today)

| Layer | What exists |
|-------|-------------|
| **mf-desktop shell** | `AppShell` + `Sidebar` tabs: Home (`dashboard`), Issues, My Work (`personal`), All projects, Team, Chat, Purchases, Settings. Org/project switchers. |
| **Issues** | List (`IssueList`), Board (`IssueBoard`), Timeline (`IssueTimeline`); filters (status, assignee, search); `IssueDrawer` + create dialog; shortcuts `c` `/` `1`/`2`/`3` `?`. |
| **Board truth** | UI columns To Do / In Progress / Done, but **status API is only `OPEN` \| `DONE`**. `stageOf()` maps: `DONE`→done, `assignedToUserId`→doing, else→todo. Drag to “In Progress” **assigns the current user** (`moveTodoToBoardStage` in `workspace.tsx`). |
| **Timeline** | Due-date buckets only — not Gantt / sprint calendar. |
| **Dashboard** | Snapshot pills, my issues, focus presets; no velocity/burndown. |
| **Projects / Team / Purchases** | CRUD via Particular; team = org members + project roster; purchases = REQUESTED/PURCHASED/CANCELLED. |
| **GitHub** | Client-side PAT + repo in prefs/`localStorage` (`github.ts`); per-todo PR/issue **links stored locally** — not synced to Particular/mf-go. |
| **Focus timer** | Local Pomodoro-style timer (`focus-timer.tsx`) — **not** billable/time-entry tracking. |
| **Desktop-native** | Tray, hide-to-tray, floating `#/dashboard-widget`, `safeStorage` session, GraphQL URL override, electron-updater. Offline = setup empty state only (no todo cache). |
| **Auth / org** | mf-go: login/OTP, orgs, invitations, members, personal todos, `organizationMessages` chat. |

### Gap table

| Area | Today | Gap | Backend ready? |
|------|-------|-----|----------------|
| Issue status / board columns | `OPEN`/`DONE` only; board fakes Doing via assignee | Real workflow: Todo / Doing / Review / Done (configurable) | **No** — Particular enum + column field |
| Story points / estimate | None on `OrganizationProjectTodo` | SP field, estimation UI, sprint capacity | **No** |
| Sprints / iterations | None | Sprint entity, backlog ↔ sprint, start/complete | **No** |
| Issue body / description | Title (+ subtasks) only | Markdown description, acceptance notes | **No** |
| Priority / labels | Urgency derived client-side from due date | Stored priority + labels | **No** |
| Time tracking | Focus timer local only | Work logs (minutes), estimates vs actual | **No** |
| Reviews / PR process | GitHub links local; no Review column | Review stage + linked PR status sync | Partial — GH client exists; **no** server link/store |
| Reports | Dashboard counts only | Burndown, velocity, cycle time, workload | **No** |
| Backlog vs board | Single Issues tab | Explicit Backlog + Board + Sprint views | UI-only until sprint API |
| Integrations hub | Settings → GitHub prefs; mf-go `AppIntegration` = OAuth (github/google/auth0) for **apps** | Org-level PM connectors (GitHub deep, Slack, calendar, Jira import) | Partial — OAuth types ≠ PM hub |
| MCP / AI agents | Not in mf-desktop; **Agent LLM Studio** Particular has MCP proxy (`studioMcpHealth` / `studioMcpTools`) | Product “agent connectors” UI — separate from Cursor MCP | Partial — `particular-llm-studio` only |
| Offline | Unreachable API gate | Read cache + optimistic queue | **No** |
| Comments / activity | Org chat only; no per-issue comments | Issue comments + history | **No** |
| Cross-client Agile | mf-web ≈ board heuristic; mf-expo list/mobile, no SP/sprints | Shared `mf-tracker-client` types after schema | N/A |

**Honest constraint:** Do not ship UI that pretends OPEN/DONE is a four-column Agile board. The current board is a **UX heuristic** until Phase 0 lands a real workflow field.

---

## 3. Agile process model

### Proposed model (Scrum-lite / Linear-flavored)

```
Backlog (unscheduled OPEN work)
    ↓ plan into
Sprint / Iteration (time-boxed; capacity in SP)
    ↓ work on
Board: Todo → Doing → Review → Done
    ↓ measure
Velocity (SP/sprint) · Burndown · Cycle time
    ↓ improve
Retro notes (v1: markdown per sprint; later: structured)
```

| Concept | v1 (Phases 0–1) | Later (Phases 2–3+) |
|---------|-----------------|---------------------|
| **Backlog** | Project issues with `sprintId = null`, ordered by `rank` | Cross-project org backlog, swimlanes |
| **Sprints** | Named iteration, `startsAt`/`endsAt`, `ACTIVE`/`CLOSED`, goal | Multiple concurrent; program increments |
| **Story points** | Integer `storyPoints` on todo (Fibonacci UI optional) | Planning poker / async estimate |
| **Estimation** | SP required to pull into sprint (soft warning OK) | Time estimate hours alongside SP |
| **Board columns** | Fixed enum: `TODO` \| `DOING` \| `REVIEW` \| `DONE` (+ keep completion `status` or derive DONE from column) | Custom columns / WIP limits |
| **Burndown / velocity** | Compute from sprint SP + DONE timestamps | Forecast, CFD |
| **Retrospectives** | Sprint `retroNotes` markdown | Facilitation templates, action items → backlog |

### Status model recommendation (Phase 0)

Prefer **one workflow field** rather than overloading assignee:

- Add `boardColumn: OrganizationProjectTodoBoardColumn` (`TODO` \| `DOING` \| `REVIEW` \| `DONE`).
- Keep or map `status: OPEN \| DONE` for backward compatibility (`DONE` ⇔ `boardColumn == DONE`).
- Migration: existing rows → `DONE` if status done, else `DOING` if assigned, else `TODO`.
- Deprecate board heuristic in `issue-board.tsx` / `stageOf` once clients read `boardColumn`.

---

## 4. Information architecture

### Desktop nav (target)

```
Work
├── Home                 — ops snapshot, sprint pulse, focus, due soon
├── Backlog              — unscheduled + rank; plan into sprint
├── Board                — active sprint (or “all open”) kanban
├── Sprints              — list / current / complete / retro
├── My Work              — personal todos (mf-go) + assigned project issues
├── Reports              — burndown, velocity, workload, time
More
├── Projects             — roster, description, Agile settings
├── Team                 — org members, invites, project membership
├── Chat                 — organizationMessages (unchanged v1)
├── Purchases            — existing Particular purchases
├── Integrations         — GitHub, Slack, calendar, imports; agent connectors entry
└── Settings             — account, GraphQL, tray, focus, updates
```

Map from today’s `WorkspaceTab` (`packages/mf-tracker-client/src/types.ts`):

| Today | Target |
|-------|--------|
| `dashboard` | Home (enriched) |
| `issues` (list/board/timeline) | Split: **Backlog** + **Board**; Timeline → Reports or Board sub-view |
| `personal` | My Work |
| `projects` / `team` / `chat` / `purchases` / `settings` | Keep; add `sprints`, `reports`, `integrations` |

### Primary screens (desktop)

| Screen | Job | Key components (evolve) |
|--------|-----|-------------------------|
| Home | “What needs me today?” | `dashboard-panel.tsx` + sprint strip + SP remaining |
| Backlog | Prioritize & estimate | New panel; drag-rank; SP edit; “Add to sprint” |
| Board | Execute active sprint | `issue-board.tsx` → 4 columns from `boardColumn` |
| Issue drawer | Full issue | `issue-drawer.tsx` + description, SP, sprint, time, GH, review |
| Sprints | Plan / close | New `sprints-panel.tsx` |
| Reports | Inspect | New `reports-panel.tsx` (charts) |
| Integrations | Connect | New hub; migrate `github-panel.tsx` |
| Settings | Desktop prefs | `settings-panel.tsx` (tray, widget, offline) |

---

## 5. Feature roadmap phases

| Phase | Theme | Outcome |
|-------|-------|---------|
| **0** | Foundation | Schema/API for workflow, SP, sprints, description; client types; no fake columns |
| **1** | Agile core | Backlog + Board + Sprints UI; estimation; planning |
| **2** | Time + reviews | Work logs; Review column discipline; GH link sync |
| **3** | Reports | Burndown, velocity, workload, export |
| **4** | Integrations hub | GitHub deep, Slack, calendar; optional Jira import |
| **5** | MCP / agent connectors | Managed AI tooling via LLM Studio Particular — **not** Cursor MCP |

---

## 6. Per-phase detail

### Phase 0 — Foundation (schema / API)

**Goal:** Backend can express real Agile work without UI lies.

#### User stories

- As a client, I can set a todo’s board column independently of assignee.
- As a client, I can set story points and a markdown description.
- As a PM, I can create a sprint and attach todos to it.
- As an existing app, OPEN/DONE still works (compat mapping).

#### API / schema changes

**Owner: `particular-project-tracker`** (`store.go`, `graphql.go`, `GRAPHQL_API.md`, `capabilities.go`)

| Change | Detail |
|--------|--------|
| `organization_project_todos` columns | `board_column TEXT`, `story_points INTEGER NULL`, `description TEXT DEFAULT ''`, `sprint_id TEXT NULL`, `rank REAL` (or string rank key) |
| New table `organization_project_sprints` | `id`, `project_id`, `name`, `goal`, `starts_at`, `ends_at`, `status` (`PLANNED`/`ACTIVE`/`CLOSED`), `retro_notes`, timestamps |
| Enum | `OrganizationProjectTodoBoardColumn`: `TODO`, `DOING`, `REVIEW`, `DONE` |
| Enum | `OrganizationProjectSprintStatus` |
| Mutations | `create/update/deleteOrganizationProjectSprint`; `updateOrganizationProjectTodo` gains `boardColumn`, `storyPoints`, `clearStoryPoints`, `description`, `sprintId`, `clearSprintId`, `rank`; optional `reorderOrganizationProjectTodos` |
| Queries | `organizationProjectSprints(projectId)`; todos include new fields |
| Capabilities | Reuse `project.tracker.todos.*` / `projects.*`; add `project.tracker.sprints.read/write` if granular |
| Migration | SQLite `migrate()` ALTERs + backfill board_column from status/assignee |

**mf-go:** No new platform schema required for Phase 0 (hop remains `particularGraphqlEnvelope` + `project.tracker.graphql`). Optional: document in Postman Particular folder when envelope examples need new fields.

**Client:** `packages/mf-tracker-client` (`types.ts`, `api.ts`) — extend `Todo`, add `Sprint`, update mutations. Then mf-desktop / mf-web / mf-expo.

#### Desktop UI work

- Minimal: stop inventing Doing-from-assignee once API ships; show SP/sprint chips if present.
- Prefer **not** building full Backlog/Sprints screens until Phase 1 (avoid half-wired UI).

#### Acceptance criteria

- [ ] GRAPHQL_API.md documents sprints + new todo fields.
- [ ] Existing OPEN todos without assignee → `TODO`; assigned → `DOING`; DONE → `DONE`.
- [ ] `mf-tracker-client` compiles against new fields; old clients ignoring new fields still work.
- [ ] Board DnD writes `boardColumn`, not only assignee.

#### Dependencies / order

1. Particular migrate + GraphQL  
2. Register/restart Particular; smoke via envelope  
3. `mf-tracker-client`  
4. Desktop board mapper switch  
5. Then Phase 1 UI

---

### Phase 1 — Agile core

**Goal:** Day-to-day Scrum-lite in the desktop app.

#### User stories

- As a lead, I plan a sprint from the backlog with SP and capacity.
- As a developer, I move cards Todo → Doing → Review → Done on the active sprint board.
- As a team, we see sprint goal and days remaining on Home.
- As a user, I estimate SP on create/edit.

#### API / schema

- Stabilize Phase 0; add `completeOrganizationProjectSprint` (sets CLOSED, freezes membership of todos).
- Optional: `priority` enum (`NONE`/`LOW`/`MEDIUM`/`HIGH`) if backlog sorting needs it — else use `rank` only.

#### Desktop UI

| Work | Files / notes |
|------|----------------|
| Nav IA | `sidebar.tsx`, `WorkspaceTab` in mf-tracker-client |
| Backlog panel | New; rank + “Move to sprint” |
| Board | `issue-board.tsx` — 4 columns; filter `sprintId == active` |
| Sprints panel | Create/start/complete; goal; SP sum vs capacity |
| Issue drawer | SP, sprint select, description editor |
| Home | Active sprint pulse (committed SP, remaining, overdue) |
| Create issue | Optional SP + sprint |

#### Acceptance criteria

- [ ] Creating a sprint and assigning 5 estimated issues works end-to-end through Particular.
- [ ] Board never uses assignee-as-column heuristic.
- [ ] Completing a sprint keeps historical `sprintId` on todos for velocity later.
- [ ] Keyboard shortcuts still work on Board (`c`, `/`, view toggles adjusted).

#### Dependencies

Phase 0 merged; shared client published/linked; mf-web can lag one release behind desktop.

---

### Phase 2 — Time tracking + reviews

**Goal:** Replace “focus toy” as the only time concept; make Review a real gate.

#### User stories

- As a developer, I log time against an issue (manual entry + optional “start/stop” timer that **persists**).
- As a reviewer, work sits in Review until I move it to Done.
- As a developer, GitHub PR links sync to the server and show CI/review state on the card.

#### API / schema (Particular)

| Entity | Fields |
|--------|--------|
| `organization_project_todo_time_entries` | `id`, `todo_id`, `user_id`, `started_at`, `ended_at`, `minutes`, `note` |
| Mutations | `create/update/deleteOrganizationProjectTodoTimeEntry` |
| Todo fields | `estimateMinutes` optional; aggregated `loggedMinutes` (resolver or client sum) |
| GitHub links | `organization_project_todo_external_links` (`provider`, `kind`, `external_id`, `url`, `title`, `status`, `meta_json`) — migrate off desktop `localStorage` |

**mf-go:** Optional later — store GitHub OAuth **user** tokens; v1 can keep PAT in desktop prefs but **links** must be server-side.

#### Desktop UI

- Time section in `issue-drawer.tsx`; running timer writes entries (upgrade `focus-timer.tsx` or replace).
- Board: Review column highlighted; optional “needs review” filter.
- `issue-github-section.tsx`: read/write server links; poll PR state when PAT present.
- Settings: clarify Focus (Pomodoro) vs Time tracking (logged work).

#### Acceptance criteria

- [ ] Time entries survive restart and appear on other clients after client updates.
- [ ] Moving to Done from Review is explicit (no auto-skip).
- [ ] GitHub links created on desktop visible after reinstall (server-backed).

#### Dependencies

Phase 1 board columns (especially `REVIEW`); GH prefs already in `electron/main.ts` Prefs.

---

### Phase 3 — Reports & analytics

**Goal:** Operators trust the app for sprint reviews without exporting to sheets.

#### User stories

- As a lead, I open Reports and see burndown for the active sprint.
- As a lead, I see velocity for the last N closed sprints.
- As a manager, I see workload (open SP / logged hours by assignee).
- As an ops user, I export CSV for a sprint.

#### API / schema

Prefer **client-computed v1** from existing sprint + todo + time data to avoid premature analytics service.

Optional Particular aggregates later:

- `organizationProjectSprintReport(sprintId) { committedPoints, completedPoints, burndownPointsJson, … }`

#### Desktop UI

- New `reports-panel.tsx`: burndown chart, velocity bar, cycle time (createdAt → entered DONE), assignee load.
- Home widgets deep-link into Reports.
- Timeline view: either retire or redefine as “deadline report”.

#### Acceptance criteria

- [ ] Burndown matches manual SP math for a fixture sprint.
- [ ] Closed sprints remain reportable.
- [ ] Empty states when no ACTIVE sprint (no fake charts).

#### Dependencies

Phases 0–2 data richness; chart lib choice consistent with slate UI (lightweight).

---

### Phase 4 — Integrations hub

**Goal:** One place for PM connectors — distinct from mf-go **app OAuth** (`AppIntegration`: `github` / `google_signin` / `auth0` for client login).

#### Clarify two concepts

| Concept | Meaning | Exists? |
|---------|---------|---------|
| **mf-go App integrations** | OAuth credentials per **client app** (sign-in with GitHub, etc.) | Yes — admin/Core |
| **PM Integrations hub** (this phase) | Org/project connectors for **work**: GitHub repo binding, Slack notify, calendar, Jira import | Partial — desktop GH prefs only |
| **Cursor MCP** | Editor tool servers for AI coding agents | **Out of product scope** as “MCP management” |
| **Agent connectors / Studio MCP** | LLM Studio Particular proxies (`llm.studio.mcp`) | Phase 5 |

#### User stories

- As an admin, I bind `owner/repo` at **project** level (not only local prefs).
- As a user, I get Slack/desktop notification when assigned or moved to Review.
- As a migrator, I import issues from Jira CSV/API into a project.
- As a user, due dates optionally sync to a calendar feed.

#### API / schema

- Particular: `organization_project_integrations` (`provider`, `config_json`, `status`) for `github`, `slack`, `jira`, `calendar`.
- Or mf-go org-level secrets if tokens must not live in Particular SQLite — decide per provider (prefer Particular for project-scoped; mf-go for org OAuth apps).

#### Desktop UI

- New Integrations tab; migrate `GithubRepoSettings` from Settings.
- Connection cards (shadcn `Card` for **interaction** containers only).
- Deep-link to Core for app-level GitHub OAuth when needed (`VITE_MF_CORE_URL`).

#### Acceptance criteria

- [ ] Project GitHub binding works on a fresh machine without re-entering local-only repo if server config exists.
- [ ] Jira import creates Particular todos with titles/due/assignee best-effort; documents SP mapping.
- [ ] Hub copy never claims Cursor MCP management.

#### Dependencies

Phase 2 external links table; privacy review for tokens in Particular vs mf-go.

---

### Phase 5 — MCP / AI agent management

**Goal:** Optional power-user surface for **MasterFabric Agent LLM Studio** connectors — carefully named so it is not confused with Cursor IDE MCP.

#### Definition (product)

- **In scope:** Configure/monitor MCP **servers that Studio agents use** (health, tools list, presets) via `particular-llm-studio` GraphQL (`studioMcpHealth`, `studioMcpTools`, `studioCatalogMcpPresets`, config section `mcp`), capability `llm.studio.mcp`.
- **Out of scope:** Managing the user’s Cursor `mcp.json` / IDE plugins.
- **Desktop role:** “Agent connectors” under Integrations — launch Studio config, show health, link agents to tracker projects (metadata only until product decides write-back).

#### User stories

- As an org admin, I see whether Studio MCP endpoints are healthy for my org.
- As a lead, I attach an agent profile to a project for “summarize sprint” later.
- As a user, I never see Cursor-specific MCP terminology.

#### API / schema

- Reuse **particular-llm-studio** (service_kind `org_llm_studio`); do **not** fork MCP into project-tracker.
- Optional bridge: project-tracker stores `agentStudioProjectId` reference only.

#### Desktop UI

- Integrations → Agent connectors (feature-flagged; requires org grant `llm.studio.*`).
- Read-only health + link out to Studio UI if full config is heavy.

#### Acceptance criteria

- [ ] Feature hidden without Particular grant.
- [ ] Docs/UI say “Agent connectors (LLM Studio)”, not “Cursor MCP”.
- [ ] No regression for users who only want classic PM.

#### Dependencies

Phase 4 hub shell; LLM Studio deployed/registered like other Particulars (`port-registry` / `dev-reference-stacks`).

---

## 7. Desktop-native differentiators

Align with **in-flight** Electron work; treat as incomplete until verified.

| Differentiator | Today | Target |
|----------------|-------|--------|
| **Shortcuts** | Issues: `c` create, `/` search, `1/2/3` views, `?` help (`app-shell.tsx`, `shortcuts-help.tsx`) | Global command palette; sprint plan shortcuts; board column keys |
| **Tray** | Show / Pin Dashboard / Quit (`electron/main.ts`) | Tray menu: active sprint SP remaining, start/stop timer, quick capture issue |
| **Dashboard widget** | `#/dashboard-widget` always-on-top window | Sprint burndown mini + due-today; click → main window route |
| **Offline cache** | Unreachable empty state (`workspace-setup.tsx`) | IndexedDB/SQLite cache of projects/todos; queue mutations; conflict toast |
| **Notifications** | None native | OS notifications on assignment, Review, due soon (Electron `Notification`) |
| **Multi-window** | Main + dashboard widget | Optional issue pop-out window |
| **Session security** | `safeStorage` encrypted session | Keep; never put PATs in renderer logs |
| **Focus vs time** | Local focus presets | Focus stays local UX; logged time is server (Phase 2) |
| **Updates** | `electron-updater` | Channel notes mention Agile schema min Particular version |

Brand: slate + Inter / `mf-tracker-ui` tokens; no neon/custom card systems (see `ui-shadcn-preference`).

---

## 8. Out of scope / won’t fake

Do **not** ship UI-only versions of:

| Feature | Why blocked |
|---------|-------------|
| Real In Progress / Review columns | Needs `boardColumn` (or equivalent) in Particular |
| Story points & capacity | Needs `storyPoints` + sprint entity |
| Burndown / velocity | Needs sprints + SP + completion timestamps |
| Server time tracking | Needs time entry table; focus timer ≠ time tracking |
| Synced GitHub links / Jira import | Needs external_links / import API |
| Org-wide MCP control plane in tracker | Wrong Particular; use LLM Studio |
| Per-issue comments / audit trail | No activity API yet — schedule after Phase 1 if needed |
| Custom workflows / enterprise Jira parity | Explicitly later; v1 fixed columns |
| Replacing mf-go auth/orgs with a desktop-local backend | Forbidden — extend Particular + mf-go only |

If a demo needs columns before Phase 0: label the board **“Preview (assignee heuristic)”** — never call it Agile workflow.

---

## 9. Success metrics

| Metric | Signal we’re “best” for MasterFabric |
|--------|--------------------------------------|
| **Process honesty** | 0% of board moves rely on assignee heuristic after Phase 1 |
| **Sprint adoption** | ≥70% of active desktop orgs create ≥1 ACTIVE sprint / month (telemetry opt-in later) |
| **Estimation coverage** | ≥60% of sprint-committed issues have SP |
| **Review discipline** | Median time in `REVIEW` measurable; PRs linked on ≥40% of Review cards (Phase 2+) |
| **Desktop stickiness** | Weekly active days; tray/widget open rate; shortcut usage |
| **Cross-client trust** | Same sprint/SP visible on mf-web/mf-expo within one release of desktop |
| **Support load** | Drop in “board lost my In Progress” confusion tickets |
| **Qualitative** | Operators prefer desktop over sheets/Jira for day-to-day MasterFabric delivery |

---

## 10. Immediate next 2 weeks

Prioritized from **real APIs** — Particular first, then client, then desktop IA.

### Week 1 — Phase 0 backend

1. **Design freeze** (½ day): confirm `boardColumn` + `OPEN`/`DONE` mapping; sprint fields; SP nullable.
2. **`particular-project-tracker`**
   - Extend `store.go` migrate + models (`Todo`, new `Sprint`).
   - Extend `graphql.go` types/inputs/resolvers.
   - Update `GRAPHQL_API.md` + capabilities if split.
3. **Manual envelope smoke** via mf-go `particularGraphqlEnvelope` (`particularKey: project_tracker`, capability `project.tracker.graphql`): create sprint, set SP, set `boardColumn` to `REVIEW`.
4. **Backfill** existing DBs; document upgrade for local Docker/scripts (`scripts/start-*` / register scripts as applicable).

### Week 2 — Client + honest board

1. **`packages/mf-tracker-client`**: types + `api.updateOrganizationProjectTodo` / sprint CRUD helpers.
2. **`mf-desktop` `issue-board.tsx` + `workspace.tsx` `moveTodoToBoardStage`**: persist `boardColumn`; 4th column Review; remove assignee heuristic (keep auto-assign as **optional** side effect when entering DOING, not as column definition).
3. **Issue drawer**: show/edit SP + sprint (basic selects).
4. **Changelog** (project-tracker root) + Particular README note; **no** fake Reports yet.
5. **Parity note** for mf-web/mf-expo: follow-up PRs after desktop proves the mapper.
6. **Linear** (optional): file child issues under MasterFabric Project Tracker / Core Base backlog for Phases 1–2.

### Explicit non-goals for these 2 weeks

- Burndown charts, Jira import, Slack, LLM Studio MCP UI, offline sync, custom columns.

---

## Appendix A — Key file map

| Path | Role |
|------|------|
| `mf-desktop/src/App.tsx` | Routes: `/app`, `/login`, `/dashboard-widget` |
| `mf-desktop/src/components/app-shell.tsx` | Shell, shortcuts, view modes |
| `mf-desktop/src/components/sidebar.tsx` | Nav IA |
| `mf-desktop/src/components/issue-board.tsx` | Kanban + heuristic `stageOf` |
| `mf-desktop/src/lib/workspace.tsx` | `moveTodoToBoardStage`, data load |
| `mf-desktop/src/lib/github.ts` | Local GH prefs + todo links |
| `mf-desktop/src/lib/focus-timer.tsx` | Local focus only |
| `mf-desktop/electron/main.ts` | Tray, widget, prefs, session |
| `packages/mf-tracker-client/src/types.ts` | `TodoStatus = "OPEN" \| "DONE"` |
| `packages/mf-tracker-client/src/api.ts` | Envelope to Particular |
| `particular-project-tracker/store.go` | SQLite schema |
| `particular-project-tracker/graphql.go` | Inner GraphQL |
| `particular-project-tracker/GRAPHQL_API.md` | Operator API doc |
| `particular-llm-studio/GRAPHQL_API.md` | Studio MCP proxies (Phase 5) |
| mf-go `particular.graphqls` | `particularGraphqlEnvelope` hop |
| mf-go `AppIntegration` | App OAuth — not PM hub |

## Appendix B — Sibling parity

| Capability | mf-desktop | mf-web | mf-expo |
|------------|------------|--------|---------|
| List / filters / drawer | Yes | Yes | Yes (mobile patterns) |
| Board heuristic | Yes | Yes | No full board |
| Timeline by due | Yes | Yes | No |
| GitHub task links | Yes (local) | No | No |
| Focus timer / tray / widget | Yes | No | No (reminders elsewhere) |
| SP / sprints / reports | No | No | No |

**Rule:** Schema lands in Particular once; `mf-tracker-client` is the shared contract; desktop leads Agile UX; web/expo follow without inventing parallel fields.

## Appendix C — MCP glossary (for stakeholders)

| Term | Use in product? |
|------|-----------------|
| **Cursor MCP** | No — developer tooling for Cursor IDE |
| **Integrations hub** | Yes — GitHub/Slack/Jira/calendar for PM |
| **Agent connectors / Studio MCP** | Yes (Phase 5) — LLM Studio `llm.studio.mcp` health/tools/config |
| **mf-go AppIntegration** | Adjacent — client app OAuth, configured in Core |

---

*End of plan. Implementation should proceed phase-ordered: Particular schema → mf-tracker-client → mf-desktop → mf-web/mf-expo.*
