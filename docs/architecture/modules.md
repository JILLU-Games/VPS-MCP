---
order: 2
---

# Codebase and Module Responsibilities

> Source tree of **22 TypeScript modules** re-inventoried on 2026-11-20 at `5c19d0a9fff8d63bd55a4447c891f2b26374c32b`. Entries below group related modules; see the full [source verification and inventory](../audit/source-verification-2026-11-20.md).

| Area / path | Responsibility | Classification |
| --- | --- | --- |
| `src/index.ts` | Start server and read configuration | Application entrypoint |
| `src/shared/config.ts` | Environment schema, origin/port/scope validation | Core internal config |
| `src/server/http.ts` | HTTP routes, admin, discovery, MCP transport hookup | Internal application API router |
| `src/server/mcp.ts` | MCP tool registration, policy-enforced invocation | Internal MCP implementation |
| `src/security/authentication.ts` | Password hashing/verification helpers | Internal security |
| `src/security/admin-setup.ts` | One-time first-admin account bootstrap | Internal security |
| `src/security/oauth.ts` | Client registration, authorize/token/revoke flow | Internal security |
| `src/security/policy.ts` | Persisted per-tool/per-client gating | Internal policy |
| `src/security/audit.ts` | Append-only-ish audit event persistence and reporting | Internal audit |
| `src/security/network.ts` | Draft domain/SSL/private host port and DNS resolver check | Internal settings |
| `src/security/cloudflare-dns.ts` | Cloudflare scoped zone DNS CRUD | Internal provider adapter |
| `src/tools/*` | Read-only and restricted tool implementations | MCP tools; exported symbols now inventoried |
| `src/broker/*` | Optional host operation broker | Not enabled by default Compose |
| `public/panel.{html,css,js}` | Compact administrative dashboard | Client-side UI |
| `Dockerfile`, `compose.yaml` | Container build/private service profile | Deployment |
| `scripts/install.sh`, `scripts/update.sh`, etc. | Provisioning, state safety, backup/restore | Operator CLI |
| `tests/*.test.ts` | Node/TypeScript source, HTTP and UI regressions | Test suite |
| `.github/workflows/phase02.yml` | Previous CI typecheck/tests/build, audits, Docker smoke | CI |

Full module file paths and exported-name inventory were checked in this pass. A complete dependency graph and every internal method signature are not certified; see [source verification](../audit/source-verification-2026-11-20.md).
