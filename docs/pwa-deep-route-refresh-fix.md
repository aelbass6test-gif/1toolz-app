# PWA deep-route refresh fix

## Symptom

On the production SPA, opening or refreshing a nested route such as
`/store/<storeId>/products` can fail with a browser-level navigation error,
while Ctrl+Shift+R succeeds. This pattern is consistent with a stale service
worker serving an outdated precached application shell.

## Confirmed deployment configuration

- `app.abdomedi.com` is attached to the `1toolz-app` production Worker.
- The active Worker version exposes its Static Assets binding with
  `not_found_handling = "single-page-application"`.
- The Vite build uses `vite-plugin-pwa` with `registerType: "autoUpdate"`.
- The application entry point did not explicitly import and call
  `registerSW()`, so open tabs were not wired to the plugin's automatic
  reload/update flow.

## Changes in this hotfix

1. Explicitly call `registerSW({ immediate: true })` from `index.tsx`.
2. Exclude non-root navigations from Workbox's precached `index.html`
   navigation fallback. The browser sends those requests to the Cloudflare
   Worker, whose SPA fallback returns the current deployment's `index.html`.
3. Add a NetworkFirst navigation cache with a short timeout and a precached
   `/index.html` fallback, preserving an offline shell when the network is
   unavailable.

## Release validation

After CI passes and the hotfix is deployed to production, test in a normal
(non-incognito) browser profile:

- Open `/store/<storeId>/products` directly in a new tab.
- Press ordinary Ctrl+R on that route several times.
- Navigate between a store route and another internal route, then refresh.
- Leave the app open during a new deployment and verify it adopts the updated
  service worker without requiring Ctrl+Shift+R.
- Test an offline reload separately to confirm the root shell fallback works.

Do not treat the fix as released until the production checks are completed.
This branch change does not itself alter the live Worker or production routing.
