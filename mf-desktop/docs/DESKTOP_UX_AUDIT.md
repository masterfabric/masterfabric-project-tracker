# mf-desktop — UI/UX audit & fix backlog

**Date:** 2026-08-12  
**App version reviewed:** 0.3.3  
**Method:** Live Playwright pass on auth (`http://127.0.0.1:5173/#/login`) + computed styles + code review of shell / issues / settings / primitives.  
**Gap:** Authenticated Home / Board / Settings not re-captured with a live session in this pass (credential autofill blocked in harness). Round 2 after human sign-in.

Canvas companion: Cursor canvas `mf-desktop-ux-audit`.

---

## Severity legend

| Sev | Meaning |
|-----|---------|
| **P0** | Blocks trust / basic use — fix in first wave |
| **P1** | Clear UX defect or inconsistency — next wave |
| **P2** | Polish / consistency — later |

---

## Findings (one by one)

### AUTH-01 — P0 — No password visibility toggle
- **Where:** Sign in / Sign up (`login-form.tsx`)
- **Problem:** Password is `type="password"` only; no show/hide control.
- **Need:** Shared `PasswordField` (InputGroup + Eye/EyeOff), aria-pressed, works while disabled=false.

### AUTH-02 — P0 — Active Sign in / Sign up tab still hard to see
- **Where:** Auth tabs
- **Evidence:** Active tab background `rgb(250,250,250)` on white panel; inactive transparent. Contrast remaining after `data-active` fix is still weak.
- **Need:** Darker TabsList track (`#e2e8f0` / muted) + solid white active pill + full ink text; or underline “line” variant.

### AUTH-03 — P1 — Idle text fields still too subtle
- **Where:** Auth inputs (also global Input)
- **Evidence:** After 0.3.3: border `#cbd5e1` 1px, fill `#f8fafc`, height 44px — better than transparent/white, still reported as hard to see.
- **Need:** Stronger idle stroke (`#94a3b8` or 1.5–2px), keep filled ash; focus ring already slate.

### AUTH-04 — P1 — GraphQL URL on auth hero
- **Where:** `.mf-auth-hero-meta` → `graphqlUrl()`
- **Problem:** Looks like product chrome / debug leak.
- **Need:** `import.meta.env.DEV` only, or Settings-only.

### AUTH-05 — P1 — Duplicate mode switching
- **Where:** Tabs + footer “Create an account” / “Sign in”
- **Need:** One primary control (tabs); footer secondary or remove.

### AUTH-06 — P2 — No forgot-password
- **Need:** Wire mf-go reset/OTP flow or omit until ready.

### AUTH-07 — P2 — Form vertical rhythm
- **Need:** Larger label→field gap; balance empty space in tall auth panel.

### SET-01 — P0 — GitHub PAT no show/hide
- **Where:** `github-panel.tsx` Settings GitHub token
- **Need:** Same PasswordField pattern.

### INP-01 — P1 — InputGroup unused for secrets
- **Where:** `ui/input-group.tsx` exists; auth/settings don’t use it
- **Need:** One PasswordField primitive reused everywhere.

### INP-02 — P1 — Global `--input` still light
- **Where:** `mf-tracker-ui/tokens.css`
- **Need:** Product decision: stronger default border token vs auth-only override.

### SHELL-01 — P1 — Double toolbar density
- **Where:** `app-shell.tsx` h-12 header + h-9 filter strip
- **Need:** Collapse/merge filters; readable breadcrumbs (≥12px).

### SHELL-02 — P1 — Tiny kbd / avatar type
- **Evidence:** `text-[9px]` kbd and avatar fallbacks
- **Need:** ≥11px; hit targets ≥32px.

### SHELL-03 — P2 — Sidebar active ≠ auth active language
- **Need:** One “selected” visual system (slate fill vs soft pill).

### ISS-01 — P1 — List stage vs board column mismatch
- **Where:** `issue-row` `stageLabel` uses assignee heuristic; board uses `boardColumn`
- **Need:** Single source of truth = `boardColumn`.

### ISS-02 — P2 — Dense issue meta alignment
- **Need:** Column/grid rules so due/avatar/GH don’t jump.

### EMPTY-01 — P2 — Empty-state art still teal-heavy
- **Where:** `ops-illustrations.tsx` vs new slate auth art
- **Need:** Align palette.

### A11Y-01 — P1 — Icon-only header actions
- **Need:** Consistent `aria-label` + Tooltip on every icon button.

### A11Y-02 — P2 — Autofill noise
- **Need:** Verify Electron vs OS autofill; keep autocomplete attrs correct.

### TEST-01 — P1 — Authenticated surfaces not live-audited this round
- **Need:** After sign-in: screenshot Home, Backlog, Board, Sprints, Settings, Create issue, Issue drawer → append Round 2 section.

---

## Proposed fix plan (for agreement — do not start until confirmed)

### Wave A — Auth & secrets (recommended first)
1. AUTH-01 + SET-01 + INP-01 → PasswordField  
2. AUTH-02 → tab contrast  
3. AUTH-03 (+ optional INP-02) → stronger idle fields  
4. AUTH-04 → hide GraphQL URL outside DEV  

### Wave B — Shell & form chrome
1. SHELL-01 / SHELL-02 / A11Y-01  
2. AUTH-05 / AUTH-07  

### Wave C — Product consistency
1. ISS-01 / ISS-02  
2. EMPTY-01 / SHELL-03  
3. AUTH-06 if API ready  

### Wave D — Round 2 live audit
1. TEST-01 screenshots + new findings  

---

## Out of scope for Wave A
- Full visual redesign / new illustration system beyond empty-state palette alignment  
- New features (notifications backend, etc.)  
- mf-web / mf-expo parity (track separately if desired)

---

## Acceptance sketches

| ID | Done when |
|----|-----------|
| AUTH-01 | User can reveal/hide password on Sign in and Sign up with keyboard |
| AUTH-02 | Untrained eye can tell active tab in &lt;1s on white panel |
| AUTH-03 | Idle fields visible on white panel without squinting |
| AUTH-04 | Prod/dev packaged build does not show GraphQL URL on auth |
| SET-01 | PAT field has same reveal control |

---

## Next decision

Confirm **Wave A** (or a subset) to implement next. Prefer shipping Wave A as one coherent desktop patch (version bump + CHANGELOG).
