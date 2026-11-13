# Isolated Staging Synthetic Tests

This directory contains a test-only Worker harness plus the overlay currently attached to the existing `1toolz-app-native-staging` Worker. The active application Worker was updated without replacing its original entry module: only `/api/staging/*` is intercepted; all other requests continue through the original handler. The existing `ASSETS`, D1, R2, plain-text bindings, and workers.dev setting were preserved.

## Live deployment status

On 2026-11-13, the overlay was uploaded through the connected Cloudflare API because the local Wrangler credential check was failing. It uses a dedicated D1 binding named `SYNTHETIC_DB`, a dedicated R2 binding named `SYNTHETIC_MEDIA`, and the Worker secret `SYNTHETIC_TEST_BEARER`. The secret value is not stored in Git.

The live HTTP suite passed 21 assertions, including health, typed D1 create/read/update/list/delete, independent-request read-back, media upload with D1 metadata, R2 byte read-back/hash, authorization rejection, and cleanup. It reported `externalWrites: false`. The existing `/health` route and app root were also checked after deployment.

Important source-sync warning: the source map from the deployed `1toolz-app-native-staging` version does not match the repository's `cloudflare-worker/src/index.ts`. Do not deploy the root `cloudflare-worker/wrangler.toml` to this staging Worker; its name is `1toolz-app`. Sync the actual staging source before any future full-code deployment, or preserve the staging overlay when updating the live bundle.

## Test routes

- `GET /api/staging/health` — reports staging, D1/R2 readiness, and `externalWrites: false`.
- `/api/staging/typed/:type` — authenticated typed-record create/list and CRUD by id.
- `/api/staging/media` — authenticated image upload, metadata persistence in D1, R2 object read-back, and delete.

All mutating test routes require `Authorization: Bearer <SYNTHETIC_TEST_BEARER>`. Uploads are image-only and capped at 5 MiB; JSON records are capped at 64 KiB. The overlay contains no Firebase or Supabase calls. The live suite uses synthetic fixture data and removes its records and objects after testing.

## Local-only harness

`wrangler.toml` is intentionally named `1toolz-app-native-staging-synthetic-local` and uses placeholder resource identifiers. It is for `wrangler dev --local` only; do not deploy it. This makes the local harness unable to overwrite the active app Worker or bind to its remote D1/R2 resources.

```bash
cd /home/ubuntu/1toolz-app
openssl rand -hex 32 | awk '{print "SYNTHETIC_TEST_BEARER="$0}' > cloudflare-worker/staging/.dev.vars
chmod 600 cloudflare-worker/staging/.dev.vars
npx wrangler d1 migrations apply 1toolz-app-native-staging-synthetic-db-local --local --config cloudflare-worker/staging/wrangler.toml
npx wrangler dev --local --config cloudflare-worker/staging/wrangler.toml --ip 127.0.0.1 --port 8787
```

In another terminal, run the synthetic suite against localhost:

```bash
STAGING_BASE_URL=http://127.0.0.1:8787 \
STAGING_ALLOW_LOCAL=1 \
STAGING_API_TOKEN="$(sed -n 's/^SYNTHETIC_TEST_BEARER=//p' cloudflare-worker/staging/.dev.vars)" \
node tests/staging-http-suite.mjs
```

For live reruns, set `STAGING_BASE_URL` to the staging workers.dev URL and `STAGING_API_TOKEN` to the value configured in the Worker secret. Keep the bearer secret out of Git and rotate it in Cloudflare if it needs to be replaced.
