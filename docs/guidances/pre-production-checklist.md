# Advanced pre-production tech stack checklist

**Author:** Production Solution Architect & Development Engineer  

**Approved by:** Production Solution Architect & Development Engineer  

**Tech stack:** Expo (React Native), Go (GraphQL), cloud-native infrastructure  

---

## Template revision

Use this block when the checklist structure or item IDs change. Bump **Revision** (e.g. R1 → R2) and append a row to **Revision history**.

| Field | Value |
|-------|-------|
| **Document** | Pre-production tech stack checklist |
| **Template ID** | `MF-GUIDE-PP-001` |
| **Revision** | R2 |
| **Revision date** | 2026-03-29 |

**Item ID format:** `PP-{section}-{nnn}` — section matches the main heading number (01–08); `nnn` is a zero-padded sequence within that section. Reference IDs in release tickets, PRs, and risk registers.

**Revision history**

| Rev | Date | Summary |
|-----|------|---------|
| R1 | — | Initial guided checklist (sections 1–8, role ownership). |
| R2 | 2026-03-29 | Added template revision block and stable `PP-*` prefixes on every checkbox line. |

---

## How to use this document

This checklist is meant to be run **before** promoting builds to production or opening a production cutover. It is **not** a substitute for threat modeling or formal compliance audits.

| Role | Primary sections to own |
|------|-------------------------|
| **Mobile developers (Expo / React Native)** | §1 (mobile items), §3, §5 (touch, deep links, a11y tied to app), §7 (store consoles) |
| **Backend engineers (Go / GraphQL)** | §1 (API items), §2, parts of §4 (secrets, observability hooks), §6 (Go typing, lint) |
| **Cloud / DevOps engineers** | §4, §6 (CI/CD, env validation on deploy), release automation |
| **UI/UX designers & mobile developers** | §5 |
| **Product / release managers** | §7 (metadata, review windows, TestFlight / Play tracks), §6 (feature flags policy) |
| **Whole engineering team** | §6 (typing, lint, env validation, feature flags, build tracking) |

**Suggested workflow:** Assign section owners, tick items in your release ticket or PR **by item ID** (`PP-xx-yyy`), and attach evidence (links to CI runs, config screenshots, or runbooks) where your org requires it.

---

## 1. Security & compliance (OWASP-oriented)

### Mobile Application Security Verification Standard (OWASP MASVS)

**For mobile developers (Expo / React Native)**

- [ ] **PP-01-001** — **MASVS-STORAGE (data at rest):** Ensure no sensitive data (PII, tokens, passwords) is stored in plain text. Use `expo-secure-store` or encrypted `react-native-mmkv`. Do **not** use `AsyncStorage` for secrets.
- [ ] **PP-01-002** — **MASVS-NETWORK (data in transit):** Enforce TLS 1.2+ for all API communications. Implement certificate pinning (via custom config plugins in Expo) for critical API domains when product risk requires it.
- [ ] **PP-01-003** — **MASVS-AUTH (authentication):** Implement secure session management. Use refresh token rotation. Ensure tokens are wiped securely on explicit logout or session timeout.
- [ ] **PP-01-004** — **MASVS-CODE (code quality):** Remove debugging code, `console.log` in production builds (e.g. `babel-plugin-transform-remove-console`), and test stubs that should not ship.
- [ ] **PP-01-005** — **MASVS-RESILIENCE (anti-tampering):** Enable code obfuscation where applicable (ProGuard/R8 for Android; Hermes compilation for iOS). If the product handles highly sensitive financial or health data, evaluate jailbreak/root detection and policy with legal/compliance.

### API security (OWASP API Security Top 10)

**For backend & cloud engineers**

- [ ] **PP-01-006** — **API1:2023 — Broken object level authorization (BOLA):** Ensure the Go backend validates that the requesting user has explicit permission for the **specific object** being accessed, not only “is authenticated.”
- [ ] **PP-01-007** — **API4:2023 — Unrestricted resource consumption:** Enforce rate limiting at the edge/API gateway and apply GraphQL-specific protections (see §2).
- [ ] **PP-01-008** — **API8:2023 — Security misconfiguration:** Disable GraphQL introspection in production. Strip detailed stack traces from GraphQL error responses returned to clients.
- [ ] **PP-01-009** — **Dependency & supply chain:** Pin or lock dependency versions for Go modules and npm/CocoaPods where applicable; run vulnerability scans in CI for known CVEs before release.
- [ ] **PP-01-010** — **CORS / origin policy:** Restrict browser-accessible endpoints if any; mobile-native clients still benefit from strict gateway rules and token handling.

---

## 2. Backend & API protocol (Go GraphQL)

**For backend developers**

- [ ] **PP-02-001** — **N+1 mitigation:** Use DataLoaders (e.g. [graph-gophers/dataloader](https://github.com/graph-gophers/dataloader) or [vektah/dataloaden](https://github.com/vektah/dataloaden)) at the resolver layer to batch and cache database access.
- [ ] **PP-02-002** — **Query depth limiting:** Implement middleware (custom AST walk or a Go GraphQL depth limiter) to reject queries deeper than a configured threshold (e.g. `> 5` levels) to limit malicious nesting.
- [ ] **PP-02-003** — **Query complexity / cost:** Assign costs to expensive fields (aggregations, full-text search, large lists). Reject queries whose total cost exceeds the server budget.
- [ ] **PP-02-004** — **Persisted queries:** For mobile clients, implement persisted operations / automatic persisted queries (APQ) so clients can send hashes instead of full query bodies where appropriate; enables smaller payloads and safer caching at the edge.
- [ ] **PP-02-005** — **Field-level authorization:** Enforce authorization in resolvers or via directives; ensure `context` carries authenticated user claims consistently.
- [ ] **PP-02-006** — **Context & timeouts:** Pass `context.Context` through every layer. Wrap top-level resolvers with `context.WithTimeout` (e.g. 5–10 seconds) to avoid hung queries exhausting DB pools or goroutines.
- [ ] **PP-02-007** — **Panic recovery:** Ensure panic recovery middleware is active on the GraphQL HTTP handler so a single bad request cannot crash the whole process.
- [ ] **PP-02-008** — **Schema ↔ client contract:** Confirm mobile `EXPO_PUBLIC_GRAPHQL_URL` (or env-specific URLs) match the deployed API version; document any **minimum server version** required for this app build.
- [ ] **PP-02-009** — **Migrations:** Production DB migration strategy is documented, ordered, and tested on a staging DB clone before prod.

---

## 3. Mobile client (Expo & React Native)

**For mobile developers**

- [ ] **PP-03-001** — **Continuous native generation (CNG):** Verify the app builds with `npx expo prebuild --clean` (when using prebuild). Prefer config plugins over hand-editing `/ios` and `/android` when possible.
- [ ] **PP-03-002** — **Engine & performance:** Confirm Hermes is enabled in app config. It improves TTI, memory, and bundle characteristics on supported setups.
- [ ] **PP-03-003** — **Bundle & asset optimization:** Convert static assets to WebP (or platform-optimal formats) where it helps. Compress images (e.g. Squoosh). Prefer `expo-image` for caching, placeholders (e.g. blurhash), and memory-aware loading vs. default `Image` where appropriate.
- [ ] **PP-03-004** — **State & caching:** Prefer a mature async data layer (TanStack Query, Apollo Client, etc.) over ad-hoc `useEffect`-only fetching for server state — caching, deduping, and background refresh.
- [ ] **PP-03-005** — **Offline & error boundaries:** Wrap the root (and fragile subtrees) in React error boundaries with fallback UI. Degrade gracefully offline (e.g. `expo-network` or equivalent).
- [ ] **PP-03-006** — **OTA updates:** Configure EAS Update (or agreed OTA path) for critical fixes. Define release channels clearly (e.g. production, staging) and who can promote between them.
- [ ] **PP-03-007** — **App store compliance — manifests & permissions:** Include iOS privacy manifest (`PrivacyInfo.xcprivacy`) via Expo config where required. Justify Android permissions; remove unused defaults.
- [ ] **PP-03-008** — **Secrets in client:** No API secrets embedded in the app binary; use public/config endpoints and server-issued tokens only.

---

## 4. Cloud & infrastructure

**For cloud / DevOps engineers**

- [ ] **PP-04-001** — **Edge protection:** Route API traffic through WAF + CDN (e.g. Cloudflare, CloudFront). IP rate limiting and known-bad traffic patterns blocked where feasible.
- [ ] **PP-04-002** — **Network isolation (VPC):** GraphQL API in private subnets; database in an isolated data layer with **no** public internet exposure; bastion or IAM-only access for operators.
- [ ] **PP-04-003** — **Secrets management:** No long-lived secrets in git. Use AWS Secrets Manager, GCP Secret Manager, HashiCorp Vault, or equivalent; inject at runtime for Go and CI.
- [ ] **PP-04-004** — **Infrastructure as code (IaC):** Production networks, IAM, compute, and data stores provisioned via Terraform, Pulumi, CDK, etc. — not one-off console changes only.
- [ ] **PP-04-005** — **Auto-scaling & resiliency:** Run across multiple AZs; scale with HPA / ASG on sensible metrics (CPU, memory, request rate, queue depth as applicable).
- [ ] **PP-04-006** — **Observability:** Centralized structured (JSON) logs. Distributed tracing (e.g. OpenTelemetry) from mobile → gateway → Go → DB where the product requires end-to-end debugging.
- [ ] **PP-04-007** — **Backups & restore:** Automated DB backups, retention policy, and a tested restore drill documented for RPO/RTO expectations.

---

## 5. Design, UX & usability

**For UI/UX designers & mobile developers**

- [ ] **PP-05-001** — **Touch targets:** Interactive controls meet minimum sizes (e.g. ~44×44 pt iOS, ~48×48 dp Android). Primary actions sit in comfortable thumb reach.
- [ ] **PP-05-002** — **Deep linking & routing:** Universal Links (iOS) and App Links (Android) configured with Expo Router (or agreed router). Cold starts from email/push land on the correct nested screen.
- [ ] **PP-05-003** — **Loading states:** Avoid blocking full-screen spinners as the only pattern; use skeletons and optimistic updates for mutations where it improves perceived performance.
- [ ] **PP-05-004** — **Accessibility (a11y):** Respect dynamic type / font scaling. Meet contrast targets (e.g. WCAG AA for critical text). Meaningful `accessibilityLabel` on icon-only controls.
- [ ] **PP-05-005** — **Permissions UX:** Do not prompt for Camera, Push, Location, etc. on first launch without context. Explain in-app before triggering the OS dialog.

---

## 6. Developer experience (DX)

**For the whole engineering team**

- [ ] **PP-06-001** — **Strict typing:** `strict` (or team-agreed strictness) in Expo `tsconfig.json`; idiomatic strong typing in Go.
- [ ] **PP-06-002** — **Environment validation:** Fail fast at build or boot if required env vars are missing (e.g. `t3-env`, Zod-validated config, or Go config loaders with explicit checks).
- [ ] **PP-06-003** — **Linting & formatting in CI:** Backend: `golangci-lint`. Frontend: ESLint (including React hooks rules) + Prettier; CI fails on regressions.
- [ ] **PP-06-004** — **Feature flags:** Roll out risky features gradually (LaunchDarkly, ConfigCat, internal flag service, etc.). Avoid shipping major behavior changes to 100% of users without a rollback lever.
- [ ] **PP-06-005** — **Build tracking:** Show app version + build number in settings (e.g. `expo-application`) so support can correlate crashes and tickets.
- [ ] **PP-06-006** — **Release documentation:** User- or operator-visible changes recorded in the repo changelog or release notes per team convention.

---

## 7. App store deployment & console management

### iOS — Apple App Store (App Store Connect)

**For mobile developers & product managers**

- [ ] **PP-07-001** — **Certificates & profiles:** Production distribution certificate and provisioning profiles valid. APNs configured for the production bundle ID if using push.
- [ ] **PP-07-002** — **Metadata & creative:** Screenshots for required device sizes, previews, descriptions, keywords, promotional text; deep-dive assets that explain core flows.
- [ ] **PP-07-003** — **Privacy & compliance:** App Privacy questionnaire matches reality; `PrivacyInfo.xcprivacy` (and app behavior) aligned with declarations.
- [ ] **PP-07-004** — **Reviewer access & attachments:** Dedicated long-lived test account in App Review Information. If possible: pre-seeded data, OTP/2FA mitigations for review, and attachments (videos/screenshots) for complex hardware or backend-dependent flows.
- [ ] **PP-07-005** — **Environment lock during review:** Backend stable; no deployments that could break review during the active review window (unless coordinated with Apple).
- [ ] **PP-07-006** — **TestFlight:** External or internal TestFlight sanity pass on the **same** build lineage as submission.

### Android — Google Play Console

**For mobile developers & product managers**

- [ ] **PP-07-007** — **App signing:** Play App Signing enabled; upload keystore and passwords stored in a secure vault — **backup verified**.
- [ ] **PP-07-008** — **Store listing:** 512×512 icon, 1024×500 feature graphic, localized screenshots/text; promotional assets explain key workflows.
- [ ] **PP-07-009** — **Data safety:** Data collection, sharing, and security practices declared accurately; privacy policy URL valid and consistent with iOS posture where applicable.
- [ ] **PP-07-010** — **Release tracks:** First production-like build exercised through Internal or Closed testing; review pre-launch reports before full production.
- [ ] **PP-07-011** — **Format:** Ship **Android App Bundles (`.aab`)** via Play, not legacy APK-only flows, unless an exception is explicitly approved.

---

## 8. Monorepo & cross-team alignment (optional but recommended)

**When the mobile app and API live in the same repo or release together**

- [ ] **PP-08-001** — **End-to-end smoke:** One scripted flow (sign-in, critical query/mutation, deep link) against **staging** that matches prod configuration class.
- [ ] **PP-08-002** — **API contract tests or Postman/Newman:** Critical GraphQL operations exercised against staging before tagging a release.
- [ ] **PP-08-003** — **Rollback:** Documented steps to roll back app (store version / OTA policy) and API (image pin, feature flag) independently.

---

*Unchecked items should be treated as intentional risk acceptance only when documented with owners, dates, and referenced item IDs (`PP-xx-yyy`). Bump **Template revision** when adding, removing, or renumbering checklist lines.*
