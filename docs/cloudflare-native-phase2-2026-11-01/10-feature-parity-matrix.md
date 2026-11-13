# 1Toolz feature parity matrix — implementation checkpoint

This is an execution checkpoint, not a completion claim. A feature is verified only when its current UI behavior is served through the Cloudflare Worker, persists to fresh D1/R2, and passes a synthetic test that re-reads state after refresh and a new session.

| Domain | Cloudflare surface | Status | Required proof |
|---|---|---|---|
| Authentication, OTP, recovery | `/api/v1/auth/*`, OTP routes | Partial | staging Worker/D1 E2E |
| Roles and memberships | auth context and data reads | Partial | native role and membership E2E |
| Stores, settings, products, inventory | generic `/api/v1/data/*` | Partial | typed persistence and route tests |
| Orders, order items, returns | generic data route | Partial | clean-data lifecycle tests |
| Subscriptions and commissions | no complete dedicated route | Gap | D1 entities, API, and tests |
| Wallets, deposits, withdrawals | wallet ledger and triggers | Partial | remote synthetic workflow |
| Notifications and activity | audit/webhook pieces | Partial | native delivery and persistence tests |
| Shipping and delivery | Bosta routes; Turbo guarded | Partial | staging provider endpoint and tests |
| WhatsApp and chat | webhook/event route | Partial | chat persistence and authorization tests |
| R2 images/files | media upload/delete/read routes | Partial | application-level upload round-trip |
| Reports and documents | report services plus media | Partial | report persistence and secure file tests |
| Administration and audit | auth/audit foundations | Partial | admin action persistence tests |
| Realtime collaboration | no completed native contract | Gap | explicit SSE/DO/polling design and tests |

The matrix is not complete while runtime Firebase/Supabase imports remain in the production bundle or while any row lacks clean synthetic verification.
