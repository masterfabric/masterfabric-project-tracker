# MasterFabric Go Basic

A mobile-backend Go service built with Clean/Hexagonal Architecture and DDD principles. Exposes a **GraphQL API** for Auth, User profile, Settings, **OTP** (email / WhatsApp / Telegram / admin panel), and related domains, plus a **CLI** (`masterfabric_go`) for SDK code generation.

---

## Table of Contents

- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Quick Start](#quick-start)
- [Environment Variables](#environment-variables)
  - [Refresh session cap (`AUTH_MAX_REFRESH_SESSIONS_PER_USER`)](#refresh-session-cap-auth_max_refresh_sessions_per_user)
- [OTP delivery (email, WhatsApp, Telegram)](#otp-delivery-email-whatsapp-telegram)
- [CLI — `masterfabric_go`](#cli--masterfabric_go)
- [GraphQL API Reference](#graphql-api-reference)
  - [Auth](#auth)
  - [User](#user--requires-bearer-token)
  - [Settings](#settings)
  - [Device](#device--requires-bearer-token)
  - [Notifications](#notifications)
  - [Todos](#todos--requires-bearer-token)
  - [Organizations](#organizations--requires-bearer-token)
  - [Admin](#admin--requires-bearer-token--admin-role)
  - [Teardown](#teardown)
  - [Error format](#error-format)
- [Postman Collection](#postman-collection)
- [Makefile Reference](#makefile-reference)
- [Deployment](#deployment)
- [Architecture](#architecture)
- [Mobile Client — Flutter](#mobile-client--flutter)
- [Adding a New Feature](#adding-a-new-feature)

---

## Tech Stack

| Concern        | Library / Tool                          |
|----------------|-----------------------------------------|
| Language       | Go 1.24+ (**toolchain** **1.25.x** for `govulncheck` / CI parity) |
| API            | GraphQL — [gqlgen](https://gqlgen.com)  |
| Router         | go-chi/chi/v5                           |
| Database       | PostgreSQL — pgx/v5 + pgxpool           |
| Cache          | Redis — go-redis/v9                     |
| Message Queue  | RabbitMQ — amqp091-go                   |
| Auth           | JWT (golang-jwt/jwt/v5) + bcrypt        |
| CLI            | cobra (spf13/cobra)                     |
| Migrations     | golang-migrate/migrate/v4               |

---

## Project Structure

```
cmd/
  server/main.go                    # HTTP server entry point + DI wiring
  masterfabric_go/main.go           # Code-generation CLI entry point
internal/
  domain/
    iam/
      model/                        # User, Role entities + enums
      repository/                   # UserRepository interface
      event/                        # Domain events (UserRegistered, etc.)
      policy/                       # RBAC helpers: RequireAdmin, RequireRole, HasRole
    settings/
      model/                        # UserSettings, AppSettings entities
      repository/                   # Repository interfaces
      event/                        # Domain events
  application/
    auth/
      usecase/                      # Register, Login, RefreshTokens, Logout
      dto/                          # Auth request/response DTOs
    user/
      usecase/                      # GetProfile, UpdateProfile, DeleteAccount
      dto/                          # User request/response DTOs
    settings/
      usecase/                      # GetMySettings, UpdateMySettings, GetAppSettings
      dto/                          # Settings request/response DTOs
    admin/
      usecase/                      # ListUsers, GetUserByID, SuspendUser, ChangeRole
      dto/                          # Admin request/response DTOs
    device/
      usecase/                      # MyDevices, RegisterDevice
      dto/                          # Device request/response DTOs
    notification/
      usecase/                      # ListNotifications, MarkRead, AdminCreate
      dto/                          # Notification request/response DTOs
    todos/
      usecase/                      # MyTodos, CreateTodo, UpdateTodo, DeleteTodo
      dto/                          # Todo request/response DTOs
    organization/
      usecase/                      # MyOrganizations, CreateOrg, Invite, Accept/Decline
      dto/                          # Organization request/response DTOs
    otp/
      usecase/                      # RequestOTP, VerifyOTP, admin OTP lists
      dto/                          # OTP request/response DTOs
  infrastructure/
    otp/                            # SMTP, WhatsApp Cloud, Telegram Bot, delivery wiring
    postgres/                       # pgx repository implementations + migrations
    redis/                          # Redis client helpers
    rabbitmq/                       # RabbitMQ event bus
    auth/                           # JWT service + bcrypt helper
    graphql/
      resolver/                     # gqlgen resolvers (one file per domain)
      schema/                       # GraphQL schema files — source of truth
  codegen/
    parser/schema_parser.go         # GraphQL schema parser
    dart/                           # Dart SDK generator
  shared/
    config/                         # Viper / env config
    logger/                         # slog structured logger
    middleware/                     # Auth + RequestID middleware
    errors/                         # Domain error sentinel values
    events/                         # EventBus interface
    health/                         # Liveness + readiness check handlers
    database/                       # Postgres pool helper
    cache/                          # Redis client helper
    version/                        # Service name/version constants
deployments/
  docker-compose.yml                # Postgres, Redis, RabbitMQ, Mailpit, App
  Dockerfile
postman/
  masterfabric.collection.json      # Postman collection (all requests + tests)
  masterfabric.environment.json     # Postman environment (local defaults)
sdk/
  dart_go_api/                      # GENERATED — do not edit by hand
```

---

## Quick Start

### 1. Prerequisites

- Go 1.24+ (repo pins **toolchain go1.25.x** in `go.mod` for vuln scans)
- Docker + Docker Compose

### 2. Start infrastructure

```bash
make docker-infra
# postgres (5433), redis (6380), rabbitmq (5673 / 15673), pgAdmin (5001), Mailpit SMTP 1025 + UI :8025
```

Or start everything (infra + **Mailpit** + app container — good for **OTP email** dev):

```bash
make docker-up
# Mailpit: SMTP localhost:1025, UI http://localhost:8025 (see deployments/docker-compose.yml)
```

**Hot reload vs Docker app:** `docker-compose` builds the Go binary **once** inside the image. Editing code on your machine does **not** restart that container. For day-to-day API work, start **infra only** (`make docker-infra` or `make docker-up` and stop the `app` service if you use the full stack), load `.env`, then run **`make dev`** on the host so [Air](https://github.com/air-verse/air) rebuilds and restarts the server when you save.

### 3. Configure environment

```bash
cp .env.example .env
# edit .env if needed — defaults work with docker-infra targets
```

### 4. Run the server

```bash
# recommended for local development — rebuilds on save (Air, pinned via go run; no separate install)
make dev

# one-shot: build binary and run (no reload on file changes)
make run
```

Server starts at `http://localhost:8080`.

| Endpoint              | Description                    |
|-----------------------|--------------------------------|
| `GET /health`         | Liveness probe                 |
| `GET /health/ready`   | Readiness probe (DB + Redis)   |
| `POST /graphql`       | GraphQL endpoint               |
| `GET /graphql`        | GraphQL Playground (dev only)  |

With **`make docker-infra`** or **`make docker-up`**, **pgAdmin** is at **`http://localhost:5001`**. Log in with **`pgadmin-dev@example.com`** / **`masterfabric`**; the server **mf-go Postgres (compose)** is pre-registered (see **`deployments/pgadmin/README.md`**).

---

## Environment Variables

Copy `.env.example` to `.env`. All variables and their defaults:

```env
# Server
SERVER_HOST=0.0.0.0
SERVER_PORT=8080
SERVER_READ_TIMEOUT=15s
SERVER_WRITE_TIMEOUT=15s
SERVER_IDLE_TIMEOUT=60s

# PostgreSQL
DATABASE_DSN=postgres://masterfabric:masterfabric@localhost:5433/masterfabric_basic?sslmode=disable
DATABASE_MAX_CONNS=20
DATABASE_MIN_CONNS=2
DATABASE_MAX_CONN_IDLE=5m

# Redis
REDIS_ADDR=localhost:6380
REDIS_PASSWORD=
# When using Redis from deployments/docker-compose.yml, set REDIS_PASSWORD to the same value as
# the server's --requirepass (see compose file; dev example: devredis). Host `make dev` with an
# empty password against that Redis → /health/ready reports Redis failure (NOAUTH).
REDIS_DB=0

# RabbitMQ
RABBITMQ_URL=amqp://guest:guest@localhost:5673/
RABBITMQ_ENABLED=true
RABBITMQ_EXCHANGE=masterfabric.events

# JWT — change JWT_SECRET in production (min 32 chars)
JWT_SECRET=change-me-in-production-at-least-32-chars
JWT_ACCESS_TTL=5m
JWT_REFRESH_TTL=168h
# Cap concurrent refresh-token sessions per user (Redis). See § Refresh session cap below.
AUTH_MAX_REFRESH_SESSIONS_PER_USER=10

# Logging: debug | info | warn | error
LOG_LEVEL=info
LOG_FORMAT=json

# GraphQL — disable introspection in production
GRAPHQL_INTROSPECTION=true

# OTP delivery: admin_panel | email | both | whatsapp | whatsapp_both | telegram | telegram_both
OTP_DELIVERY=admin_panel
OTP_APP_NAME=MasterFabric
# When using email/both, set SMTP_* . For WhatsApp/Telegram see .env.example.
# Docker Compose includes Mailpit on :1025 / UI :8025 — see deployments/docker-compose.yml.
```

### Refresh session cap (`AUTH_MAX_REFRESH_SESSIONS_PER_USER`)

Each successful **login** or **refresh** stores a new refresh token in Redis. The server enforces a **maximum number of concurrent refresh-token keys per user** (default **10** via `AUTH_MAX_REFRESH_SESSIONS_PER_USER`). When a new session would exceed the cap, it **deletes the oldest keys** (shortest remaining TTL first). Devices holding those revoked refresh tokens then receive **`TOKEN_INVALID`** on the next refresh — the “surprise logout” called out in ops reviews.

- **`0`** disables the cap (unlimited concurrent refresh sessions).
- **Production / Azure Container Apps (or any host):** If legitimate users often exceed **10** signed-in clients, **raise the value** in environment configuration rather than chasing false-positive auth bugs. Evictions emit a structured **`WARN`** log with **`event=refresh_session_eviction`**, **`user_id`**, **`evicted`**, **`max_sessions`**, **`session_count_before`** — visible at the default production **`LOG_LEVEL=warn`** (Azure Monitor / Log Analytics).
- **Not Azure AD:** This setting applies to **mf-go’s own** refresh tokens in Redis, not Microsoft Entra ID token limits.

### OTP delivery (email, WhatsApp, Telegram)

- **`email` / `both`**: effective **`SMTP_*` in `.env`** or **admin-managed `system_mail_smtp`** (GraphQL) when enabled + complete — see **`docs/OTP_CONFIGURATION.md`** §3b. Set **`MAIL_SMTP_ENCRYPTION_KEY`** (32-byte AES) to encrypt DB-stored mailbox passwords. **Mailpit** locally: `SMTP_HOST=localhost`, `SMTP_PORT=1025`, `SMTP_FROM=noreply@local.test`, `SMTP_PLAIN_NO_TLS=true`. Port **587** = STARTTLS; **465** = implicit TLS. Missing email → `OTP_NO_EMAIL`.
- **`whatsapp` / `whatsapp_both`**: Meta **WhatsApp Cloud API** — `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, optional `WHATSAPP_API_VERSION` (default `v21.0`). User **phone** on profile must include **country code** (digits only). See `docs/SECURITY.md` for template limitations.
- **`telegram` / `telegram_both`**: **Telegram Bot** — `TELEGRAM_BOT_TOKEN`. User sets **`telegramChatId`** via GraphQL `updateProfile` (from @userinfobot or your bot).

Full variable list: **`.env.example`**. Production checklist: **`docs/SECURITY.md`**.  
Step-by-step enable/disable + **any SMTP provider**: **`docs/OTP_CONFIGURATION.md`**.

---

## CLI — `masterfabric_go`

The `masterfabric_go` binary is a code-generation tool. It reads the GraphQL schema and generates typed client SDKs for target platforms.

### Build the CLI

```bash
make build-cli
# produces bin/masterfabric_go
```

Or manually:

```bash
go build -o bin/masterfabric_go ./cmd/masterfabric_go
```

### Commands

#### `generate dart`

Generate a Dart SDK package from the GraphQL schema.

```bash
# default paths (schema: internal/infrastructure/graphql/schema, output: sdk/dart_go_api)
./bin/masterfabric_go generate dart

# explicit paths
./bin/masterfabric_go generate dart \
  --schema internal/infrastructure/graphql/schema \
  --output sdk/dart_go_api
```

Via Makefile:

```bash
make generate-dart   # builds CLI then runs generate dart
```

**Output** — `sdk/dart_go_api/` (never edit by hand):

```
sdk/dart_go_api/
  pubspec.yaml
  lib/
    dart_go_api.dart          # barrel export
    src/
      models/                 # enums.dart, inputs.dart, models.dart
      queries/                # documents.dart (gql DocumentNodes)
      client/                 # masterfabric_client.dart
```

> Every time a `.graphqls` schema file changes, re-run `make generate-dart` to keep the SDK in sync.

#### Adding a new SDK target (e.g. Swift)

1. Create `internal/codegen/swift/` mirroring the `dart/` package structure
2. Implement `Generate(schemaDir, outputDir string) error` as the entry point
3. Register the command in `cmd/masterfabric_go/main.go`
4. Add `make generate-swift` to the `Makefile`
5. Output goes to `sdk/swift_go_api/`

---

## GraphQL API Reference

All requests go to `POST /graphql` with `Content-Type: application/json`.  
Authenticated requests require `Authorization: Bearer <accessToken>`.

### Auth

#### Register

```graphql
mutation Register($input: RegisterInput!) {
  register(input: $input) {
    accessToken
    refreshToken
    expiresIn
    user { id email displayName avatarURL role }
  }
}
```

```json
{ "input": { "email": "user@example.com", "password": "P@ssword1234", "displayName": "Jane" } }
```

#### Login

```graphql
mutation Login($input: LoginInput!) {
  login(input: $input) {
    accessToken
    refreshToken
    expiresIn
    user { id email displayName avatarURL role }
  }
}
```

```json
{ "input": { "email": "user@example.com", "password": "P@ssword1234" } }
```

#### Refresh Tokens

```graphql
mutation RefreshTokens($input: RefreshInput!) {
  refreshTokens(input: $input) {
    accessToken
    refreshToken
    expiresIn
    user { id email displayName avatarURL role }
  }
}
```

```json
{ "input": { "userID": "<uuid>", "refreshToken": "<token>" } }
```

#### Refresh token rotation (API + device testing)

Each successful `refreshTokens` call **consumes** the presented refresh and returns a **new** refresh. The previous refresh cannot be used again. That is by design (rotation in Redis; see [Architecture — Auth flow](#auth-flow)).

**Parallel testing gotcha:** If you hit the API with **curl, Postman, or Newman** using the same user the **mobile app** is signed into, whichever client refreshes **first** invalidates the other’s stored refresh. The other client will see `TOKEN_INVALID` on its next refresh until the user **logs in again** (or you stop sharing one user across tools).

Mitigations: use **different test accounts** for API vs. device, or **re-login** on one side after testing the other. See **[docs/REFRESH_TOKEN_TESTING.md](docs/REFRESH_TOKEN_TESTING.md)** for a short runbook.

#### Logout

```graphql
mutation Logout($input: LogoutInput!) {
  logout(input: $input)
}
```

```json
{ "input": { "userID": "<uuid>", "accessToken": "<token>", "refreshToken": "<token>" } }
```

Blacklists the access token in Redis and deletes the refresh token.

---

### User  _(requires Bearer token)_

#### Get Profile

```graphql
query Me {
  me { id email displayName avatarURL bio status role createdAt updatedAt }
}
```

#### Update Profile

```graphql
mutation UpdateProfile($input: UpdateProfileInput!) {
  updateProfile(input: $input) {
    id email displayName avatarURL bio status role createdAt updatedAt
  }
}
```

```json
{ "input": { "displayName": "New Name", "avatarURL": "https://...", "bio": "Hello!" } }
```

All fields are optional — only provided fields are changed.

#### Delete Account

```graphql
mutation DeleteAccount {
  deleteAccount
}
```

---

### Settings

#### My Settings  _(requires Bearer token)_

```graphql
query MySettings {
  mySettings { id userID notificationsOn theme language timezone updatedAt }
}
```

#### Update My Settings  _(requires Bearer token)_

```graphql
mutation UpdateMySettings($input: UserSettingsInput!) {
  updateMySettings(input: $input) {
    id userID notificationsOn theme language timezone updatedAt
  }
}
```

```json
{ "input": { "notificationsOn": true, "theme": "DARK", "language": "en", "timezone": "UTC" } }
```

Available `Theme` values: `LIGHT` | `DARK` | `SYSTEM`

#### App Settings  _(public)_

```graphql
query AppSettings {
  appSettings { key value description }
}
```

---

### Device  _(requires Bearer token)_

#### My Devices

```graphql
query MyDevices {
  myDevices {
    id userID deviceId platform deviceName model brand osName osVersion appName appVersion appBuild createdAt updatedAt
  }
}
```

#### Register Device

```graphql
mutation RegisterDevice($input: RegisterDeviceInput!) {
  registerDevice(input: $input) {
    id deviceId platform deviceName createdAt
  }
}
```

```json
{ "input": { "deviceId": "device-123", "platform": "ios", "deviceName": "iPhone 15" } }
```

---

### Notifications

#### List Notifications  _(optional auth — read status when authenticated)_

```graphql
query Notifications($language: String, $limit: Int) {
  notifications(language: $language, limit: $limit) {
    id title subtitle message type category isRead createdAt
  }
}
```

#### Mark Notification Read  _(requires Bearer token)_

```graphql
mutation MarkNotificationRead($id: UUID!) {
  markNotificationRead(id: $id)
}
```

#### Mark All Notifications Read  _(requires Bearer token)_

```graphql
mutation MarkAllNotificationsRead {
  markAllNotificationsRead
}
```

#### Admin Create Notification  _(requires Bearer token + `ADMIN` role)_

```graphql
mutation AdminCreateNotification($input: CreateNotificationInput!) {
  adminCreateNotification(input: $input) {
    id title message type createdAt
  }
}
```

```json
{ "input": { "title": "Announcement", "message": "Hello!", "type": "info" } }
```

---

### Todos  _(requires Bearer token)_

#### My Todos

```graphql
query MyTodos {
  myTodos {
    id userID title completed organizationID assignedToUserID createdAt updatedAt
  }
}
```

#### Create Todo

```graphql
mutation CreateTodo($input: CreateTodoInput!) {
  createTodo(input: $input) {
    id title completed createdAt
  }
}
```

```json
{ "input": { "title": "Buy milk", "completed": false } }
```

#### Update Todo

```graphql
mutation UpdateTodo($input: UpdateTodoInput!) {
  updateTodo(input: $input) {
    id title completed updatedAt
  }
}
```

```json
{ "input": { "id": "<uuid>", "title": "Buy milk and eggs", "completed": true } }
```

#### Delete Todo

```graphql
mutation DeleteTodo($id: UUID!) {
  deleteTodo(id: $id)
}
```

---

### Organizations  _(requires Bearer token)_

#### My Organizations

```graphql
query MyOrganizations {
  myOrganizations {
    id name ownerUserID createdAt updatedAt
  }
}
```

#### My Pending Invitations

```graphql
query MyPendingInvitations {
  myPendingInvitations {
    id organizationID inviterID inviteeEmail status createdAt
  }
}
```

#### Create Organization

```graphql
mutation CreateOrganization($input: CreateOrganizationInput!) {
  createOrganization(input: $input) {
    id name ownerUserID createdAt
  }
}
```

```json
{ "input": { "name": "My Team" } }
```

#### Invite to Organization

```graphql
mutation InviteToOrganization($input: InviteToOrganizationInput!) {
  inviteToOrganization(input: $input) {
    id organizationID inviteeEmail status
  }
}
```

```json
{ "input": { "organizationId": "<uuid>", "inviteeEmail": "user@example.com" } }
```

#### Accept / Decline Invitation

```graphql
mutation AcceptInvitation($invitationId: UUID!) {
  acceptInvitation(invitationId: $invitationId) { id status }
}
mutation DeclineInvitation($invitationId: UUID!) {
  declineInvitation(invitationId: $invitationId) { id status }
}
```

---

### Admin  _(requires Bearer token + `ADMIN` role)_

All admin operations are protected by both authentication and role authorisation. A valid token with role `USER` or `MODERATOR` receives a `FORBIDDEN` error, not `UNAUTHENTICATED`.

#### List Users

```graphql
query AdminListUsers($page: Int, $pageSize: Int) {
  adminUsers(page: $page, pageSize: $pageSize) {
    users { id email displayName role status createdAt }
    totalCount
    page
    pageSize
  }
}
```

```json
{ "page": 1, "pageSize": 10 }
```

The test script saves the first returned user ID to `adminTargetUserId` in the environment for subsequent admin requests.

#### Get User By ID

```graphql
query AdminGetUser($id: UUID!) {
  adminUser(id: $id) {
    id email displayName avatarURL bio status role createdAt updatedAt
  }
}
```

```json
{ "id": "{{adminTargetUserId}}" }
```

#### Change Role

```graphql
mutation AdminChangeRole($id: UUID!, $role: UserRole!) {
  adminChangeRole(id: $id, role: $role) {
    id email role updatedAt
  }
}
```

```json
{ "id": "{{adminTargetUserId}}", "role": "MODERATOR" }
```

Available `UserRole` values: `ADMIN` | `MODERATOR` | `USER`

#### Suspend / Reactivate User

```graphql
mutation AdminSuspendUser($id: UUID!, $suspend: Boolean!) {
  adminSuspendUser(id: $id, suspend: $suspend) {
    id email status updatedAt
  }
}
```

```json
{ "id": "{{adminTargetUserId}}", "suspend": true }
```

Pass `"suspend": false` to reactivate. The operation is **idempotent** — suspending an already-suspended user returns `SUSPENDED` without error.

**Forced logout when suspending or setting inactive:** The server (1) sets Redis `mf:user:access_revoked_at:<userId>` so existing access JWTs fail validation until the key TTL elapses, (2) deletes all refresh tokens for that user, (3) deletes `user_sessions` rows, and (4) inserts a **user message** (`warning`) so the mobile snackbar/subscription can notify them. Reactivating (`suspend: false` or `adminSetUserStatus` → `ACTIVE`) clears the revocation marker. **Redis** should be enabled in production for immediate token invalidation; without Redis, only refresh is blocked after DB status changes and access tokens live until natural expiry.

#### Set user status (active / inactive / suspended)

```graphql
mutation AdminSetUserStatus($id: UUID!, $status: UserStatus!) {
  adminSetUserStatus(id: $id, status: $status) {
    id email status role updatedAt
  }
}
```

`UserStatus`: `ACTIVE` | `INACTIVE` | `SUSPENDED`. Same forced-logout + user-message behaviour applies when moving to `INACTIVE` or `SUSPENDED`.

#### User deletion impact (preview)

Use before `adminDeleteUser` to show what PostgreSQL `ON DELETE CASCADE` / `SET NULL` will affect (todos, org memberships, owned orgs, devices, etc.):

```graphql
query AdminUserDeletionImpact($id: UUID!) {
  adminUserDeletionImpact(id: $id) {
    email
    ownedTodoCount
    organizationMembershipCount
    ownedOrganizations { name otherMemberCount }
    deviceCount
    hasUserSettings
  }
}
```

#### Permanently delete user

```graphql
mutation AdminDeleteUser($id: UUID!) {
  adminDeleteUser(id: $id)
}
```

Deleting the `users` row cascades to related tables per migrations in `internal/infrastructure/postgres/migrations/`. See also `docs/ADMIN_USER_DELETE_MANUAL_TEST.md`.

#### Admin: user-owned todos (list / patch / delete)

```graphql
query AdminUserOwnedTodos($userID: UUID!) {
  adminUserOwnedTodos(userID: $userID) {
    id title completed organizationID assignedToUserID createdAt updatedAt
  }
}
```

```graphql
mutation AdminUpdateUserTodo($input: AdminUpdateUserTodoInput!) {
  adminUpdateUserTodo(input: $input) { id title completed updatedAt }
}
```

```graphql
mutation AdminDeleteUserTodo($id: UUID!) {
  adminDeleteUserTodo(id: $id)
}
```

---

### Teardown

#### Delete Account  _(requires Bearer token)_

Permanently deletes the authenticated user's account. The Postman pre-request script includes a **production-URL safety guard** that aborts the request if `baseUrl` contains `production`, `prod.`, or `.io`.

```graphql
mutation DeleteAccount {
  deleteAccount
}
```

On success the Postman test script clears `accessToken`, `refreshToken`, `userId`, `userEmail`, and `userDisplayName` from the environment.

---

### Error format

Most GraphQL responses use **HTTP 200** with errors in the JSON body. Some guardrails (e.g. **query depth** / **complexity** limit) may return **HTTP 422** with `errors` + `data: null`. The body may use **`INTERNAL_ERROR`** for those until the server maps gqlgen protocol codes (**SECURITY.md**).

```json
{
  "errors": [
    {
      "message": "invalid email or password",
      "extensions": { "code": "INVALID_CREDENTIALS" }
    }
  ],
  "data": null
}
```

| Code                  | Meaning                                         |
|-----------------------|-------------------------------------------------|
| `INVALID_CREDENTIALS` | Wrong email or password                         |
| `EMAIL_TAKEN`         | Email already registered                        |
| `USER_NOT_FOUND`      | User does not exist                             |
| `NOT_FOUND`           | Requested resource does not exist               |
| `TOKEN_EXPIRED`       | JWT or refresh token expired                    |
| `UNAUTHENTICATED`     | Missing or invalid Bearer token                 |
| `FORBIDDEN`           | Authenticated but insufficient role/permission  |
| `LOGIN_RATE_LIMITED` | Too many failed **login** attempts (email and/or IP window); requires Redis |

---

## Postman Collection

A complete Postman collection is included in `postman/`.

### Import

1. Open Postman
2. **Import** → select `postman/masterfabric.collection.json`
3. **Import** → select `postman/masterfabric.environment.json`
4. Select the **MasterFabric — Local** environment

### What's included

| Folder        | Requests                                                                                                                                                |
|---------------|---------------------------------------------------------------------------------------------------------------------------------------------------------|
| Health        | Health Check, Readiness Check                                                                                                                           |
| Auth          | Register, **Login** (handles `otpRequired` + `loginToken`), **Login Verify OTP (2FA)**, Login (wrong password), Register (duplicate), Refresh, Logout, Re-Login |
| User          | Me, Me (unauthenticated), Update Profile, Update Profile (partial), Me (verify after update), Address (CRUD)                                            |
| Settings      | App Settings (public), **My Settings** (includes `otpEnabled`), unauthenticated error, Update My Settings, Light Theme, verify after update |
| **OTP**       | **Request OTP** (`VERIFY_IDENTITY`), **Verify OTP** — set env `otpCode` after request (see server logs / delivery channel)                              |
| Device        | Register Device, My Devices, My Devices (unauthenticated), Register Device (duplicate deviceId)                                                        |
| Notifications | List Notifications (public), List Notifications (with auth), Mark Read, Mark All Read, Admin Create, Admin Delete (error)                              |
| Todos         | Create Todo, My Todos, Update Todo, **Update Todo — Link to organization**, Delete Todo, My Todos (unauthenticated) — responses include `organizationID` / `assignedToUserID` |
| Organizations | Create Organization, My Organizations, Invite, My Pending Invitations, Accept Invitation, Organization Members, Organization Invitations                |
| Admin         | Users CRUD/status/role, pagination, forbidden paths, **Pending OTPs**, **User OTP History**, **Request OTP for User**                                   |
| Teardown      | Delete Account, Me — After Delete (error path)                                                                                                          |

### Automatic token management

Collection scripts handle all token lifecycle automatically:

- **Register / Login** — if `otpRequired` is false, saves `accessToken`, `refreshToken`, `userId`; if **true**, saves `otpLoginToken` and clears tokens until **Login Verify OTP** runs with env `otpCode`
- **Refresh Tokens** — rotates and overwrites the stored tokens
- **Logout** — clears `accessToken` and `refreshToken` from the environment
- **Re-Login** — restores tokens so subsequent folders run without manual steps
- **Admin List Users** — saves the first returned user UUID to `adminTargetUserId` for downstream admin requests

**Same user, mobile + Postman/curl:** Do not rely on one account for both at the same time. A refresh in the collection **replaces** the environment’s `refreshToken`; the app (or another client) may still hold the **old** refresh, which the server will reject. Use separate test users, or re-login on one side after testing the other. See **[docs/REFRESH_TOKEN_TESTING.md](docs/REFRESH_TOKEN_TESTING.md)**.

### Environment variables

| Variable             | Description                                                        |
|----------------------|--------------------------------------------------------------------|
| `baseUrl`            | Server base URL (default: `http://localhost:8080`)                 |
| `graphqlEndpoint`    | Full GraphQL URL (auto-set to `{{baseUrl}}/graphql`)               |
| `accessToken`        | JWT access token (managed by scripts)                              |
| `refreshToken`       | Refresh token (managed by scripts)                                 |
| `userId`             | Authenticated user UUID (managed by scripts)                       |
| `testEmail`          | Email used in test runs                                            |
| `testPassword`       | Password used in test runs                                         |
| `adminTargetUserId`  | UUID of the first user from Admin List Users (managed by scripts)  |
| `regularUserToken`   | Manually set — a token for a `USER`-role account (Admin FORBIDDEN test) |
| `todoId`             | UUID of created todo (managed by scripts)                          |
| `notificationId`     | UUID of created notification (managed by scripts)                  |
| `organizationId`     | UUID of created organization (managed by scripts)                  |
| `invitationId`       | UUID of pending invitation (managed by scripts)                    |
| `otpLoginToken`      | Temporary token from **Login** when `otpRequired=true` (managed by scripts) |
| `otpCode`            | 6-digit OTP — set manually for **Login Verify OTP** / **Verify OTP** |

### Run the full collection (Newman)

```bash
npm install -g newman

newman run postman/masterfabric.collection.json \
  --environment postman/masterfabric.environment.json \
  --delay-request 100
```

---

## Makefile Reference

```
make build          compile the server binary → bin/server
make build-cli      compile the CLI binary → bin/masterfabric_go
make run            build + run the server (requires infra)
make dev            run server with Air live rebuild (go run; no global air install)
make generate       re-run gqlgen code generation
make generate-dart  build CLI + regenerate sdk/dart_go_api
make tidy           go mod tidy
make lint           golangci-lint run ./...
make test           go test -race -count=1 ./...
make docker-up      start all containers (infra + app)
make docker-infra   start postgres, redis, rabbitmq, pgadmin, mailpit (no app)
make docker-down    stop and remove all containers
make docker-logs    tail app container logs
make clean          remove bin/
make security-scan  gosec + govulncheck (static / vuln scan; see Makefile)
```

---

## Deployment

| Platform | Config |
|----------|--------|
| **Fly.io** | `fly.toml` (repo root) |
| **Google Cloud Run** | [deployments/gcp/README.md](deployments/gcp/README.md) |
| **Azure Container Apps** | Build/push image from `mf-go/deployments/Dockerfile`, then deploy with **`infra/deploy.sh`** and **`infra/mf-go-container-app.bicep`** (see repo root README). |

**API semver on `main`:** `internal/shared/version/semver.txt` (embedded into `version.Version` at build). Bump that file and tag **`mf-go/v*`** as your release process requires. Override at runtime with **`MF_BUILD_VERSION`** if needed.

---

## Architecture

The project follows **Clean/Hexagonal Architecture** with **DDD** principles.

```
Delivery (GraphQL resolvers)
        │
        ▼
Application (use cases + DTOs)
        │
        ▼
Domain (entities + repository interfaces)
        ▲
        │
Infrastructure (Postgres, Redis, RabbitMQ, JWT)
```

**Dependency rule (strict):**
- Domain — zero external imports
- Application — imports only Domain
- Infrastructure — imports Domain + Application
- GraphQL resolvers — import Application DTOs + Infrastructure implementations
- `codegen` — standalone; never imports Application or Domain

### Auth flow

- Access token: JWT, 15-minute TTL
- Refresh token: opaque token stored in Redis with 7-day TTL; each successful `refreshTokens` **rotates** the refresh (the previous one is **consumed**; see [Refresh token rotation](#refresh-token-rotation-api--device-testing) and [docs/REFRESH_TOKEN_TESTING.md](docs/REFRESH_TOKEN_TESTING.md))
- Logout: access token blacklisted in Redis; refresh token deleted

### Event bus

- Exchange: `masterfabric.events` (RabbitMQ topic)
- Routing keys: `iam.user.registered`, `iam.user.login`, `settings.updated`, etc.
- Consumers are idempotent

### RBAC — role-based access control

Roles are **hierarchical** and enforced at the use-case level (not at the resolver):

```
USER (1) < MODERATOR (2) < ADMIN (3)
```

`internal/domain/iam/policy/rbac.go` exposes helpers used at the top of every protected use case's `Execute()` method:

| Helper                   | Minimum role required |
|--------------------------|-----------------------|
| `policy.RequireAdmin(ctx)`     | `ADMIN`           |
| `policy.RequireModerator(ctx)` | `MODERATOR`       |
| `policy.RequireRole(ctx, r)`   | exact role `r`    |
| `policy.HasRole(ctx, r)`       | bool, no error    |

A caller with `USER` or `MODERATOR` role hitting an admin use case receives `ErrForbidden` → GraphQL error code `FORBIDDEN`. A caller with no token receives `ErrUnauthorized` → `UNAUTHENTICATED`. These are distinct sentinel errors in `internal/shared/errors/`.

### Redis key schema

```
mf:{scope}:{id}:{field}
```

Examples: `mf:auth:refresh:<userID>`, `mf:auth:blacklist:<tokenHash>`

---

## Mobile Client — Flutter

When forking this repo you likely want a Flutter front-end that talks to this API. The **MasterFabric CLI** scaffolds a complete Flutter project pre-wired with the MasterFabric architecture (MVVM + BLoC/Cubit) and ready to consume the generated `dart_go_api` SDK.

### Install

```bash
dart pub global activate masterfabric_cli
```

### Create a Flutter project

```bash
# basic
masterfabric create my_app

# with org + description
masterfabric create my_app --org com.mycompany -d "My awesome app"
```

### What gets generated

```
my_app/
├── .cursor/                    # AI-assisted development (rules, agents, skills)
├── lib/
│   ├── main.dart               # Entry point with MasterApp.runBefore
│   ├── app/
│   │   ├── app.dart            # App widget with theme + MasterApp
│   │   ├── di/injection.dart   # GetIt + Injectable DI setup
│   │   └── routes.dart         # GoRouter configuration
│   ├── theme/
│   │   ├── app_theme.dart      # Theme constants
│   │   └── theme_builder.dart  # ThemeData builder
│   └── views/
│       ├── home/               # Home view — cubit + state
│       ├── profile/            # Profile view — cubit + state
│       └── settings/           # Settings view — theme cubit
├── assets/
│   ├── app_config.json         # App configuration
│   └── i18n/en.i18n.json       # English translations (Slang)
├── android/                    # Permissions pre-configured
├── ios/                        # Info.plist permissions pre-configured
├── pubspec.yaml                # masterfabric_core dependency included
└── slang.yaml                  # i18n configuration
```

### Architecture pattern (every view)

| Layer     | Base class                    | Role                                |
|-----------|-------------------------------|-------------------------------------|
| State     | `Equatable`                   | Immutable state with `copyWith()`   |
| Cubit     | `BaseViewModelCubit<S>`       | Business logic, `@injectable`       |
| View      | `MasterViewCubit<V, S>`       | UI — `initialContent()` + `viewContent()` |

### Connect to this backend

1. Generate the Dart SDK from this repo: `make generate-dart`
2. Copy or path-reference `sdk/dart_go_api/` in the Flutter project's `pubspec.yaml`:

```yaml
dependencies:
  dart_go_api:
    path: ../masterfabric_go_basic/sdk/dart_go_api
```

3. Instantiate `MasterfabricClient` with the server URL and inject it via GetIt.

### Requirements

- Dart SDK ^3.9.2
- Flutter SDK on PATH
- `masterfabric_core` accessible (pub.dev or local path)

> Package: [pub.dev/packages/masterfabric_cli](https://pub.dev/packages/masterfabric_cli)  
> Publisher: [masterfabric.co](https://pub.dev/publishers/masterfabric.co)

---

## Adding a New Feature

1. Define model in `internal/domain/<context>/model/`
2. Define repository interface in `internal/domain/<context>/repository/`
3. Create use case in `internal/application/<context>/usecase/`
4. Create DTO in `internal/application/<context>/dto/`
5. Implement repository in `internal/infrastructure/postgres/<context>/`
6. Add GraphQL schema in `internal/infrastructure/graphql/schema/<context>.graphqls`
7. Re-run gqlgen: `make generate`
8. Wire resolver in `internal/infrastructure/graphql/resolver/`
9. Wire dependencies in `cmd/server/main.go`
10. Re-generate the SDK: `make generate-dart`
