# Cloudflare OTP setup

This Worker handles login OTP requests at `POST /api/send-otp` and `POST /api/verify-otp`. The browser calls the API hostname directly (configurable with `VITE_AUTH_API_URL`, defaulting to `https://api.abdomedi.com`). The app Worker can also proxy these paths for same-origin installations. OTP records are stored in D1 as keyed HMAC hashes and expire after five minutes.

## Production prerequisites

The D1 database `abdomedi-otp` and its four tables are already provisioned. Do not add it to the app Worker's bindings; it belongs to `abdomedi-carrier-api`, which serves `api.abdomedi.com`.

Before deploying the code, add these **encrypted Worker secrets** to the `abdomedi-carrier-api` Worker in Cloudflare Dashboard → Workers & Pages → `abdomedi-carrier-api` → Settings → Variables and Secrets:

- `OTP_HASH_SECRET` — a fresh, random secret (at least 32 random bytes). Do not reuse an email-provider API key.
- `RESEND_API_KEY` — Resend API key.
- `BREVO_API_KEY` — Brevo API key.

The values must be Worker **Secrets**, not plain-text `[vars]`. Never commit or paste secret values into source control or chat. Keep both provider secrets configured: Resend is attempted first, and Brevo is the automatic fallback.

Verify `abdomedi.com` with both providers and authorize the configured sender `no-reply@abdomedi.com`. The non-secret sender name/address values are in Wrangler configuration. Provider account limits, sender verification, and account status are controlled by Resend and Brevo.

## Daily failover limits

Default app-side caps match the published free plans and reset at 00:00 UTC:

- Resend: 100 OTP emails/day.
- Brevo: 300 OTP emails/day.

D1 tracks daily attempts across both Workers. Once one provider reaches its configured cap, new OTPs are routed to the other. Resend quota/rate-limit responses are also recorded with a reset time. Brevo's free plan may queue transactional messages after its 300-send limit, so the internal cap prevents new OTPs being accepted into that queue. Paid accounts can increase `OTP_RESEND_DAILY_LIMIT` and/or `OTP_BREVO_DAILY_LIMIT` in the Worker's non-secret variables to the account's actual cap.

If the same provider accounts are used by other systems, those external sends are not visible to this app's D1 counter; the provider may reach its own limit earlier. Resend quota errors trigger failover; Brevo's 300/day internal cap only precisely reflects messages sent through this OTP implementation.

## Deployment and verification

1. Add the three Worker secrets above before publishing the code.
2. Build/deploy the API Worker using the repository-root `wrangler.toml` (which binds D1 and serves `api.abdomedi.com`).
3. Build/deploy the app Worker using `cloudflare-worker/wrangler.toml`; its OTP paths proxy to the API Worker.
4. Verify the API's `/health` endpoint returns 200, an invalid email gets a 400 response from `/api/send-otp`, and a test email arrives before enabling login for all users.
5. Verify wrong OTPs are rejected, a correct OTP succeeds once only, and subsequent sends switch providers at the configured daily limits.

There is intentionally no fixed OTP or admin bypass. If the provider secrets or sender-domain verification are missing, sending fails closed and login OTP requests return an unavailable response.
