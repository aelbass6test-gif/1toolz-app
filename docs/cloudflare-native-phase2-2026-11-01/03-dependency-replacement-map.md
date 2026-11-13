# Firebase/Supabase dependency replacement map

## Current finding

The fresh-start target is that the frontend and backend operate without Firebase or Supabase. The current branch does not meet that condition. Static inspection found direct runtime imports and services in the application, while `services/cloudflareClient.ts` already provides a partial Worker API adapter.

The previous audit recorded 182 Firebase references in 20 of 317 source files. This phase did not reinterpret those historical references as data-migration work; it focused on runtime replacement.

## Direct runtime Firebase work

| Path | Current use | Replacement |
|---|---|---|
| `App.tsx` | Firestore listeners/queries plus Firebase client | Worker `/api/v1/data/*` and explicit realtime mechanism; remove `onSnapshot` dependency |
| `services/firebaseClient.ts` | Firebase app/auth/Firestore initialization | delete only after all callers are removed; replace with Worker client |
| `services/userMigrationService.ts` | Firestore user migration operations | remove as historical migration utility; new account creation uses `/api/v1/auth/register` |
| `services/reportShareService.ts` | Firestore report-share reads/writes | add authenticated Worker report-share resource backed by D1/R2 |
| `services/orderQuotaLedgerService.ts` | Firestore transaction/update logic | add D1 quota/ledger transaction endpoint with idempotency |
| `src/pages/MaintenancePage.tsx` | Firestore maintenance reads/writes | add D1 maintenance resource and Worker route |
| `components/CustomerQuoteApprovalPage.tsx` | Firestore quote operations | add authenticated quote resource and role checks |
| `server.ts` | Firebase server reads/writes | remove legacy server adapter or convert to Worker API calls |
| `get_settings.ts`, `list_products.ts`, `create-demo-order.ts` | CLI/demo Firebase operations | rewrite as synthetic-data Worker API scripts or archive explicitly |

## Direct runtime Supabase work

| Path/group | Current use | Replacement |
|---|---|---|
| `services/supabaseAuthService.ts`, `src/hooks/useAuthActions.ts`, `components/SignUpPage.tsx` | Supabase auth flows | use the existing Worker auth endpoints, then complete recovery/refresh/activation coverage |
| `services/supabaseMembershipService.ts`, `utils/supabaseMembership*` | membership/role lookup | D1 membership tables and `/api/v1/memberships` route |
| `services/databaseService.ts` and many `components/*` | Supabase table reads/writes | route through typed Worker resources, not a generic unbounded table proxy |
| `server.ts` | Supabase server client | remove after equivalent Worker routes exist |
| `supabase/functions/**` | Edge functions for users, merchants, WhatsApp | port behavior into Worker modules/routes; keep no Supabase runtime imports |
| `components/EmployeeAccountSettingsPage.tsx`, `EmployeesPage.tsx`, `FirebaseActionPage.tsx` | Supabase password/membership/admin calls | Worker auth/admin endpoints |
| `src/hooks/useLiveCollaboration.ts`, `services/*`, `components/TeamChatPage.tsx` | realtime/chat operations | D1 plus Durable Objects or a deliberately scoped polling/SSE design |
| `components/InvoiceAttachmentUploader.tsx`, `MediaLibraryModal.tsx` | storage/attachments | R2 upload/download/delete with signed or authorized URLs |

## Required endpoint families

1. `/api/v1/auth/*` — register, login, OTP, recovery, change password, refresh, logout, current session.
2. `/api/v1/users`, `/api/v1/roles`, `/api/v1/memberships` — role and store membership administration.
3. `/api/v1/stores`, `/api/v1/products`, `/api/v1/inventory` — store and catalog persistence.
4. `/api/v1/orders`, `/api/v1/order-items`, `/api/v1/returns` — order lifecycle.
5. `/api/v1/wallets`, `/api/v1/ledger`, `/api/v1/withdrawals`, `/api/v1/deposits` — atomic financial workflow.
6. `/api/v1/settings`, `/api/v1/notifications`, `/api/v1/audit`, `/api/v1/shipping` — remaining application domains.
7. `/api/v1/files/*` — authorized R2 operations.

## Removal gate

Do not remove Firebase/Supabase packages or configuration yet. The gate is: zero non-test runtime imports, successful route-level tests for each replacement family, clean build, and a synthetic fresh-start account that survives refresh and a new session.
