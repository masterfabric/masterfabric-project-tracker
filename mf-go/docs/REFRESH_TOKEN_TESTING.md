# Refresh tokens and parallel API + device testing

`refreshTokens` implements **rotation**: each successful call **consumes** the submitted opaque refresh and issues a **new** access + refresh pair. The old refresh is no longer valid.

## Why this matters

If you use the **same user account** in more than one place at once:

| Client | What happens |
|--------|----------------|
| **curl / Postman / Newman** | Running **Refresh** updates stored tokens. The next refresh must use the **new** refresh from the last response. |
| **Mobile app (mf-expo)** | The app stores its own refresh. If something else refreshes first, the app still holds the **previous** refresh → the next `refreshTokens` from the app fails with `TOKEN_INVALID` (until the user signs in again). |

So **parallel** manual API testing and **live app** testing against the same backend user will **invalidate** whichever client still holds the old refresh.

## What to do

- Use **separate test users** (different emails) for API scripts vs. the phone simulator.
- If you need one user: finish **one** side’s flow, then **log in again** on the other side so both start from a fresh token pair.
- In Postman, expect **Refresh** to **overwrite** `refreshToken` in the environment; do not copy an old refresh from an earlier run after a successful refresh elsewhere.

For GraphQL details and error codes, see the **Refresh Tokens** section in [../README.md](../README.md).
