# OTP configuration — enable / disable & providers

How to turn OTP **delivery** and **per-user login OTP** on or off, and how to use **any SMTP provider** for email codes.

See also: **[SECURITY.md](./SECURITY.md)** (production checklist), **`../.env.example`** (all variables with comments).

---

## 1. Server-wide: where codes are sent (`OTP_DELIVERY`)

Set in **`mf-go/.env`** (or your host’s environment). **Restart the API** after changes.

**Local Mailpit:** `make docker-infra` starts **Mailpit** (SMTP **`localhost:1025`**, web UI **`http://localhost:8025`**). Point **`SMTP_HOST=localhost`**, **`SMTP_PORT=1025`**, **`SMTP_PLAIN_NO_TLS=true`**, **`SMTP_FROM=noreply@local.test`**, and set **`OTP_DELIVERY=email`** (or keep **`admin_panel`** if you only need the SMTP bridge for login OTP — see `internal/infrastructure/otp/delivery.go`).

| Goal | `OTP_DELIVERY` | Also required |
|------|----------------|---------------|
| Codes only in **admin GraphQL** + server logs (default) | `admin_panel` | — |
| **Email** (any SMTP provider — see §3) | `email` | `SMTP_*` **or** admin **DB SMTP** (§3b) when enabled + complete |
| Email + admin log line | `both` | same as email |
| **WhatsApp** (Meta Cloud API) | `whatsapp` or `whatsapp_both` | `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`; user **phone** on profile (country code, digits) |
| **Telegram** (Bot API) | `telegram` or `telegram_both` | `TELEGRAM_BOT_TOKEN`; user **`telegramChatId`** via `updateProfile` |

Optional branding in messages: **`OTP_APP_NAME`** (falls back to `SMTP_SUBJECT_PREFIX` or `MasterFabric`).

**Disable** email/WhatsApp/Telegram delivery by setting:

```env
OTP_DELIVERY=admin_panel
```

(remove or ignore the other provider secrets if you no longer use them).

---

## 2. Per user: require OTP after password login (`otp_enabled`)

Independent of `OTP_DELIVERY`. Stored in **user settings** (GraphQL: `mySettings` / `updateMySettings`).

| Goal | How |
|------|-----|
| **Enable** | App **Settings** → OTP toggle **on** → confirm with an OTP (sent via current `OTP_DELIVERY`). |
| **Disable** | Same toggle **off** → confirm with OTP again. |

If `otp_enabled` is **false**, login is email + password only (no second step).

---

## 3. Email: any SMTP provider

OTP email uses **standard SMTP**. You can use **any host** that offers SMTP (SendGrid, Mailgun, Amazon SES, Postmark, Brevo, Gmail/Workspace with an app password, self-hosted Postfix, etc.).

| Variable | Purpose |
|----------|---------|
| `SMTP_HOST` | Provider SMTP hostname |
| `SMTP_PORT` | Usually **587** (STARTTLS) or **465** (implicit TLS) |
| `SMTP_USER` | Username (provider-specific; often a full email or API user) |
| `SMTP_PASSWORD` | Password or SMTP token from the provider |
| `SMTP_FROM` | Sender address (**must** be allowed by the provider — verified domain/sender) |
| `SMTP_FROM_NAME` | Optional display name |

**TLS:**

- **587** — leave `SMTP_IMPLICIT_TLS=false` (STARTTLS is used automatically where supported).
- **465** — set `SMTP_IMPLICIT_TLS=true`.
- **Local Mailpit** (dev) — e.g. `SMTP_HOST=localhost`, `SMTP_PORT=1025`, `SMTP_PLAIN_NO_TLS=true`, `SMTP_FROM=noreply@local.test`.  
  **`SMTP_PLAIN_NO_TLS` must be `false` in production** (enforced when `ENV=production`).

**Unauthenticated SMTP** (empty `SMTP_USER` / `SMTP_PASSWORD`) is only realistic for some **local** relays; production providers almost always require credentials.

**Enable email OTP:**

```env
OTP_DELIVERY=email
SMTP_HOST=...
SMTP_PORT=587
SMTP_USER=...
SMTP_PASSWORD=...
SMTP_FROM=...
```

---

## 3b. Admin-managed SMTP (`system_mail_smtp`)

Admins can store outbound SMTP in Postgres (**singleton row**, migration `014_system_mail_smtp`) via GraphQL:

- `adminMailSmtpSettings` / `adminUpdateMailSmtpSettings` / `adminSendTestMail` / `adminSendUserEmail`

**Precedence:** If the row is **enabled** and has **host**, **from address**, and valid **port**, that configuration is used for OTP email, admin test/user mail, and any shared plain-text sender. Otherwise the server falls back to **`SMTP_*` env** (same shape as §3).

Production startup checks **effective** SMTP (DB or env) when `OTP_DELIVERY` is `email` or `both`. **`plain_no_tls`** is rejected in production whether it comes from env or DB.

**Security:** Set **`MAIL_SMTP_ENCRYPTION_KEY`** (32-byte AES key, e.g. `openssl rand -base64 32`) so **`system_mail_smtp.password`** is **AES-256-GCM** at rest (`mf1:` prefix in Postgres). Without it, passwords remain plaintext (local dev). Legacy plaintext rows still decrypt; saving again re-encrypts when the key is set. See **SECURITY.md**.

---

## 4. WhatsApp & Telegram (short)

- **WhatsApp:** Meta **WhatsApp Cloud API**. Set `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`; optional `WHATSAPP_API_VERSION` (default `v21.0`). Production may require **approved templates** for users who have not messaged you recently — see Meta docs.
- **Telegram:** Create a bot with **@BotFather**, set `TELEGRAM_BOT_TOKEN`. Users link **`telegramChatId`** (e.g. from @userinfobot) via **`updateProfile`**.

Details and security notes: **[SECURITY.md](./SECURITY.md)** § OTP.

---

## 5. Admin app settings: OTP email kill-switch and templates

These keys live in **`app_settings`** (migration **`015_otp_mail_app_settings`**). They are **not** public (`is_public: false`); admins manage them via GraphQL **`adminAppSettings`** / **`adminUpsertAppSetting`** or the mf-expo screen **Settings → Admin → Notifications → OTP email**.

| Key | Meaning | When missing / empty |
|-----|---------|----------------------|
| `otp_email_enabled` | `"true"` / `"false"` (case-insensitive) — allow sending OTP by email | Treated as **enabled** (same as today) |
| `otp_email_subject_login` | Plain-text subject for **login** / **verify_identity** OTPs | Server default: `"{AppName} — Your verification code"` (see code) |
| `otp_email_body_login` | Plain-text body (Go **`text/template`**) | Server default body (code + expiry text) |
| `otp_email_subject_password_reset` | Subject for **password_reset** OTPs | Same fallback as login subject |
| `otp_email_body_password_reset` | Body for **password_reset** | Same fallback as login body |

**Template data** (available in subject and body templates):

| Field | Description |
|-------|-------------|
| `{{.Code}}` | Six-digit OTP |
| `{{.AppName}}` | From `OTP_APP_NAME` / branding |
| `{{.PurposeHuman}}` | Human-readable purpose label |
| `{{.ExpiryMinutes}}` | OTP TTL in minutes |

If **`otp_email_enabled`** is **`false`**, the email provider returns domain code **`OTP_EMAIL_DISABLED`**. With **`OTP_DELIVERY=both`**, the chain falls through to **admin_panel** so operators can still see codes; with **`OTP_DELIVERY=email`** only, the send fails until the setting is re-enabled or delivery mode is changed.

**Forgot password & in-app OTP:** Unauthenticated mutations **`requestPasswordReset`** / **`resetPasswordWithOtp`** use the **password reset** templates.

- **`PASSWORD_RESET`** OTPs are sent via **SMTP whenever effective SMTP is configured** (DB admin mail row or **`SMTP_*` env**), **even if `OTP_DELIVERY` is `admin_panel`** — so self-serve reset works without turning global delivery to email.
- **`LOGIN`**, **`VERIFY_IDENTITY`** (e.g. Settings OTP toggle), and **`ACCOUNT_ACTIVATE`** use the **same SMTP path when effective SMTP is configured** while **`OTP_DELIVERY` is `admin_panel`** — users get a code by email instead of admin-only delivery. If SMTP is missing or **`otp_email_enabled`** blocks email, behavior falls back to **`OTP_DELIVERY`** (admin panel / logs). With **`OTP_DELIVERY`** set to **WhatsApp**, **Telegram**, or **email**, those modes stay primary for login/verify; **password reset** can still use SMTP when configured (historic behavior).

If SMTP is not configured, delivery follows **`OTP_DELIVERY`** (e.g. admin panel / logs only). **`requestPasswordReset`** always returns **`ok: true`** (anti-enumeration). Rate limits (when Redis is available): per normalized email and per client IP (see **SECURITY.md**).

---

## 6. File index

| File | Contents |
|------|----------|
| **`mf-go/.env.example`** | All env keys, commented |
| **`mf-go/docs/SECURITY.md`** | Production checklist, headers, CORS, OTP risks |
| **`mf-go/docs/OTP_CONFIGURATION.md`** | This guide (incl. §5 OTP mail app settings) |
| **Root `README.md`** | Monorepo quick start + links |
