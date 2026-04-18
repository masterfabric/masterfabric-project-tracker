# Security Guide — mf-go

This document covers the security controls built into the mf-go backend and the
environment variables you **must** configure before deploying to production.

**OTP / SMTP / WhatsApp / Telegram — how to enable or disable:** see **[OTP_CONFIGURATION.md](./OTP_CONFIGURATION.md)** (operational guide). This file focuses on **security** checklist and accepted risks.

---

## Production checklist

| Control | Env var | Required value | Default |
|---------|---------|----------------|---------|
| Runtime env | `ENV` | `production` | `development` |
| JWT secret | `JWT_SECRET` | Random string >= 32 chars | Insecure placeholder (fatal in production) |
| DB TLS | `DATABASE_DSN` | Include `sslmode=require` or `sslmode=verify-full` | `sslmode=disable` (**fatal** in production) |
| Redis required | `REDIS_REQUIRED` | `true` (recommended) | `true` when `ENV=production` |
| Introspection | `GRAPHQL_INTROSPECTION` | `false` | `false` in production, `true` in dev |
| Playground | `GRAPHQL_PLAYGROUND` | `false` | `false` in production, `true` in dev |
| CORS origins | `CORS_ALLOWED_ORIGINS` | Comma-separated list of client origins (**not** `*` in production) | `*` |
| RabbitMQ | `RABBITMQ_URL` | Dedicated user (not **guest:guest**) and TLS where possible | dev default guest (**fatal** in production if guest:guest) |
| OTP + SMTP | `OTP_DELIVERY`, `SMTP_*` or **`system_mail_smtp`** (admin) | Use `email`/`both` only with real SMTP + TLS in production | `admin_panel` |
| SMTP DB encryption | **`MAIL_SMTP_ENCRYPTION_KEY`** | 32-byte AES key (e.g. `openssl rand -base64 32`) encrypts **`system_mail_smtp.password`** at rest (`mf1:`) | unset (plaintext in dev; production warns) |
| OTP WhatsApp / Telegram | `WHATSAPP_*`, `TELEGRAM_BOT_TOKEN` | Required when `OTP_DELIVERY` is `whatsapp*` / `telegram*`; rotate tokens | — |

---

## Authentication & tokens

- **Password hashing**: bcrypt (`DefaultCost`).
- **Access tokens**: Short-lived JWT (HS256), default 5 min TTL.
- **Refresh tokens**: Opaque UUID stored in Redis with configurable TTL (default 7 days).
- **Token blacklisting**: Revoked access tokens are blacklisted in Redis for their remaining TTL.
- **Forced logout**: Admin actions (suspend, deactivate) write a per-user revocation marker
  in Redis; access tokens issued before that timestamp are rejected.

### Redis degradation

When Redis is unreachable:
- Refresh token storage, blacklisting, and revocation markers are disabled.
- `logout` succeeds but does not actually revoke the access token.
- **Recommendation**: Set `REDIS_REQUIRED=true` in production to fail startup if Redis is down.

---

## GraphQL hardening

| Feature | Default | Env var |
|---------|---------|---------|
| Introspection | off (prod) | `GRAPHQL_INTROSPECTION` |
| Playground | off (prod) | `GRAPHQL_PLAYGROUND` |
| Query complexity limit | 300 | `GRAPHQL_COMPLEXITY_LIMIT` |
| Query depth limit | 15 | `GRAPHQL_QUERY_DEPTH_LIMIT` |
| Max request body | 2 MB | (compile-time constant) |

Depth checks run as a gqlgen extension; overly deep queries are **rejected** (HTTP **422**). The
response body may currently show a generic **`INTERNAL_ERROR`** because the GraphQL error presenter
only maps **`DomainError`** — see **Developer follow-ups — by severity** (Medium: protocol errors).

---

## Developer follow-ups — by severity

Same classification we use for triage after the security-hardening slice (pentest / audit follow-up).
**Urgent** items block safe operation; **Medium** should be scheduled; **Low** / **Optional** are hygiene
or environment polish.

| Severity | Topic | What to know / do |
|----------|--------|-------------------|
| **Urgent** | *(none if you run the stack correctly)* | Use **Docker Compose** `app` + **`REDIS_PASSWORD`** matching Redis `requirepass`, or `/health/ready` will fail and auth features that need Redis will degrade. |
| **Medium** | **Local `go run` / `:8080` vs Redis AUTH** | A process on **8080** without **`REDIS_PASSWORD`** (or wrong password) while Redis uses **`--requirepass`** yields **`/health/ready` 503** and Redis **`NOAUTH`**. Align **`local.env`** / IDE launch env with **[`.env.example`](../.env.example)**. |
| **Medium** | **GraphQL depth / complexity vs error presenter** | Limits are enforced; clients may not receive **`DEPTH_LIMIT_EXCEEDED`** / complexity codes yet — **`SetErrorPresenter`** should pass through gqlgen **`errcode`** / `*gqlerror.Error` before falling back to **`INTERNAL_ERROR`**. |
| **Low** | **Postman / Newman full collection** | Many requests need **seeded admin**, **`organizationId`**, invitation IDs, etc. Run **Auth / Health** folders first or **`make seed-admin`** where documented. |
| **Low** | **Shell `curl` + GraphQL variables** | Prefer **Postman**, **`newman`**, or a tiny script: brittle quoting (`$input` escaping) can produce bogus **`INTERNAL_ERROR`**. |
| **Optional** | **HSTS** | **`Strict-Transport-Security`** only when the request is seen as HTTPS (`r.TLS` or **`X-Forwarded-Proto: https`**). Use **`HTTP_DISABLE_HSTS=true`** if a misconfigured proxy breaks local TLS offload testing. |

---

## OTP (one-time passwords)

- **`requestOTP` / `verifyOTP`**: Authenticated user only; scoped to the caller’s user ID. Rate limit: **1 new OTP per user per purpose per minute** (Redis). **Idempotent:** if a valid pending OTP already exists for that user+purpose, the same payload is returned without counting as a new request (avoids `OTP_RATE_LIMITED` on UI retries). Codes are 6 digits, **5-minute TTL**, **5 failed attempts** then locked.
- **`login` + `loginVerifyOTP`**: If `otp_enabled` is on, password success returns `otpRequired` and a short-lived **`loginToken`** (stored in Redis, 5 min). `loginVerifyOTP` is **unauthenticated** by design (like `login`); possession of `loginToken` + correct OTP completes the session. **Requires Redis** for the login-token binding; if Redis is unavailable, OTP login cannot complete.
- **Admin OTP APIs**: `adminPendingOTPs` and `adminUserOTPHistory` enforce **`policy.RequireAdmin`** in their use cases. `adminRequestOTP` enforces **admin** in the resolver (must not be callable by non-admin users).
- **Delivery model** (`OTP_DELIVERY`):
  - **`admin_panel`** (default): codes are only visible to admins via GraphQL (`adminPendingOTPs`, `adminUserOTPHistory`) and server logs.
  - **`email`**: codes are sent to the user’s registered email via **SMTP**. Effective config: **`system_mail_smtp`** row when **enabled** and complete (host, from, port), else **`SMTP_*` env vars**. Use TLS in production; never set plain-no-TLS in production (env or DB).
  - **`both`**: email is sent and the code is also logged for admin visibility (useful for support); stored channel is **email**.
  - **`whatsapp` / `whatsapp_both`**: **Meta WhatsApp Cloud API** (`WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`). User **phone number** on profile must be digits with **country code** (no `+`). Production may require an approved **template** for users who have not messaged you recently; plain `text` works in dev/sandbox. Errors: `OTP_NO_PHONE`, `OTP_WHATSAPP_FAILED`.
  - **`telegram` / `telegram_both`**: **Telegram Bot API** (`TELEGRAM_BOT_TOKEN`). User must set **`telegramChatId`** on their profile (`updateProfile`) — obtain id via @userinfobot or your bot’s `/start` webhook. Errors: `OTP_NO_TELEGRAM`, `OTP_TELEGRAM_FAILED`.
- **SMTP secrets**: Store `SMTP_USER` / `SMTP_PASSWORD` in a secret manager. Admin-managed **`system_mail_smtp`** mailbox passwords are **AES-256-GCM encrypted at rest** when **`MAIL_SMTP_ENCRYPTION_KEY`** is set (values prefixed with **`mf1:`** in Postgres); without the key, legacy rows remain readable plaintext until re-saved. Rotate the key only with a plan (existing ciphertext becomes undecryptable). Failed sends return `OTP_EMAIL_FAILED`; missing account email returns `OTP_NO_EMAIL`. Admin test send is rate-limited per admin user in Redis. Effective SMTP is **not** cached in Redis (avoids duplicating decrypted passwords).
- **Messaging tokens**: Treat `WHATSAPP_ACCESS_TOKEN` and `TELEGRAM_BOT_TOKEN` as secrets (rotation, least privilege).
- **Admin OTP mail settings** (`app_settings` keys `otp_email_*`, migration `015_otp_mail_app_settings`): **Admin-only** (not exposed on public `appSettings`). **`otp_email_enabled=false`** blocks outbound OTP email with **`OTP_EMAIL_DISABLED`**; use only when you intentionally disable user email OTP or rely on **`OTP_DELIVERY=both`** admin fallback.
- **Forgot password** (`requestPasswordReset` / `resetPasswordWithOtp`): Unauthenticated; **`requestPasswordReset`** always returns success shape (**anti-enumeration**). **`resetPasswordWithOtp`** returns **`false`** on invalid code / user (generic, no enumeration). With Redis: **rate limits** on reset requests per **hashed email** (5/hour) and per **client IP** (30/hour) — silent no-op when exceeded (still returns `ok: true` on request). Client IP is taken from **`X-Forwarded-For`** / **`X-Real-IP`** / remote addr when the server is behind a trusted proxy.

---

## HTTP hardening

### Security headers

Every response includes **`Cache-Control: no-store`**.
When the request is TLS-terminated correctly (`r.TLS` set, or **`X-Forwarded-Proto: https`**), responses also include **`Strict-Transport-Security`** (disable with **`HTTP_DISABLE_HSTS=true`** if your edge proxy misreports scheme).

Every response includes:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'`
- `X-XSS-Protection: 1; mode=block`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`

### Rate limiting

Global per-IP limit: **100 requests/minute** via `go-chi/httprate`.
Failed **`login`** attempts are tracked in Redis (per normalized email and per client IP, after **`chi` RealIP**); exceeding the window returns **`LOGIN_RATE_LIMITED`** — requires Redis.

### CORS

Configured via `CORS_ALLOWED_ORIGINS` (comma-separated). Defaults to `*`.
`AllowCredentials` is `false` (no cookie auth). Tighten to explicit origins in production.

---

## Input validation

Auth DTOs (`RegisterRequest`, `LoginRequest`, `RefreshRequest`, `LogoutRequest`) are
validated server-side using `go-playground/validator`:
- Email format
- Password minimum length (8 characters)
- Display name length (2–100 characters)
- Required fields enforced

---

## Error handling

A custom gqlgen error presenter ensures:
- **Domain errors** (`DomainError`) expose their `code` and `message` to clients.
- **Internal errors** are logged server-side and return a generic `INTERNAL_ERROR` to clients
  without leaking stack traces or database details.

---

## RBAC

Admin operations call `policy.RequireAdmin(ctx)` which reads the JWT role from context.
The role hierarchy is: `user < moderator < admin`.

---

## Known limitations / accepted risks

1. **OTP entropy**: Six-digit codes are standard for UX but are brute-forceable in theory; mitigated by short TTL, attempt limits, and per-user OTP rate limiting (not a separate limit on `loginVerifyOTP` beyond OTP row `maxRetries`).
2. **Email enumeration**: `EMAIL_TAKEN` on register and `ACCOUNT_DISABLED` on login reveal
   account existence. This is an accepted product trade-off; if you need stealth, return a
   uniform error for all auth failures.
3. **JWT role lag**: Role changes take effect on the next token refresh, not immediately
   for in-flight access tokens.
4. **Readiness messages**: `/health/ready` returns generic dependency failure text (no raw driver errors to unauthenticated callers).
5. **bcrypt 72-byte limit**: Passwords longer than 72 bytes are silently truncated by bcrypt.
   Consider a pre-hash (SHA-256 -> bcrypt) if very long passwords are a concern.

---

## Reporting vulnerabilities

If you discover a security issue, please report it privately via the repository's
security advisories (GitHub Security tab) rather than opening a public issue.
