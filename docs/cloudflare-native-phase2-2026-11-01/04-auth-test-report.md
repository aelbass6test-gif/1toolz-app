# Authentication test report — fresh-start phase

## Verified locally

The accepted previous checkpoint includes `tests/auth-validation.test.ts` and server-side MFA/session changes. The existing local checks cover the additive auth-session migration, pending/verified MFA gating, OTP flow structure, and auth context behavior. The previous audit also passed lint, build, and the auth validation test.

## Not independently verified in this phase

No remote D1 authentication test was run because the Cloudflare D1 query API returned `SQLITE_AUTH`. No real OTP was sent. No old account or credential was used.

The following remain required with synthetic accounts only (admin, agent, merchant/client):

- registration and activation;
- password login and OTP delivery/verification;
- invalid, expired, replayed, and cancelled OTP;
- logout/session revocation;
- password recovery and password change;
- expiry and refresh across a fresh session;
- role-based access and unauthorized API responses;
- duplicate phone identity collision;
- rate-limit behavior and account activation state.

## Acceptance evidence required

Each test must read the resulting state from D1 after the request and again after a fresh session. The report must record only synthetic identifiers and must exclude passwords, OTPs, session tokens, and secrets.

## Current status

**Code remediation:** partially implemented.
**Operational authentication readiness:** not proven.
**Blocking conditions:** complete clean-start D1 schema plus D1 read/write test access and a non-production OTP delivery test harness.
