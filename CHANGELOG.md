# Changelog

Notable changes to the **masterfabric-project-tracker** client repo are recorded here. Style: open-source friendly sections with **version**, **date**, and **author** per release. The mobile app can show the same Markdown via core-base mf-go `productRelease` (admins publish from **Settings → Admin → Version & changelog**).

## [Unreleased]

### Changed

- **repo:** Removed in-repo **`mf-go/`**, Azure **`infra/`**, **`fly.toml`**, and **`render.yaml`**. Platform GraphQL is **masterfabric-core-base** `mf-go`; org project domain API is **masterfabric-particulars** `particular-project-tracker`. Root CLI (`start-all` / `stop-all`) starts **mf-expo only** and documents sibling backend setup. Docs, `.cursor` rules/commands, and env examples retargeted accordingly.

- **mf-expo:** Organization **projects / todos / purchases** GraphQL now hops through core-base mf-go **`particularGraphqlEnvelope`** to **particular-project-tracker** (`project-tracker-envelope.ts`, particular key `EXPO_PUBLIC_MF_PROJECT_TRACKER_PARTICULAR`, default `project_tracker`). Auth, orgs, and personal todos stay on direct mf-go GraphQL. Inner Particular IDs use **String** (not UUID). Legacy dueAt/subtasks schema fallbacks for project todos removed. App version **1.2.1**.

- **mf-expo (1.2.2):** GraphQL client sends **`X-API-Key`** / **`X-Bundle-ID`** from `EXPO_PUBLIC_MF_*` so core-base Particular hops resolve the Project Tracker client app. Dedicated iOS Simulator **MF Project Tracker**; Particular host port **39205**.

### Added

- **mf-tracker-client:** Particular PM lifecycle types/API — issue people (`reporterUserId`, `developerUserId`, `testerUserId`, `reviewerUserId`), `estimateAt` / `testDueAt` / `testEstimateSeconds`, custom workflow statuses, custom board stages (`boardStageId`, `mapsToBoardColumn`), and timer entries with kind `DEV` | `TEST` | `REVIEW` | `OTHER`. No desktop UI in this slice.

- **mf-tracker-client:** Particular issue collab types/API — project labels, comments, issue links (`BLOCKED_BY`/`BLOCKS`/`RELATED`/`DUPLICATE`), `parentTodoId`, watchers, lightweight activity, and releases (`fixVersionId`). No desktop UI in this slice.

- **mf-tracker-client:** Particular PM ops types/API — attachments (URL metadata), project custom fields + todo values, issue templates, in-app notifications, components, lightweight SLA, org teams, sprint capacity / one-ACTIVE / start-complete, saved reports (velocity/burndown/throughput/time/priority/team), `priorityRank` + project `issueSort`, sprint story-point totals. No desktop UI in this slice.

- **mf-web:** New **Next.js** Linear-style tracker UI (`mf-web/`) — sign-in (OTP-aware), org/project switcher, issue **list** + **board** (Open/Done, drag-and-drop), issue drawer with subtasks, keyboard shortcuts (`C` `/` `1` `2` `Esc` `?`). Same mf-go GraphQL as mobile/macOS via `particularGraphqlEnvelope`. Desktop-first polish (dense list, board drop targets, dimmed drawer). **v0.3.0 parity:** create org + invites, project rename/delete, project members, assignee + due on create, assignee filters, editable due in drawer, **Purchases** tab, **My todos** (personal). See [`mf-web/README.md`](mf-web/README.md).

- **mf-macos:** New SwiftUI **menu bar** companion (`MenuBarExtra`) and **WidgetKit** gallery (My Tasks, Project Pulse, Focus Timer, Quick Add) talking to existing mf-go GraphQL (`myTodos`, org projects, login/refresh). Local focus timer (25/15/5). See [`mf-macos/README.md`](mf-macos/README.md).

### Fixed

- **mf-expo:** Home **Add / edit todo** — **iOS** inline **due date** calendar used **light** typography on a **dark** sheet (weekday labels and day numbers nearly invisible). **`DateTimePicker`** now sets **`themeVariant`** from app **`useTheme()`** so the native picker matches **dark / light** mode. (**MF-145**)

- **mf-expo:** Home **My Todos** with an **organization project** filter: task rows were static (only the checkbox toggled). Rows now **toggle done** when tapping the title area (aligned with project detail). **Long-press** opens **edit**; project-filtered items save via **`updateOrganizationProjectTodo`** / delete via project API (`TodoSheet` **`organizationProjectEditLock`**). User list: **tap row = toggle**, **long-press = edit** (replaces tap-to-edit and the home quick-actions sheet). EN + TR **`home.todos.description`**. (**GFG-118**)

- **mf-expo:** Home **project-filtered** todo rows show up to **two** **read-only** **subtasks** (status visible, not tappable) and a hint when more exist on the project screen. Org/project lines are **hidden** on these cards (filters already show them). **Long-press** an **assignee** chip while a **project** is selected opens **Profile → organization → project** with matching **`assignee`** query (`all` / `unassigned` / `me` / member id). **`OrganizationProjectDetailScreen`** reads **`initialAssigneeFilterParam`**. EN + TR **`assigneeFilterLongPressHint`**, **`subtasksPreviewMoreHint`**; **`home.todos.description`** updated.

- **mf-expo:** Organization **project purchase** add/edit sheet — **price** and **quantity** validation: bounds **0 &lt; price ≤ 1,000,000** (max two decimal places), **quantity** whole number **1 … 1,000,000** (no empty default to 1 on save), **number-pad** for quantity; **inline** error border + helper text on save, cleared when editing the field. EN + TR. (**GFG-116**)

- **mf-expo:** **Android dev client** — `IllegalArgumentException: App react context shouldn't be created before` when Metro opens the app (expo-dev-launcher expects `ReactHost.currentReactContext == null` until the activity delegate runs). **Android** now uses dev-client **`launchMode: launcher`** (`DEV_CLIENT_TRY_TO_LAUNCH_LAST_BUNDLE=false` in `AndroidManifest.xml`); **iOS** stays **`most-recent`**. **MainActivity** restores **`setTheme(R.style.AppTheme)`** before `super.onCreate` (Expo template alignment).

### Added

- **mf-go:** **Todo subtasks (GFG-117)** — migration **`024_user_and_project_todo_subtasks`**, tables **`user_todo_subtasks`** and **`organization_project_todo_subtasks`** (single level, up to 50 per parent; cascade when parent deleted). GraphQL: **`UserTodo.subtasks`**, **`UserTodoSubtask`**, **`createUserTodoSubtask`** / **`updateUserTodoSubtask`** / **`deleteUserTodoSubtask`**; **`OrganizationProjectTodo.subtasks`**, **`OrganizationProjectTodoSubtask`**, **`createOrganizationProjectTodoSubtask`** / **`updateOrganizationProjectTodoSubtask`** / **`deleteOrganizationProjectTodoSubtask`**. Access: same as parent **user todo** (creator / assignee / org member visibility) and **project todo** (**ensureProjectViewer** for list, mutations for editors). Postman **Todos** + **Organizations** requests; env **`userTodoSubtaskId`**, **`organizationProjectTodoId`**, **`organizationProjectTodoSubtaskId`**.

- **mf-expo:** **Subtasks** on **home user todos** (edit sheet: add, complete, delete) and **organization project todos** (indented under each task). **`myTodos`** / **`organizationProjectTodos`** query **`subtasks`** with fallback when the server schema is older (`isSubtasksSchemaMismatchError`). EN + TR **`home.todos.subtask*`**.
- **mf-go:** Organization **project purchase line items** — migration **`023_organization_project_purchases`**, GraphQL **`organizationProjectPurchases`**, **`createOrganizationProjectPurchase`**, **`updateOrganizationProjectPurchase`**, **`deleteOrganizationProjectPurchase`** (same access as project todos: viewer for list, roster member or org admin/owner for mutations). Fields: product name, tax rate, purpose, price, quantity, optional product link, status (**REQUESTED** / **PURCHASED** / **CANCELLED**), status note, currency. Postman requests under **Organizations**; env **`organizationProjectPurchaseId`**. Regenerated client SDKs. (**GFG-113**)

- **mf-expo:** Organization **project detail** — **Purchases** tab: list, add/edit sheet (product, purpose, price, quantity, tax %, currency, status, link, notes), delete with confirm, optional **Open product link**; GraphQL in `mf-go-api.ts` (`organizationProjectPurchases`, create/update/delete). EN + TR. (**GFG-112**)

- **mf-go:** **`adminCreateNotification`** optional **`sendPush`** — when **`true`**, publishes **`push.admin.broadcast`** on the event bus (RabbitMQ when enabled, otherwise in-process); subscriber sends a **OneSignal** push to segment **`All`** using **REST credentials on mf-go only**. Todo assignment/due pushes remain server-driven from todo use cases (Redis stores scheduled ids). Postman **AdminCreateNotification** variables include **`sendPush`**. **`mf-expo`** **`mfGoNotifications.adminCreate`** accepts optional **`sendPush`**.
- **mf-go:** User todos (**`UserTodo`**) optional **`dueAt`** (UTC **`Time`**) — migration **`021_user_todos_due_at`**, **`createTodo`** / **`updateTodo`** inputs **`dueAt`** and **`clearDueAt`**, admin **`adminUpdateUserTodo`** extended. Postman **Todos** requests return **`dueAt`**. (**GFG-100**)
- **mf-go:** Organization **project todos** (**`OrganizationProjectTodo`**) optional **`dueAt`** — migration **`022_organization_project_todos_due_at`**, **`createOrganizationProjectTodo`** / **`updateOrganizationProjectTodo`** inputs **`dueAt`** and **`clearDueAt`**. Postman org-project todo requests updated.
- **mf-expo:** Home **Add / edit todo** sheet — **date & time** due picker (hidden for **organization project** creates); list rows show due when set. **`@react-native-community/datetimepicker`** + config plugin. Local todos persist **`dueAt`**. EN + TR (`home.todos.dueDate*`). (**GFG-100**)
- **mf-go:** Optional **OneSignal REST** (`ONESIGNAL_APP_ID`, `ONESIGNAL_REST_API_KEY`) — push when a todo **`assignedToUserID`** is set or changed (including self-assignment), and **scheduled due** push at **`dueAt`** (cancel/reschedule on update; cancel on delete/complete/clear due). Stores OneSignal notification ids in **Redis** (`mf:os:todo_due:*`). Skips recipients with **`notifications_on`** false. (**GFG-103**)
- **mf-expo:** **OneSignal.login** / **logout** tied to **mf-go** session **`userId`** (plus login after init in root layout) so server **`external_id`** targeting matches the device. (**GFG-103**)

- **mf-go:** **`OrganizationInvitation`** GraphQL fields **`organizationName`** and **`inviterNickname`** (populated for **`myPendingInvitations`** via join to organizations and users) so invitees see which org invited them and by whom. Postman **My Pending Invitations** query updated.
- **mf-expo:** Profile **pending invitations** row shows **organization name** (and **invited by** when known) instead of the invitee’s own email. EN + TR (`profile.organizations.invitationUnknownOrg`, `invitationInvitedBy`).

- **mf-go:** Organization **projects** with per-project **roster** and **todos** — GraphQL (`organizationProjects`, `organizationProject`, `organizationProjectMembers`, `organizationProjectTodos`, create/update/delete project, add/remove project member, create/update/delete project todo), migration `019_organization_projects`, Postman requests under Organizations. **Listing:** org **admin/owner** sees all projects in the org; other members only see projects they are on the roster for. (**GFG-92**)
- **mf-go:** Optional **`assignedToUserId`** on **`createOrganizationProjectTodo`** / **`OrganizationProjectTodo`** (migration **`020_organization_project_todo_assignee`**). Only org **admin/owner** may set it; assignee must be on the **project roster**.
- **mf-expo:** Organization detail **Projects & todos** entry → project list (admins create via +) → project screen with members, add/remove (admins), and todos (toggle done, add/delete). Client API in `mf-go-api.ts`; EN + TR strings.
- **mf-expo:** Home **Add todo** sheet — with an org **project** selected, **admin/owner** can assign the new project todo to a **project member**; project detail lists show assignee when set (`profile.organizations.projects.todoAssignee` EN + TR).
- **mf-expo:** Organization **project detail** — same **TodoSheet** as home for adding todos (locked org/project); **refetch on screen focus** so items added from home appear when you open the project; **assignee filter** chips (all / unassigned / me / roster members). EN + TR strings.
- **mf-expo:** Home **Yapılacaklarım** — when the user has organizations: **organization** row, **general vs project** row (loads **organization project todos** for a selected project), and **assignee** chips (all / unassigned / me / org members). Drag-reorder stays available only for the unfiltered **my todos** list. EN + TR (`home.todos.listFilter*`).

### Changed

- **mf-expo:** **Removed `expo-notifications`** (dependency + `app.json` plugin). Notifications are **OneSignal only**. **Task due-time reminders** no longer use on-device local scheduling; `todo-reminders-service` stays a thin client stub while **mf-go** schedules push; full **background-handling** scope is tracked in Linear **GFG-103** (see **Changed**). Foreground handler / Android channel / permission snackbars for local due alerts removed from active use.

- **Tracking (Linear):** **[GFG-101](https://linear.app/gurkanfikretgunak/issue/GFG-101)** is **Canceled** (original OneSignal-only ticket). Active scope: **[GFG-103](https://linear.app/gurkanfikretgunak/issue/GFG-103)** — mf-go–authoritative reminders plus mobile **background** handling (push + platform-appropriate tasks), per ship checklists.

- **mf-expo:** **Local development** GraphQL URL — **Android emulator** automatically rewrites **`localhost` / `127.0.0.1`** to **`10.0.2.2`** so mf-go on the host is reachable; **physical devices** show a **Backend Environment** hint and a clearer error when the endpoint still uses loopback (use **LAN IP** in **`local.env`** or **Custom URL**). EN + TR (`errors.localBackendLoopbackOnDevice`, `home.environmentSwitcher.devLoopbackOnDeviceHint`). **`local.env.example`** + mf-expo **README** table updated.

- **mf-expo:** Home **Yapılacaklarım** filter rows and **organization project** assignee chip row use **`Sizing.gap.m`** horizontal **gap** between chips (was a tight fixed **6**).

- **mf-expo:** App version **1.2.0** (iOS/Android native build **4**).

- **mf-expo:** Removed **Firebase Cloud Messaging** (`@react-native-firebase/app`, `@react-native-firebase/messaging`) and **`expo-notifications`**. Remote push uses **OneSignal** only; the **Local Notification Helper** dev screen is stubbed without local scheduling. Notification permission on iOS is checked/requested via **OneSignal** APIs in **masterfabric-expo-core** `permissions_handler_helper`. (**GFG-55**)

- **mf-expo:** **iOS** — removed stale **Xcode** references to **`GoogleService-Info.plist`** (not present after RN Firebase removal; file is gitignored); builds no longer fail with “Build input file cannot be found” during archive/build.

- **mf-expo:** After FCM package removal, restored **OneSignal-aligned native config**: **`UIBackgroundModes`** includes **`fetch`** again (with **`remote-notification`**) in **`app.json`**; **`onesignal-expo-plugin`** passes explicit **`appGroupName`**; **Android** **`google-services`** Gradle plugin + **`googleServicesFile`** kept for **FCM** (OneSignal Android delivery), without re-adding React Native Firebase.

### Fixed

- **mf-go:** GraphQL **`mapPostgresToDomain`** maps **`42703` / `undefined_column`** and related text from the **full error unwrap chain** to **`SCHEMA_OUT_OF_DATE`** (not generic **`INTERNAL_ERROR`**), so clients see migration guidance when the DB is missing columns such as **`due_at`** (e.g. **`021_user_todos_due_at`** not applied on the server).

- **mf-expo:** **Android** **TodoSheet** due date flow: **sequential** **date** then **time** pickers instead of **`mode="datetime"`** — avoids **`RNDateTimePickerAndroid`** runtime error (`dismiss` of undefined). (**GFG-102**)

- **mf-expo:** Todo **save** when the GraphQL server is **older than migrations 021/022** (no `dueAt` on user or org project todos): **retry** create/update **without** due fields so the task still saves; optional **`_dueAtNotSaved`** + info snackbar. **`getGraphQLErrorMessage`** maps due-related **`GRAPHQL_VALIDATION_FAILED`** to **`errors.graphql.dueAtSchemaNotSupported`**; **`errors.graphql.schemaOutOfDate`** copy mentions **021/022**. EN + TR (`home.todos.dueAtNotSavedOnServer`). (**GFG-100**)
- **mf-expo:** Home **Yapılacaklarım** with an org **project** selected: **`organizationProjectTodos`** refetches when the **home tab gains focus**, on **refresh**, and after **adding a project todo from the sheet** — same list as **Profile → Organization → Project** (was stale until filters changed).

- **mf-expo:** Home **todo** filter **organization** chips use a **max width** (responsive, capped) and **tail ellipsis** so very long org names no longer stretch a single chip across the row; full name remains on the chip’s **accessibility label**. (**GFG-99**)

- **mf-expo:** Organization **project detail** todo list (**YAPILACAKLAR**): completed items apply **strikethrough / muted title** only to the **text**, not the leading **task-type emoji** (⭐, 📋, 📌, etc.). (**GFG-98**)

- **mf-expo:** Home and **organization project** todo assignee chip rows no longer show a **duplicate** chip for the **signed-in user** (same filter as **Assigned to me** / **Bana atananlar**); if the filter was stored as the user id, it normalizes to **me**.

- **mf-expo:** **TodoSheet** save: **General (my list)** **create** always resolves assignee via the self-only path (`currentUserId` with sync fallback), never the org-wide member branch when `currentUserId` is momentarily unset. (**GFG-96** / GFG-92 delivery)

- **mf-expo:** Home **Add todo** with an org and **General (my list)** selected: **create** flow locks assignee to the **signed-in user** (no org roster / unassigned picker); org **project** todos unchanged for admin/owner. Home todo list filters: **Personal** scope shows assignee chips **All** and **Assigned to me** only (**Unassigned** hidden; stale filter resets to **All**). (**GFG-95**)

- **mf-go:** GraphQL **error presenter** no longer masks **parse/validation** errors (HTTP **422**) as generic **`INTERNAL_ERROR`** when `extensions.code` is already set (e.g. **`GRAPHQL_VALIDATION_FAILED`** — useful when the app schema is ahead of the running server). **`mapErr`** maps PostgreSQL **`42703`** (undefined column) to **`SCHEMA_OUT_OF_DATE`** with a **020** migration hint, and **`23503`** to **`VALIDATION_ERROR`**; string heuristic for missing **`assigned_to_user_id`**. **CreateOrganizationProjectTodo** insert encodes assignee as **`pgtype.UUID`**.

- **mf-expo:** Home header — removed the left **organization circle chip** (initials next to the title); **Project Tracker** + actions only.

- **mf-go:** GraphQL **`mapErr`** uses **`errors.As`** for **`DomainError`** (wrapped `fmt.Errorf` no longer falls through to **`INTERNAL_ERROR`**). PostgreSQL errors map to **`SCHEMA_OUT_OF_DATE`** (`42P01` or relation string heuristic) or **`DATABASE_ERROR`** (other SQLSTATE) instead of **`INTERNAL_ERROR`**. Debug NDJSON (session **`6008d1`**) may append to **`.cursor/debug-6008d1.log`** for org-related unmapped errors and **`pgconn.PgError`** metadata during investigation.

- **mf-expo:** GraphQL **`DATABASE_ERROR`** → **`errors.graphql.databaseError`** (EN + TR). **`graphql-client`** may POST debug payloads to the Cursor ingest endpoint on **`ClientError`** (session **`6008d1`**).

- **mf-expo:** **Organization → Projects** list no longer shows “organization not found” when `organizationProjects` fails but the org is valid (loads org, members, and projects independently). **Create project** is available from the app bar **+** icon, empty-state button, and FAB (admin/owner). **Home → Add todo** with an organization selected: **Project** chips (**General (my list)** vs org projects) add tasks to **`myTodos`** or **`createOrganizationProjectTodo`**; EN + TR strings.

- **mf-expo:** mf-go **Sign Up** — enforces **8-character minimum password** (matches mf-go register validation), shows a register hint, maps GraphQL **`VALIDATION_ERROR`** (`Password: failed on 'min'`) to friendly i18n; **`validation.passwordMinLength`** and Zod register schemas aligned to **8**.

- **mf-expo:** **Push + ATT + notifications badge** — foreground OneSignal notifications call **`OSNotification.display()`** so banners appear while the app is open; **App Tracking Transparency** runs after **`InteractionManager`** + delay following OneSignal init (and still runs if OneSignal is missing or init fails); **ATT** no longer sets the “already requested” guard before confirming the **ExpoTrackingTransparency** native module exists. Home **notification** header icon shows an **unread count** badge when **`unreadCount` > 0**.

- **mf-expo:** **OneSignal** (aligned with [Expo SDK setup](https://documentation.onesignal.com/docs/en/react-native-expo-sdk-setup)) — **`initialize` + `requestPermission`** and **`initPushNotificationHandler`** moved to **`app/_layout.tsx`** after fonts load (Expo Router root layout). Splash no longer duplicates init; avoids late / missed permission flow.

- **mf-expo:** **OneSignal** permission prompt missing on **development builds** — `masterfabric-expo-core` `onesignal/index.ts` treated `executionEnvironment === 'storeClient'` as Expo Go; **dev client** uses that value too, so the **stub** was loaded instead of the real SDK. Stub selection is now **`appOwnership === 'expo'`** only.

- **mf-expo:** **Metro** aliased `react-native-onesignal` to the Expo Go **stub** whenever **`EXPO_DEV_BUILD !== '1'`**, so plain **`npm start`** + dev client never loaded the real native SDK (push permission no-op). Metro now always resolves through **`src/shared/shims/react-native-onesignal.ts`** (runtime: Expo Go / web → stub; dev client / release → real package).

- **mf-expo:** **Android** bottom tabs with **gesture navigation** — the tab bar used a fixed bottom padding and height, so the **system gesture bar** sat on top of **tab labels and icons** (copy hard to read, icons barely visible). **`app/(tabs)/_layout`** now adds **`useSafeAreaInsets().bottom`** on Android to **`paddingBottom`** and **`height`**; **`SnackbarQueue`** bottom offset uses the same inset so toasts stay above the taller bar. Tab (and other) icons used **`expo-symbols` / SF Symbols**, which do not render real glyphs on **Android** (or **web**); **`IconSymbol`** now uses **`lucide-react-native`** (with **`react-native-svg`**) and an SF-name → Lucide map on non‑iOS. (**GFG-90**)

- **mf-expo:** **`app.config.js`** re-applies **`mf-expo/.env` with overwrite** after Expo CLI’s dotenv merge so **`EXPO_PUBLIC_GRAPHQL_URL`** (and other base keys) are not stuck on **`.env.development`** values. **`Backend Ortamı` → Canlı** could show **`localhost`** while **`.env`** had the real prod URL; **`env` paths resolve from `__dirname`** so monorepo cwd does not skip **`.env`**.

- **mf-expo:** Auth **refresh** retries up to **3** times on **transient** failures (connection errors, HTTP **408** / **429** / **5xx**) before logging out; **TOKEN_INVALID** / **ACCOUNT_DISABLED** still end the session immediately. (**GFG-76**)

- **mf-expo:** Auth **refresh** also retries when the backend returns GraphQL **`INTERNAL_ERROR`** or **`SESSION_STORE_UNAVAILABLE`** (common when **Azure Redis** or mf-go flakes while HTTP stays **200**). **`USER_NOT_FOUND`** on refresh is treated as definitive (no pointless retries).

- **mf-expo:** `graphqlRequest` now retries the original request **once** after auth recovery (`onAuthError` / refresh) so expired-access-token calls can succeed without manual user retry. Refresh mutation calls set `skipAuthRecovery` to avoid recursive refresh loops.

- **mf-expo:** Persist rehydrate now treats auth as valid only when both `authToken` and `mfGoSession.refreshToken` exist. Token-only partial state is cleared, and `useMfGoAuthSync` defensively logs out/clears GraphQL auth if token exists without refresh session (prevents "fake signed-in" state that later forces surprise logout).

- **mf-go:** **`RefreshTokens`** restores the consumed refresh entry in Redis when **generating** the new token pair fails (e.g. transient Redis or session-limit enforcement), so clients are not stranded until re-login. (**GFG-77**)

- **mf-expo:** **Help & FAQ** and **Privacy policy** (`/help-faq`, `/privacy-policy`) rendered raw Markdown in a single **`Text`** node. They now use **`parseMarkdown`** (nested **`Text`**) via shared **`MarkdownText`**. **`masterfabric-expo-core` `parseMarkdown`** had broken **bold/italic** (split ate delimiter tokens); inline markers are fixed, plus **`#`–`######`**, horizontal rules, and **`-` / `*`** list lines (bullet prefix).

- **mf-expo:** **Turkish locale** for legal copy — when the app language is Turkish and **`public_help_faq_markdown_tr`** / **`public_privacy_policy_markdown_tr`** are non-empty in public app settings, those bodies are shown instead of the English keys. **Admin → Help & legal** can edit/save Turkish Markdown. **mf-go** migration **`018_public_legal_markdown_tr`** seeds default Turkish Markdown (same **`ON CONFLICT`** empty-only fill behavior as 013).

- **mf-expo:** **About** sheet **published changelog** from **`productRelease`** now renders Markdown the same way (**`MarkdownText`**), not raw syntax.

- **mf-expo:** **mf-go auth** — after a successful **Sign In** / **Create account** (or OTP verify), the app no longer flashes the static **“You’re signed in”** screen before **Home**: session commit sets a short-lived suppress flag and **`router.replace('(tabs)')`** runs before **AsyncStorage** credential writes so navigation is not blocked by an `await`. (**GFG-59**)

- **mf-expo:** **Sign in** — wrong-password (and other) errors no longer dismiss the keyboard: password field uses **`blurOnSubmit={false}`**, and the auth **`ScrollView`** uses **`keyboardShouldPersistTaps="always"`** so tapping **Sign In** does not steal focus from the fields.

- **mf-expo:** **OTP bottom sheet** — removed **`Keyboard.dismiss()`** at the start of verify (it ran before the request completed, so wrong/invalid codes hid the keyboard). Dismiss only **after** a successful verify, before the success UI.

- **mf-expo:** **Org chat** composer — with the keyboard open, **`paddingBottom`** no longer uses **`safeAreaInsets.bottom`** (~34pt on notched iPhones); the keyboard already covers the home indicator, so that inset duplicated space and left a gap above the keyboard.

- **mf-expo:** Settings **two-factor (OTP)** row — **`Switch`**: **`ios_backgroundColor`** + theme **`divider`** for the off track on **iOS**; **ON** track in **dark mode** uses **`successColor`** (`#34C759`) instead of **`tint`** (off-white, indistinguishable from the white thumb). **`thumbColor`** only on **Android**.

- **mf-expo:** **App Tracking Transparency** — gate on **`requireOptionalNativeModule('ExpoTrackingTransparency')`** before any **`import('expo-tracking-transparency')`**. The package’s JS loads the native module at import time, so **dynamic import alone** was not enough; **Expo Go** and other binaries without ATT no longer crash with **`Cannot find native module 'ExpoTrackingTransparency'`** (ATT still runs on **iOS dev/release builds** that include the module).

- **mf-expo:** **Forgot password** screen and **Send feedback** bottom sheet wrap inputs with **`AdaptiveKeyboardAvoidingView`** (same pattern as mf-go auth and invite sheet) so the keyboard is less likely to cover fields on small viewports. (**GFG-53**)

- **mf-expo:** **`AdaptiveKeyboardAvoidingView`** — optional **`tabBarScene`** uses overlap-based **`paddingBottom`** (same metrics as adaptive `enabled`, minus **`safeAreaInsets.bottom`** so the window-bottom overlap is not double-counted with **`SafeAreaView`**, plus a small iOS fudge) instead of RN **`KeyboardAvoidingView`**, which often under-pads when the tab bar is **`position: 'absolute'`** with safe-area scaffolds. **`useKeyboard`** is a single shared subscription (`useSyncExternalStore`). **Organization messages** uses **`tabBarScene`**; **Admin → Feedback** reply sheet uses default avoidance. (**GFG-50**)

- **mf-expo:** **System** appearance no longer mixes light `getThemeColors` with a dark UI: screens and shared components use **`isDark`** from **`useTheme()`** (masterfabric) instead of **`currentTheme === 'dark'`**, which was false when the stored mode was **`system`**. **`SettingsStoreBanner`** updated the same way. **`battery-helper`** screens still use the app **`theme-context`** resolver (`light` / `dark` only) and were left unchanged. (**GFG-58**)

- **mf-go:** **OTP login** no longer ignores **`requestOTP`** failures after password validation. A failed create/deliver (SMTP, rate limit, etc.) used to still return **`otpRequired`**, so **`loginVerifyOTP`** hit **`OTP_NOT_FOUND`**; pending **Redis** login-token keys are removed and the **GraphQL** error is returned on **`login`** instead.

- **mf-go:** Refresh-token consumption no longer uses Redis **`GETDEL`** (requires Redis **6.2+**). **Azure Cache for Redis** on **6.0** returned **`ERR unknown command getdel`**, breaking **`refreshTokens`**; session cache uses an atomic **Lua** GET+DEL (**`redis.Script`** / **EVALSHA**) compatible with **6.0** and local Redis.

- **mf-go:** **Redis** client defaults for **managed** caches: bounded **dial/read/write** timeouts, **retries**, **min idle** conns, and a **3m** **`ConnMaxIdleTime`** so idle TCP sockets are recycled before many providers drop them (fewer EOF / timeout errors after quiet periods).

- **mf-go:** **`/health/ready`** re-**Ping**s **Postgres** and **Redis** up to **four** times with short pauses (longer overall deadline) so transient blips do not immediately return **503** and trigger needless restarts.

- **mf-go:** **pgAdmin** container no longer crash-loops on startup: **`PGADMIN_DEFAULT_EMAIL`** uses **`pgadmin-dev@example.com`** instead of **`dev@masterfabric.local`** because recent **`dpage/pgadmin4`** images reject **`.local`** domains (email-validator “special-use or reserved” TLD). **`make docker-infra`** / **`docker-up`** run **`chmod 600`** on **`deployments/pgadmin/pgpass`** so libpq accepts the mounted passfile.
- **mf-go:** **`cmd/server`**, **`cmd/migrate`**, and **`cmd/seedadmin`** call **`godotenv.Load()`** before **`config.Load()`** so **`mf-go/.env`** is applied when using **`make run`** / Air (the Makefile did not shell-source `.env`, so **`REDIS_PASSWORD`** and other keys were ignored and Redis stayed “unavailable”).
- **mf-go:** **`logout`** mutation is now caller-bound: it requires an authenticated context user and rejects requests where input `userID` does not match the caller (`UNAUTHORIZED` / `FORBIDDEN`).


- **mf-go:** **Login / register** no longer return a refresh token when **Redis is unavailable** (dev `REDIS_REQUIRED=false`); opaque refreshes were not stored so **`refreshTokens` always failed** with `TOKEN_INVALID`. Issuing tokens now requires a working session store (`SESSION_STORE_UNAVAILABLE`).
- **mf-expo:** GraphQL **`SESSION_STORE_UNAVAILABLE`** and **`OTP_UNAVAILABLE`** map to **`errors.auth.sessionStoreUnavailable`** (start Redis for mf-go); **`graphqlRequest`** does not **`logger.error`** these codes when Redis is down.
- **mf-expo:** **`OTPBottomSheet`** verify/request errors use **`getAuthErrorMessage`** so Redis/cache failures show localized copy instead of raw GraphQL **`Error.message`** JSON.

- **mf-expo:** **`graphqlRequest`** — expected OTP verify outcomes (**`OTP_NOT_FOUND`**, **`OTP_EXPIRED`**, **`OTP_INVALID`**, **`OTP_MAX_ATTEMPTS`**) are no longer logged with **`logger.error`** (graphql-request still throws so UI can show **`getGraphQLErrorMessage`**; HTTP 200 + GraphQL `errors` is normal for domain failures).

- **mf-expo:** **Push / EAS (GFG-52)** — root cause for “works locally, not in production” is often an empty **`EXPO_PUBLIC_ONE_SIGNAL_APP_ID`** at **prebuild** (local `.env` is not on EAS). **`eas.json`** now sets **`environment`** per profile (**development** / **preview** / **production**) so Expo dashboard variables attach correctly; **`.env.example`**, **`app.config.js`**, and **`mf-expo/README`** document required EAS env. On device, a **release-visible** warning runs once when the App ID is missing; OneSignal init and FCM setup failures log via **`logger.warnAlways`** (not swallowed).

- **mf-expo:** **i18n + errors (GFG-57)** — profile, notifications (user + admin history + edit modal), projects list, admin sessions / user detail (OTP + session reset), **admin user list** / **status** / **delete**, **version**, **OTP mail**, **SMTP mail**, **legal content**, **battery** store, **web viewer** source validation, **Firebase / OneSignal / FCM / app icon** helper **`Alert`s**, and **device info** hooks no longer use hard-coded English fallbacks; **`getGraphQLErrorMessage`** covers GraphQL/API failures where applicable. Helper copy lives under **`helpers.*`** and **`errors.load.battery`** (**EN + TR**).

### Changed

- **mf-expo:** **`getGraphQLErrorMessage`** in **`graphql-error-helper`** maps mf-go GraphQL **`extensions.code`** (domain + auth/OTP codes from **`mf-go/internal/shared/errors`**) and connection failures to localized copy; **`getAuthErrorMessage`** uses the same mapping (no raw **`ClientError.message`** JSON for unknown codes). Updated: forgot password, home todos, org invite, **Send user message** / **Broadcast** sheets, feedback list/thread + send sheet, admin feedback. **EN + TR** under **`errors.graphql.*`** and **`errors.otp.*`**. (**GFG-51**, **GFG-54**)
- **mf-expo:** Global **`SnackbarQueue`** toasts use a **shadcn/ui**-style **card** (border, shadow, **foreground** text, variant **accent** bar + icon chip) instead of full-width solid fills; default placement is **bottom**, offset above the tab bar (**`TAB_BAR_CLEARANCE`**). See component file header + [shadcn Toast](https://ui.shadcn.com/docs/components/toast). Post–**mf-go auth** redirect snackbars no longer force **`position: 'top'`**.

- **Repo (CI/CD):** **`Deploy mf-go to Azure Container Apps`** post-deploy check now hits **`GET /health/ready`** (readiness: **Postgres** + **Redis**) instead of **`GET /health`** (liveness only), so a green deploy requires dependencies usable, not only the HTTP process.

- **Repo (CI/CD):** **`Deploy mf-go to Azure Container Apps`** automatically **rolls back** the container app to the **pre-deploy image** when the post-deploy readiness check fails (then verifies **`/health/ready`** again). The workflow run still **fails** so operators see a red run; manual `az` echo-only rollback was removed.

- **Repo (CI/CD):** Backend **`CI`** on **`pull_request`** / **`push`** → **`main`** (path-filtered). **`Main CI release`** runs after green **`CI`** on **`main`** and creates **`ci-success-*`** only if the commit touches **`mf-go/`**, **`infra/`**, or **`.github/`** (skips mf-expo-only / docs-only noise). **`Deploy mf-go to Azure Container Apps`** follows tags **`mf-go/v*`** / **`workflow_dispatch`**; **`mf-go Auto Version`** is **manual** for **`semver.txt`** + **`mf-go/v*`**. **`version.Version`** from **`semver.txt`** (override **`MF_BUILD_VERSION`**). Branch protection: **`CI`** on **`main`**; **github-actions[bot]** may push **`main`** for semver bumps.

- **mf-go:** **`make docker-infra`** starts **Mailpit** (SMTP **localhost:1025**, **http://localhost:8025**) for local **OTP email**; **`.env.example`**, **OTP_CONFIGURATION.md**, and repo **README** updated.
- **mf-go:** Refresh tokens are consumed with an atomic **Redis** read-and-delete (**Lua** script; same semantics as **GETDEL**, compatible with Redis **6.0**) so concurrent refresh requests cannot both succeed on the same opaque refresh token. New env **`AUTH_MAX_REFRESH_SESSIONS_PER_USER`** (default **10**, **0** = unlimited) trims oldest refresh sessions when a user exceeds the cap.
- **mf-expo:** Token refresh uses a **single in-flight** promise so overlapping refresh triggers (launch, 3-minute timer, foreground, GraphQL auth recovery) no longer rotate the same refresh twice and force a logout.
- **mf-go:** Local Postgres UI is **pgAdmin** (`dpage/pgadmin4`) instead of **pgweb**, still on host **`http://localhost:5001`**. **`deployments/pgadmin/`** (`servers.json`, **`pgpass`**) is mounted by **`deployments/docker-compose.yml`**; **`make docker-infra`** starts **`pgadmin`** instead of **`pgweb`**. Dev login: **`pgadmin-dev@example.com`** / **`masterfabric`**.

### Added

- **mf-expo:** **Sign out** — after **`useMfGoAuth` logout** (Settings or **mf-go auth**), an **info** snackbar (`auth.mfGo.signedOutRedirectSnackbar`, **EN + TR**) and **`router.replace('/(tabs)')`** return the user to **Home**, aligned with **SnackbarQueue** / **GFG-60**. (**GFG-61**)

- **mf-expo:** **Sign In** — wrong email/password (**`INVALID_CREDENTIALS`** or heuristics → `errors.auth.invalidCredentials`) shows an **error** snackbar (`auth.mfGo.wrongPasswordSnackbar`, **EN + TR**); **`getGraphQLErrorI18nKey`** in **`graphql-error-helper`** for UI branching. (**GFG-62**)

- **mf-expo:** **mf-go auth** — after successful **Sign In**, **OTP verify**, or **Create account**, a **success snackbar** confirms redirect to **Home** (`auth.mfGo.postSignInRedirectSnackbar` / `postRegisterRedirectSnackbar`, **EN + TR**). Uses **`useSnackbar`** / **`SnackbarQueue`**; no PII in copy. (**GFG-60**)

- **Repo (CI/CD):** **Dependabot** (`.github/dependabot.yml`) — weekly version updates for **GitHub Actions**, **`mf-go`** Go modules, and **Docker** images under **`mf-go/deployments/`**.

- **mf-expo:** Home app bar — **Project Tracker** title includes **`home.headerSubtitle`** (todos + organization news wayfinding); header row height and flex layout support two lines beside actions; triple-tap for Backend Environment unchanged; i18n **EN + TR** (**GFG-47**).

- **mf-expo:** Home **Backend Environment** sheet (triple-tap title) — **Custom URL** row with normalized GraphQL endpoint, **recent endpoints** (clock icon) with reuse / per-item remove / clear-all; persists with dev/prod in AsyncStorage. i18n **EN + TR**.
- **mf-expo:** Backend Environment sheet UI — clearer dev/prod vs custom layout (tap hint, divider, history next to URL field), history as a matching **bottom** sheet, **clear-all** confirmation inline (no system `Alert`). Grabber aligned to the **top** of the sheet (no erroneous `safeAreaInsets.top` on sheet body); history rows **single-line** (URL + icon actions).

- **mf-expo:** **App Tracking Transparency** via `expo-tracking-transparency` — config plugin sets `NSUserTrackingUsageDescription`; after splash routing the app requests the system ATT prompt when status is still undetermined, **before** OneSignal / FCM setup so IDFA-gated analytics and messaging behave correctly on iOS. See [Expo TrackingTransparency](https://docs.expo.dev/versions/latest/sdk/tracking-transparency/).

- **mf-go:** Security hardening pass — **GraphQL query depth + complexity** limits wired (`GRAPHQL_QUERY_DEPTH_LIMIT`, `GRAPHQL_COMPLEXITY_LIMIT`; over-deep queries rejected, often **HTTP 422** — client error code may still appear as **`INTERNAL_ERROR`** until the presenter maps gqlgen protocol errors; see **SECURITY.md** → *Developer follow-ups*); **`Cache-Control: no-store`** + conditional **HSTS** (`HTTP_DISABLE_HSTS`); production **`config.Validate`** now **fails** on `DATABASE_DSN` **sslmode=disable**, **wildcard CORS**, and **RabbitMQ guest:guest**; **`/health/ready`** generic failure messages; **Redis** docker-compose **`requirepass`** + restricted commands (**`FLUSHALL`/`CONFIG`/`DEBUG`**); **login** brute-force buckets in Redis (**`LOGIN_RATE_LIMITED`**); **`make security-scan`** (**gosec** + **govulncheck**); **`GetInt64`** / **`envInt32`** hygiene for scanners. Docs: **SECURITY.md**, **`.env.example`**.

- **mf-expo:** Profile **Account** — leading icons (**mail** / **key** / **settings**) and consistent title + subtitle rows; **Settings** subtitle line. **Delete account** — compact **badge strip** (live impact counts), optional **full details** expander (compact list, no duplicate footer callout), trash icon header + warning icon on the destructive button. **Delete confirm** sheet: **`confirmSheetMinimal`** only (no embedded impact list). **ConfirmationBottomSheet** — scroll viewport scales down for message-only vs **`extraContent`**. i18n **EN + TR** (`profile.account.settings*`, `profile.deleteAccount.sectionSummary`, `impactCardTitle`, `badges.*`, `confirmSheetMinimal`). (**GFG-35**)
- **mf-expo:** Profile **Account** — **Reset password** opens **`/forgot-password`** with the current sign-in email prefilled; uses existing **`requestPasswordReset`** / **`resetPasswordWithOtp`** (**mf-go** unchanged). i18n **EN + TR** (`profile.account.resetPassword*`). (**GFG-34**)
- **mf-expo:** Settings **About** uses the same **SettingsSection** card + header pattern as other groups; primary row opens the existing app info sheet. i18n **EN + TR** (`settings.sections.about.description`, `rowHint`). (**GFG-32**)
- **mf-go:** **`user_password_history`** (migration **`017_user_password_history`**) — domain **`PasswordHistoryRepository`**, Postgres **`PasswordHistoryRepo`**, and **`rejectIfPasswordReusesRecent`** (last **3** retired hashes + current hash) with **`PASSWORD_REUSE_NOT_ALLOWED`**. Wiring into change/reset-password flows is follow-up (**GFG-33**).

- **mf-go:** GraphQL **`updateProfile.input.email`** — authenticated users may change their sign-in email (trimmed, lowercased, unique). Duplicate addresses return **`EMAIL_TAKEN`**; validation uses shared struct validation for **`email`** format. Postman (with OTP): **Request OTP (EMAIL_CHANGE)** → **Verify OTP (EMAIL_CHANGE)** → **Update Profile — email (unique)** (needs **`emailChangeOtpId`**).
- **mf-expo:** Profile **Account** section — tap **Email** to open a sheet and update sign-in email via **`updateProfile`**; syncs session user, **last-email** pref, and clears **saved password** when the stored password was for the previous address. i18n **EN + TR** (`profile.account.*`).
- **mf-go / mf-expo:** **Email change is OTP-gated:** new GraphQL enum **`OTPPurpose.EMAIL_CHANGE`**, migration **`016_otp_email_change_purpose`**, **`requestOTP` / `verifyOTP`** deliver to the **current** address (same SMTP bridge as login/identity when configured). **`updateProfile`** requires **`emailChangeOtpId`** (from **`verifyOTP`**) when **`email`** changes; errors **`EMAIL_CHANGE_OTP_*`**. Profile email sheet sends code, verifies, then saves. **`OTPBottomSheet`** and i18n support **`EMAIL_CHANGE`**.

- **mf-go:** Centralized outbound mail — migration **`014_system_mail_smtp`**, effective SMTP resolver (**DB when enabled + complete, else `SMTP_*` env**); OTP email delivery uses the resolver; **post-DB** production validation for `OTP_DELIVERY` email/both; admin GraphQL **`adminMailSmtpSettings`**, **`adminUpdateMailSmtpSettings`**, **`adminSendTestMail`**, **`adminSendUserEmail`** (test send rate-limited per admin in Redis). Postman requests under **Admin**. Docs: **OTP_CONFIGURATION.md** §3b, **SECURITY.md**.
- **mf-go:** Migration **`015_otp_mail_app_settings`** — admin **`app_settings`** keys **`otp_email_enabled`**, login/password-reset **subject/body** templates; **`EmailDeliveryProvider`** reads them (**`text/template`**, **`OTP_EMAIL_DISABLED`** when disabled); **`OTP_DELIVERY=both`** falls back to admin channel when email is disabled. GraphQL **`requestPasswordReset`** / **`resetPasswordWithOtp`** (anti-enumeration; Redis rate limits per email + IP). Postman: **Request Password Reset**, **Reset Password With OTP**. Docs: **OTP_CONFIGURATION.md** §5, **SECURITY.md**.

### Changed

- **Docs:** **[README.md](README.md)** (monorepo) — **Recent updates** + **Quick Start** / **Security** call out **mf-go** hardening, **`REDIS_PASSWORD`** vs Docker Compose **Redis `requirepass`**, and **`/health/ready`**. **[mf-go/README.md](mf-go/README.md)** — Go **toolchain** note, Redis password dev caveat, **`make security-scan`**, GraphQL error HTTP **422** note, **`LOGIN_RATE_LIMITED`** in error table. **CHANGELOG** — security bullet clarified (depth/complexity vs **INTERNAL_ERROR**; pointer to **SECURITY.md**).

- **mf-go:** When **`OTP_DELIVERY=admin_panel`**, authenticated and login OTP purposes **`LOGIN`**, **`VERIFY_IDENTITY`**, and **`ACCOUNT_ACTIVATE`** are delivered by **email** whenever **effective SMTP** is configured (same bridge as self-serve **`PASSWORD_RESET`**); **`requestOTP`** persists and returns channel **`EMAIL`** so clients show the right copy. WhatsApp/Telegram/email **`OTP_DELIVERY`** modes are unchanged for those purposes except **`PASSWORD_RESET`** still preferring SMTP when configured. Docs: **`OTP_CONFIGURATION.md`** §5.

- **mf-expo:** Replaced **`Alert.alert`** with a shared **`MessageBottomSheet`** (modal bottom sheet) on auth (**forgot password**), **sign-in** hint card for OTP/email, **OTP** verification sheet copy (EN + TR), **profile** (delete-account errors), **organization detail**, **projects** (open repo link), **support** (guest feedback thanks), and **admin** screens (**OTP mail**, **mail management**, **feedback**, **legal copy**, **version**). Dev **helper** screens (Firebase, FCM, OneSignal, app icon) still use `Alert`.
- **mf-go:** **`system_mail_smtp.password`** — optional **`MAIL_SMTP_ENCRYPTION_KEY`** (32-byte AES-256) encrypts values at rest (**`mf1:`** envelope); plaintext legacy rows still work; **effective SMTP is no longer cached in Redis** (avoids storing decrypted passwords). Docs: **SECURITY.md**, **OTP_CONFIGURATION.md** §3b, **`.env.example`**.
- **mf-expo:** Settings **Admin → Notifications** section with **Notification history** and **Mail management** (`/admin-mail-management`): edit SMTP, send test mail, email a user by UUID; **`mfGoAdmin`** mail helpers; i18n EN + TR.
- **mf-expo:** **Mail management** — **Quick setup** (provider presets: Gmail, Yandex, Outlook/Microsoft 365, iCloud, Custom), mailbox email + password, optional **Advanced** host/TLS fields; clearer validation before test send when DB SMTP is off or unsaved.
- **mf-expo:** **OTP email** admin screen (`/admin-otp-mail`) and **Forgot password** flow (`/forgot-password`, link on sign-in); **`mfGoAuth.requestPasswordReset`** / **`resetPasswordWithOtp`**; i18n **EN + TR** (`settings.adminOtpMail`, `auth.forgotPassword`).

### Fixed

- **mf-go:** Access JWTs now include a unique **`jti`** (`RegisteredClaims.ID`) so a new login after **logout** cannot produce the **same HS256 string** in the same second as the blacklisted token (which previously made **`me`** / authenticated requests fail until time moved to the next second).

- **mf-go:** **`go.mod`** **`toolchain go1.25.8`** so **`make security-scan`** / **`govulncheck`** pass on patched stdlib (local `go` may auto-download this toolchain).

- **mf-go:** Postman — **`masterfabric.environment.json`** token-related vars use type **`default`** (not **`secret`**) so **Newman** persists **`accessToken`** / **`refreshToken`** across requests; **Security probes** URL drops empty **`path`** so the request hits **`/graphql`** not **`/graphql/`**.

- **mf-go:** **`adminChangeRole`** now revokes the target user's access tokens and refresh tokens (same coordinator as suspend/inactive) so JWT **role** claims cannot outlive a **demotion** from ADMIN/MODERATOR or misrepresent privilege until natural expiry.

- **mf-expo:** **Sign-in / sign-up / forgot-password** — **`AppBarScaffold`** uses **top-only** safe area; **`ScrollView`** adds **`paddingBottom: safeAreaInsets.bottom + xl`** so the primary action and footer stay above the home indicator / system nav and are not clipped when the form is long.

- **mf-go:** **`requestOTP`** idempotent branch (reuse pending OTP) returned **`channel`** from Postgres while **`Send`** could use the **SMTP bridge** — clients could show **ADMIN_PANEL** for a code that was **emailed**; responses now use **`StorageChannel`** and **`otp_codes.channel`** is updated when it differs.

- **mf-expo:** Settings **OTP** toggle — `requestOTP` errors (SMTP failure, rate limit, admin disabled email) no longer open the code entry sheet with no code; show an error bottom sheet instead. GraphQL OTP error codes map to **EN + TR** (`errors.otp.*`). When the server returns channel **ADMIN_PANEL**, the OTP sheet explains the code is visible to admins, not emailed. The Settings **OTP** row copy is localized (**`settings.otpRow`**) and notes that codes are often **admin-panel only** until the server enables email OTP + SMTP.
- **mf-go:** **Forgot password** — **`PASSWORD_RESET`** uses **effective SMTP** whenever it is configured, **independent of `OTP_DELIVERY`** (so mail works even when login OTP stays `admin_panel`); wrapped via `WithPasswordResetPreferSMTP`. Docs: **OTP_CONFIGURATION.md** §5.
- **mf-go:** **Forgot password / OTP request** — case-insensitive email lookup for reset; **re-attempt SMTP delivery** when a pending OTP already exists (fixes “tap again but no email” after a failed send); **expire** a newly created OTP if delivery fails so the next request can create a fresh code; log delivery failures server-side. **mf-expo:** forgot-password flow normalizes email (trim + lowercase); clearer EN/TR hints for mail/OTP server requirements.
- **mf-expo:** Admin **User management** — user detail bottom sheet **scrolls** reliably: tap-to-close is a full-screen **backdrop** `Pressable` **sibling** of the sheet (sheet content is no longer a child of that `Pressable`), and the scroll area uses a **fixed height** from the sheet max height minus header/footer chrome so long profile / todos / OTP content is reachable. (**GFG-45**)

## [1.0.0] - 2026-03-29

**Author:** MasterFabric contributors

Stable **1.0.0** release of **mf-expo** and **mf-go** on this branch: organization membership and invitations (leave, revoke, resend, `REVOKED` status), home and org-detail UX (news thumbnails, placeholders, pull-to-refresh, skeletons), org team chat and message subscription, profile address management and account deletion impact, settings App Store and Cursor banners, production logging and console stripping, todo access tied to IAM and org membership, and push/FCM/OneSignal fixes on iOS and Android.

### Added

- **mf-expo:** Organization detail — **pull-to-refresh** and a **loading skeleton** (members, sent invitations, and surrounding sections) instead of a centered spinner (**GFG-25**).
- **mf-go:** Redis **read-through cache** for public **`appSettings`** (single snapshot key), **`productRelease`**, and authenticated **`mySettings`**; keys are cleared on **`adminUpsertAppSetting`**, **`adminUpdateProductRelease`**, and **`updateUserSettings`**. Env **`CACHE_PRODUCT_RELEASE_TTL`** (default **`5m`**); **`CACHE_USER_SETTINGS_TTL`**, **`CACHE_APP_SETTINGS_TTL`**, and **`CACHE_KEY_PREFIX`** now apply to these paths (when Redis is available; otherwise behavior stays Postgres-only).
- **mf-go:** In-app **feedback** — migration `011_feedback_threads` (`feedback_threads`, `feedback_messages`); GraphQL **`myFeedbackThreads`**, **`submitFeedback`**, **`adminFeedbackThreads`**, **`adminReplyToFeedback`**, **`adminDeleteFeedbackThread`**; Postman folder **Feedback (GFG-24)** (**Linear GFG-24**).
- **mf-go:** **Guest feedback** — migration **`012_feedback_guest_contact`** (nullable `user_id`, `guest_contact_email`); unauthenticated **`submitFeedback`** requires **`contactEmail`**; thread exposes **`userID`** (null) and **`contactEmail`** (**GFG-24**).
- **mf-go:** Migration **`013_public_legal_markdown_defaults`** seeds **`public_help_faq_markdown`** and **`public_privacy_policy_markdown`** with English Markdown defaults (**`is_public: true`**); **`ON CONFLICT`** only fills **empty** existing values so admin-edited copy is preserved.
- **mf-expo:** Settings **Help & FAQ** and **Privacy Policy** in-app screens load public Markdown from mf-go **`appSettings`** keys **`public_help_faq_markdown`** / **`public_privacy_policy_markdown`**. **Send feedback** is available to **signed-out** users (email + **`submitFeedback.contactEmail`**) and signed-in users; bottom sheet + **`/feedback`** timeline; admins **`/admin-feedback`** to reply or **delete** a thread (confirm); **`/admin-legal`** (Settings → Admin → **Help & legal copy**) edits public Markdown via **`adminUpsertAppSetting`** (**GFG-24**). i18n EN + TR.
- **mf-go:** Org invitations — **`REVOKED`** status (migration `010_invitation_revoked_status`); mutations **`revokeOrganizationInvitation`** and **`resendOrganizationInvitation`** (admin/owner); Postman requests (**GFG-22**).
- **mf-expo:** Organization detail **sent invitations**: **Revoke** / **Resend** via bottom sheet for **pending** invites; status label **Revoked**; i18n EN + TR (**GFG-22**).
- **mf-go:** GraphQL `leaveOrganization(organizationId)` — non-owner members remove their own membership; **owners** are rejected until ownership transfer exists (**GFG-21**).
- **mf-expo:** Organization detail **member row** actions use **bottom sheets** (invite/edit-org style): admins/owners manage others (suspend / activate / remove with confirm); **non-owners** can **leave** the org; **owners** see an explanatory sheet (cannot leave via app). Postman: **Remove Organization Member**, **Leave Organization**; i18n EN + TR (**GFG-21**).
- **mf-expo:** Settings adds a **Made with Cursor** banner (`SettingsCursorBanner` at the bottom of the screen; on **iOS**, directly under the App Store banner): two-line copy, theme-aware card (`settingsCardBackground`, borders, `labelText` / `bodyText`, `useTheme().isDark` including **System** appearance), i18n **`settings.cursorBadge`** (EN + TR), bundled **`cursor-settings-badge-logo.png`** (raster from **https://cursor.com** `logo.svg`); tap opens **https://cursor.com** (GFG-16).
- **mf-expo:** Settings screen includes a bottom **App Store banner** (**iOS only**; Android/web hide it) styled like the Figma community **Banner Store Button** frame (white rounded badge, two-line copy + Apple logo); set **`EXPO_PUBLIC_IOS_APP_STORE_ID`** for a direct **`itms-apps`** link, otherwise App Store search by app name.
- **mf-expo:** Organization detail shows **`logoURL`** at the top of the screen when set; home header shows an org avatar (logo or initials) for the first membership when signed in, linking to that organization.
- **mf-go:** GraphQL `myAccountDeletionImpact` query — authenticated users see the same relational preview as admins (counts for todos, org memberships, owned organizations, addresses, devices, sessions, org chat/news authored rows, OTP history, etc.) before calling `deleteAccount`.
- **mf-go:** `adminUserDeletionImpact` now includes `organizationMessageAuthoredCount`, `organizationNewsAuthoredCount`, and `otpCodeHistoryCount`.

### Changed

- **mf-expo:** Organization detail **pull-to-refresh** keeps the spinner/skeleton visible for at least **600ms**, and **Members** / **Sent invitations** lists show **inline skeleton rows** while refreshing (GFG-25).
- **mf-expo:** **Feedback** list, conversation, and **Admin feedback** show a compact **thread ID** pill (8-character reference + `support.feedback.threadIdBadge` / a11y string); **My feedback** list and thread use **`useThemeColors`** for **System** appearance; admin reply button label uses **`foregroundOnTint`** for contrast on **`colors.tint`**.
- **mf-expo:** Home **organization news** rows without an **imageURL** use a softer neutral placeholder (muted **image-outline** on a light gray fill, hairline border; no duplicate newspaper icon or tint accent stripe) with i18n **`home.orgNews.placeholderA11y`** (**GFG-20**).
- **mf-expo:** Home **organization news** list thumbnails are larger (**92×108** vs **52×52**) so cover images read more clearly before opening the sheet; the detail sheet **hero** image uses **220–340**pt min/max height (**GFG-19**).
- **mf-expo:** mf-go auth screen removes the Sign In / Sign Up tab strip; switching modes uses the existing footer links only. Email and display-name fields get a trailing clear control when non-empty; password uses a trailing show/hide toggle (`GFG-15`).
- **mf-go:** Server uses `slog.SetDefault` with the configured handler so all package-level `slog` calls respect `LOG_LEVEL` and `LOG_FORMAT`. When `ENV=production` and `LOG_LEVEL` is unset, the default is **warn** (quieter cloud logs); per-request `/graphql` access lines are **debug**; admin-panel OTP delivery no longer writes OTP codes to process logs.
- **mf-expo:** Release bundles strip `console.*` via Babel (`babel-plugin-transform-remove-console`) so production builds do not emit debug console noise; the in-app logger service skips printing to the console when not in `__DEV__`.

- **mf-expo:** Tab bar and headers use **solid** theme colors; **`AppBarScaffold`** lays out the app bar in a normal column (not overlaid on scroll content). Home tab uses the same pattern. Onboarding uses **`BrandPanel`** / **`ThemedSurface`** naming (no blur). Modal overlays use a dimmed scrim only. Direct dependencies **`expo-blur`** and **`expo-glass-effect`** removed (native projects should run **`npx pod-install`** / rebuild after pull).
- **mf-expo (masterfabric-expo-core):** `tabBarBackground` light/dark/system tokens are fully opaque (`#FFFFFF` / `#1C1C1E`) so the bar matches opaque chrome.
- **mf-expo:** Profile delete-account section lists impact item-by-item when the backend supports `myAccountDeletionImpact`; confirmation sheet includes a scrollable summary.
- **mf-expo:** Home **organization news** shows **`imageURL`** thumbnails when set, a **left lead** with tint accent and icon when there is no image, and opens a **bottom sheet** (full copy, hero image, optional rich metadata) on row tap instead of navigating to the organization screen.

### Fixed

- **mf-expo (iOS):** OneSignal **Notification Service Extension** `CFBundleShortVersionString` aligned with the main app (**1.0.0**) to clear the Xcode version-mismatch warning and avoid extension-related install/runtime issues; **organization** stack route `dangerouslySingular` now always returns a **string** id (never a param array) so React Navigation native stack does not receive an invalid route key.
- **mf-expo:** Organization detail **loading skeleton** is easy to miss when the API responds instantly; it now stays on screen at least **450ms**, uses **theme divider / surface** colors (not ultra-light rgba), and **hairline borders** on placeholder cards so members/invites blocks read clearly in light and dark mode (**GFG-25**).
- **mf-go:** **Passive/suspended** organization members no longer **list**, **fetch**, **update**, or **delete** **organization-scoped** todos (SQL now requires **`membership_status = 'active'`** on **`organization_members`**, matching **`IsMember`**); personal todos (`organization_id` null) are unchanged.
- **mf-go / mf-expo:** **Inactive** or **suspended** IAM users no longer read or mutate **todos** over GraphQL while a stale access token is still valid; responses use **`ACCOUNT_DISABLED`**, and the app treats that like an auth error (clears token + session handler) (**GFG-23**).
- **mf-expo:** Organization detail **logo** is a **circle** (fixed diameter, cover fit) so it matches the home org chip and reads as an avatar, instead of a wide rounded rectangle.
- **mf-expo:** Org chat composer **Send** control matches the message field **min height** (shared 44pt row), centered label, no extra bottom offset; Android uses tighter font padding so the two controls align symmetrically.
- **mf-expo:** Settings scroll padding respects the **absolute** bottom tab bar (`BottomTabBarHeightContext` + gap) so the app store banner and other footer content stay above the tab bar.

## [0.1.0] - 2025-03-23

**Author:** MasterFabric contributors

### Added

- **mf-go:** GraphQL `deleteMyAddress(id)` mutation — authenticated user removes one of their saved addresses (`ADDRESS_NOT_FOUND` if id is missing or not owned).
- **mf-go:** GraphQL `UserProfile.addresses` — non-null list of the user’s saved addresses (field resolver; same data as `myAddresses` for the authenticated profile).
- **mf-expo:** Profile screen — list, add, edit, and delete saved addresses (`upsertAddress`, `deleteMyAddress`); default address toggle; loads addresses via `me.addresses` with fallback to `myAddresses` on older backends.
- **mf-go:** Migration `009_organization_features` — organization profile fields (`description`, `logo_url`, `website_url`, `contact_email`), member `membership_status` (active/suspended), `organization_news`, `organization_messages`; GraphQL `organization`, `updateOrganization`, `removeOrganizationMember`, `setOrganizationMemberSuspended`, org news CRUD, org messages + `postOrganizationMessage`, subscription `organizationMessageCreated`; in-memory broadcaster for real-time org chat.
- **mf-expo:** Org chat tab (`org-messages`) when the user has organizations; home greeting shows organization name(s); organization detail screen with business-card fields, news (owner-managed), member suspend/remove for admin/owner, link to team chat; `graphql-ws` subscription for org messages.
- **mf-go:** Postman requests extended under Organizations for new queries/mutations.
- **mf-go:** Public GraphQL `productRelease` query and admin-only `adminUpdateProductRelease` mutation; data stored in `product_release` table.
- **mf-go:** Generic binary metadata in `internal/shared/version` — override with `MF_BUILD_VERSION`, `MF_SERVICE_NAME`, or `-ldflags`; health and `/health` JSON include `serviceName`.
- **mf-expo:** Admin screen to edit published version and Markdown changelog; About sheet loads `productRelease` for all users.

### Changed

- **monorepo CLI:** **`npm run start-all`** stays attached after services start; **Ctrl+C** in that terminal runs the same teardown as **`npm run stop-all`**. Use **`npm run start-all:detach`** or **`--detach`** when you want the CLI to exit immediately (previous default).
- **mf-go:** Local **pgweb** (Postgres UI) now runs in **`deployments/docker-compose.yml`** on host port **`5001`** (was a separate host install on 8082). `make docker-infra` / `docker-up` include the **pgweb** service; monorepo **start-all** URLs and stop port cleanup use **5001**.
- **mf-go:** `deleteTodo` uses the same access rules as `myTodos` / `updateTodo` (owner, assignee, or organization member). Missing or inaccessible todos return GraphQL `TODO_NOT_FOUND` instead of a generic `INTERNAL_ERROR`.
- **mf-go:** Startup log message uses configurable service name instead of a hard-coded binary name.
