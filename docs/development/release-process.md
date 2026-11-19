---
order: 5
---

# Build, CI and Release Readiness

## Verified elements from prior project history

- TypeScript compilation and tests executed through npm scripts.
- `npm ci` used in the Dockerfile; **CI uses `npm install --no-audit --no-fund`** and runs the lockfile-backed project tests.
- GitHub Actions workflow `.github/workflows/phase02.yml` exercised code checks, npm audit and an isolated Docker install/first-setup/backup/restore scenario.
- Private Docker Compose profile existed with non-root, read-only filesystem, localhost published port and private state volume.

## Not established

- A current signed release/tag/changelog policy.
- Published npm package entrypoint and semver compatibility guarantee.
- Reproducible multi-architecture container images and immutable image/action digests.
- Production HTTPS gateway or public AI service readiness.
- Verified live VPS migration/backup-restore rehearsal.

## Pre-release gates

1. Reopen the current repository at a specific immutable commit and enumerate files and exports.
2. Reconcile all guides, HTTP routes, MCP schemas and environment defaults with source.
3. Run typecheck/tests/build and package audit with exact commit recorded.
4. Run isolated Docker smoke tests including startup, first-admin flow, port setting and credential restore.
5. Validate real provider behavior in a non-critical Cloudflare test zone.
6. Conduct a separate security review before privileged broker or public HTTPS deployment.
7. Record release artifacts and deployment compatibility as established by actual workflow configuration.

This documentation package was prepared without code changes or deployment. Its Markdown files are intended for a documentation-only Git commit; no release tag or production deployment is authorized.
