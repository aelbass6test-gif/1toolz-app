# R2 operational test report — lab only

## Lab resources

- `1toolz-product-images-lab`
- `1toolz-cloudflare-backups-lab`

Both buckets returned an empty object listing before the test.

## Executed synthetic test

In `1toolz-product-images-lab`, the following deterministic object was used:

`phase2-synthetic/r2-content.txt`

The test performed:

1. PUT synthetic text with `Content-Type: text/plain`;
2. GET the object and verified the returned content exactly as `1toolz-phase2-content-check`;
3. DELETE the object;
4. list the synthetic prefix and verified no remaining object.

The operation succeeded and was fully cleaned up. No production bucket or file was accessed.

## Code review status

The Worker contains R2 paths for image upload, image retrieval, and media deletion. The current implementation includes image MIME validation and key/path checks. A complete acceptance run still needs explicit checks for size limits, authorization, signed URL expiry, metadata persistence, and recovery semantics through the application route rather than only the Cloudflare object API.

## Current status

**Synthetic direct R2 lifecycle:** passed in lab.
**Full application-level R2 acceptance:** not yet proven.
**Production impact:** none.
