---
order: 2
---

# Dependencies, Runtime and Build Inputs

## Known implementation technologies

| Component | Role | Version certainty |
| --- | --- | --- |
| Node.js | Application runtime | 22 used in previous CI |
| TypeScript | Typechecking / compiled server code | Verified `^5.9.0` in current package metadata |
| `tsx` | Execute TypeScript tests in previous package scripts | Verified `^4.20.0` in current package metadata |
| Zod (`zod/v4` imports) | Validate configuration/network/provider data | Verified `^4.2.0` in current package metadata |
| MCP SDK / Streamable HTTP adapter | MCP transport and tool registration | Verified `@modelcontextprotocol/node@2.1.2`, `@modelcontextprotocol/server@2.4.0`; test client `@modelcontextprotocol/client@2.4.0` |
| npm | Package installation; `npm ci` uses lockfile | Exact CLI version not reverified |
| Docker Engine + Compose plugin | Private image, volume, service lifecycle | Host versions not certified |
| Bash, coreutils, curl, tar, OpenSSL | Installer/backup/restore/port helper | Supported distro versions not certified |
| Cloudflare HTTPS API v4 | Optional one-zone DNS CRUD | Real external provider test pending |

### Reproducible installation

```bash
npm ci
npm run check
```

The tracked `package-lock.json` is present. **Dockerfile runs `npm ci`**, while the current GitHub Actions workflow runs **`npm install --no-audit --no-fund`** before `npm run check` (not `npm ci`). Exact transitive dependency integrity values were not independently audited in this documentation pass. Lockfile pinning does not pin a Docker base image by digest unless the Dockerfile itself does so.

## No invented distribution routes

No successful npm package publishing, registry name, Python package, shared library ABI, or standalone Windows executable distribution was established. These should not be added to quickstarts until verified against actual package/release files.

Before release, separately audit `package-lock.json` integrity, Docker image digests, Compose configuration and GitHub Actions pinning; run `npm audit` and container scanning with a recorded revision.
