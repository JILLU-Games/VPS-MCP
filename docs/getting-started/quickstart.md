---
order: 3
---

# Developer Quickstart

This is the smallest previously documented development path; a fresh invocation is **not claimed to have been tested here**.

```bash
git clone https://github.com/vibtoolshq/VPS-MCP.git
cd VPS-MCP
npm ci
npm run check
```

The earlier package scripts ran a TypeScript typecheck, Node tests via `tsx --test tests/*.test.ts`, and a TypeScript build. Check the current package metadata before making it part of CI on another branch.

For a private running server, use the [Docker installer](installation.md). For local development, see [Local development setup](../development/local-setup.md) and [Configuration](../reference/configuration.md); local authentication setup requires the real hash/config helper, not a guessed hard-coded admin password.

### First successful request

Once the private server is running **on the VPS host**:

```bash
curl --fail --silent http://127.0.0.1:3000/health
```

This only confirms health. Admin routes require a session cookie, and state-changing routes also require an anti-CSRF token. MCP calls require an OAuth bearer token; neither can be replaced by a dummy credential.

### Next steps

- [HTTP API](../api/http.md) for admin routes.
- [MCP tools](../api/mcp.md) for allowed capabilities.
- [Internal architecture](../architecture/overview.md) before adding tools.
- [Cloudflare DNS](../guides/cloudflare-dns.md) for a real DNS provider integration.
