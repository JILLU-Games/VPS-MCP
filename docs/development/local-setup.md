---
order: 1
---

# Local Development Setup

These are **previously recorded commands**, not freshly executed in this documentation pass:

```bash
git clone https://github.com/vibtoolshq/VPS-MCP.git
cd VPS-MCP
npm ci
npm run check
```

A development `.env` is distinct from the private Compose installation. The repository previously shipped `.env.example` and `scripts/hash-password.mjs`. Refer to those exact files **on the working revision** rather than using a guessed default password.

A separate command in previous docs was:

```bash
npm run dev
```

Its exact invocation should be confirmed in current `package.json` before use. Do not run a developer process bound publicly or turn on broker writes to simplify local testing.

### Suggested reading order

1. `src/shared/config.ts` to understand validated environment fields.
2. `src/server/http.ts` for route dispatch, auth, OAuth and status.
3. `src/server/mcp.ts` for registration/authorization semantics.
4. `src/security/policy.ts`, `audit.ts`, `oauth.ts`, `admin-setup.ts` for trust boundaries.
5. `src/security/cloudflare-dns.ts` for provider SDK behavior.
6. `tests/*.test.ts` to observe supported input/denial cases.

**No source files were edited by this documentation workflow.**
