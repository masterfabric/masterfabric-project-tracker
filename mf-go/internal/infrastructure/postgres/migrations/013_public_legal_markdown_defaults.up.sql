-- Default in-app Help & FAQ and Privacy Policy (Markdown), public app_settings keys.
-- ON CONFLICT: only replaces value when the existing row is empty (admins keep edits).

INSERT INTO app_settings (key, value, description, is_public) VALUES
(
    'public_help_faq_markdown',
    $faq$# Help & FAQ

Welcome to **MF Project Tracker** (MasterFabric). Use this screen for quick answers; for anything else, send **feedback** from Settings — the team can reply in your thread.

---

## Getting started

- **Home** — Your entry point for projects, todos, and organization updates (when you belong to a team).
- **Settings** — Language, appearance, notifications, profile, and support links.

You can use many features without signing in; creating an account unlocks sync, organizations, and saved preferences on the server.

---

## Account & sign-in

- **Sign up / Sign in** — Use your email. Follow any verification steps your administrator configured.
- **Sign out** — Available in Settings when you are signed in. Local data on this device may remain until you clear the app.
- **Forgot password** — Use the recovery flow on the sign-in screen if your deployment supports it.

---

## Todos & projects

- Create, edit, and complete **todos** from the project or home flows your app exposes.
- **Organization todos** may require membership; if you cannot see or edit an item, check with your org admin.

---

## Organizations & collaboration

- **Organization** profiles, news, and chat (if enabled) are managed by your organization. Only admins/owners can change certain settings or membership.
- If you are **invited**, accept from the invitation flow; pending invites can sometimes be resent or revoked by admins.

---

## Notifications

- **Push** and in-app notifications depend on device permissions and server settings. You can adjust preferences in Settings where your build exposes them.

---

## Feedback & support

- **Send feedback** (Settings) opens a short form: your message goes to the team inbox.
- **Guests** are asked for an email so we can respond.
- **My feedback** lists your threads; tap a thread to see the full timeline, including team replies.

---

## Privacy & legal

- **Privacy Policy** is linked from Settings and reflects how this deployment handles data (see that document for details).

---

## Troubleshooting

| Issue | What to try |
|-------|-------------|
| Cannot sign in | Check network, correct API URL for this build, and credentials. |
| Blank Help / Privacy | An administrator must publish Markdown in app settings (`public_help_faq_markdown` / `public_privacy_policy_markdown`). |
| Feedback not delivered | Confirm internet access; guests must provide a valid email. |

_Last updated: defaults shipped with mf-go migration 013._
$faq$,
    'Public Help & FAQ (Markdown) for in-app /help-faq',
    true
),
(
    'public_privacy_policy_markdown',
    $priv$# Privacy Policy

**MF Project Tracker** (“the App”) is provided as part of the MasterFabric stack. This policy describes, at a high level, what information the **backend associated with this build** may process when you use the App. Your **actual** practices depend on how your organization deploys mf-go, logging, analytics, and third parties — customize this text in **admin app settings** if you need legal-grade copy.

---

## Who this applies to

- **Users** of the mobile or web client connected to this backend.
- **Guests** who submit feedback with an email but do not create an account.

---

## Information we may collect

Depending on features you use and server configuration, this may include:

- **Account data** — Email, display name, profile fields you provide, and authentication metadata.
- **Usage & device data** — Device identifiers, app version, OS, and session records as implemented by mf-go (e.g. device registration, security).
- **Operational content** — Todos, organization membership, messages, news, notifications, **feedback threads**, and similar data stored for the service.
- **Technical logs** — Server or infrastructure logs from your deployment (retention is an operator choice).

We do not intend this list to be exhaustive; your operator should align it with real data flows.

---

## How we use information

- To **run the service** — authenticate you, sync data, deliver notifications, and show content you expect.
- To **support you** — e.g. respond to **feedback** you send.
- To **secure the platform** — abuse prevention, audit, and compliance with applicable law (as configured by your operator).

---

## Sharing

Data may be visible to:

- **Your organization’s admins/owners** for org-scoped features.
- **Service operators** (hosting, email/SMS for OTP, push providers) bound by your deployment’s agreements.

There is **no sale of personal data** in the default product posture; your organization’s policies override where required.

---

## Retention & deletion

Retention depends on **server policies** and migrations (e.g. account deletion, org removal). Ask your administrator how long data is kept and how to request deletion where applicable.

---

## Your choices

- Adjust **notifications**, **language**, and **appearance** in Settings where available.
- **Sign out** or **delete account** if your build exposes it; some effects are immediate on the server, others may require admin action.

---

## Children’s privacy

The service is not directed at children under the age required by your jurisdiction. Do not use the App for child-directed services unless your deployment complies with applicable law.

---

## Changes

We may update this policy text; the in-app document is loaded from **public app settings** so operators can publish revisions without shipping a new client build (after cache refresh).

---

## Contact

For privacy requests tied to **this deployment**, contact your **organization administrator** or the team operating this mf-go instance.

_Default template — replace with counsel-reviewed text for production._
$priv$,
    'Public Privacy Policy (Markdown) for in-app /privacy-policy',
    true
)
ON CONFLICT (key) DO UPDATE SET
    value = CASE
        WHEN trim(app_settings.value) = '' THEN EXCLUDED.value
        ELSE app_settings.value
    END,
    description = EXCLUDED.description,
    is_public = true,
    updated_at = NOW();
