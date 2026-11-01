# Staging readiness checklist

## Target

Use only `cloudflare-worker/wrangler.native-staging.toml` and the isolated lab bindings. Never substitute a production endpoint for the missing Turbo staging URL.

## Before deployment

- [ ] Confirm the PR/branch and exact Worker script name.
- [ ] Obtain read access and independently verify all three D1 lab database IDs and schema.
- [ ] Confirm no production D1/R2/DNS binding appears in the staging configuration.
- [ ] Confirm secrets are scoped to staging and are not written to Git or frontend code.
- [ ] Complete the clean-start D1 migration set and local migration tests.
- [ ] Run synthetic auth, role, order, wallet, refresh, and R2 route tests.
- [ ] Decide the Turbo staging endpoint explicitly; keep Turbo disabled with 503 until then.
- [ ] Verify image URLs resolve only to the lab/public staging origin.
- [ ] Prepare rollback as Worker version rollback plus D1 migration rollback/forward-fix plan.
- [ ] Obtain explicit approval for the exact deployment target and command.

## Exact command (not executed)

```bash
npx --yes wrangler@4.33.0 deploy \
  --config cloudflare-worker/wrangler.native-staging.toml
```

This command is intentionally documented only. No Worker deployment was executed in this phase.

## Current blockers

1. D1 API read access returns `SQLITE_AUTH`.
2. The repository does not yet contain the complete fresh-start application schema.
3. Turbo staging URL is intentionally absent; no production substitution is allowed.
4. Frontend runtime still contains Firebase/Supabase operations.
5. Full application-level synthetic acceptance tests are not yet complete.
