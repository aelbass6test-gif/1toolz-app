# Fresh-start D1 migrations

These migrations define the clean Cloudflare-native starting point. They do not export, import, checksum, or preserve historical Firebase/Supabase records.

Run `0001_core.sql` first, then the existing OTP, auth MFA, wallet ledger, and WhatsApp event migrations in their documented order. Do not run the legacy identity-seeding migration in a fresh-start database: it reads historical `app_records` and is intentionally outside this path.

This migration has not been applied to any remote D1 database. Before a staging apply, verify the exact database ID, obtain D1 read/write authorization, run against the isolated lab target, and record schema/table/index/trigger verification.
