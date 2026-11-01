# Exact blockers and next actions

## Blocking issues

1. **D1 read authorization:** Cloudflare D1 query returns `not authorized: SQLITE_AUTH`; remote schema and post-operation state cannot be independently verified.
2. **Incomplete clean schema:** current SQL covers selected auth/OTP/webhook/wallet pieces, not the complete application domain model.
3. **Runtime legacy dependencies:** direct Firebase/Supabase imports remain in `App.tsx`, services, `server.ts`, components, and Supabase functions.
4. **Missing Turbo staging URL:** the safe behavior is a 503; production cannot be used as a fallback.
5. **Insufficient operational coverage:** local tests are not a substitute for synthetic Worker/D1 API tests that re-read state after refresh/new session.

## Safe next actions

- Provision a least-privilege D1 read credential or a temporary read-only Worker diagnostic endpoint for lab databases only.
- Design and add the complete fresh-start schema with deterministic migrations and rollback notes.
- Convert one bounded runtime family at a time: auth, stores/catalog, orders, wallet, files, shipping, realtime/chat.
- Add route-level synthetic tests for each family and remove direct legacy imports only after the family passes.
- Keep Turbo disabled until a dedicated staging endpoint is supplied.
- Re-run lint/build and relevant tests before each focused commit.

## Explicitly not done

- No historical data export, checksum, reconciliation, or import.
- No production Worker/D1/R2/DNS change.
- No remote D1 migration.
- No production file copy/delete.
- No Firebase/Supabase deletion.
- No deployment.
