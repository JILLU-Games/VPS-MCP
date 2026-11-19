# Source Verification — GitHub `main` (2026-11-20)

**Read directly from:** [VPS-MCP repository](https://github.com/vibtoolshq/VPS-MCP/tree/5c19d0a9fff8d63bd55a4447c891f2b26374c32b); source commit `5c19d0a9fff8d63bd55a4447c891f2b26374c32b`. Linked GitHub account has verified repository push permission.

## What was inspected

- Full recursive repository file tree (not truncated), including **22 TypeScript source modules** and **10 TypeScript test files**.
- Package scripts, runtime version constraint, npm package private status and direct dependencies.
- The `loadConfig()` Zod schema, validation and computed values.
- Registered HTTP endpoints and eight MCP tool names.
- Exported source symbols from all 22 modules; these are **internal exports**, not published npm package interfaces.
- Cloudflare provider `connect`, `disconnect`, `list`, `create`, `update`, `remove` definitions including expected-content stale edit guard.
- Current Dockerfile, `compose.yaml`, `.env.example`, installer/update/backup/restore scripts and GitHub CI workflow.

## TypeScript source-level export index

| Path | Named source exports (not stable package API) |
| --- | --- |
| `src/broker/client.ts` | brokerCall |
| `src/broker/main.ts` | (entrypoint; no named exports) |
| `src/broker/protocol.ts` | brokerActionSchema, BrokerAction, brokerRequestSchema |
| `src/broker/server.ts` | executeBrokerAction, startBroker |
| `src/index.ts` | (entrypoint; no named exports) |
| `src/security/admin-setup.ts` | AdminSetup |
| `src/security/approvals.ts` | operationSchema, WriteOperation, ApprovalQueue |
| `src/security/audit.ts` | AuditEvent, AuditLog |
| `src/security/authentication.ts` | Session, hashPassword, verifyPassword, safeEqual, SessionManager |
| `src/security/authorization.ts` | READ_SCOPE, WRITE_SCOPE, AccessIdentity, canRead, canWrite, allowedTool |
| `src/security/cloudflare-dns.ts` | DnsError, CloudflareDns |
| `src/security/control.ts` | loadMcpEnabled, persistMcpEnabled |
| `src/security/network.ts` | NetworkPlan, NetworkSettings |
| `src/security/oauth.ts` | OAuthError, OAuthService |
| `src/security/policy.ts` | ACTIONS, Action, PolicyStore |
| `src/server/http.ts` | createHttpServer, listenServer, listenLocal |
| `src/server/mcp.ts` | createMcpServer |
| `src/shared/config.ts` | AppConfig, loadConfig |
| `src/tools/deployment.ts` | deploymentStatus |
| `src/tools/docker.ts` | dockerStatus |
| `src/tools/filesystem.ts` | WorkspaceEntry, validateRelative, safePath, workspaceList, workspaceRead, workspaceCreate |
| `src/tools/system.ts` | systemStatus, DiskPath, diskUsage |

## Package and operational findings

- `package.json` name **`vps-mcp`**, version **`0.4.0`**, **`private: true`**, Node **`>=22`**, ESM. No published npm `exports` map.
- Direct dependencies: `@modelcontextprotocol/node@2.1.2`, `@modelcontextprotocol/server@2.4.0`, `zod@^4.2.0`. Developer dependencies: `@modelcontextprotocol/client@2.4.0`, `@types/node@^22.15.0`, `tsx@^4.20.0`, `typescript@^5.9.0`.
- `npm run check` chains typecheck + `tsx --test tests/*.test.ts` + TypeScript build. CI currently invokes `npm install --no-audit --no-fund`; the Dockerfile uses `npm ci`.
- Private `compose.yaml` publishes `127.0.0.1:${MCP_BIND_PORT:-3000}:3000` only; API container runs uid 10001, rootfs read-only, no Docker socket, dedicated private data volume.
- Installer generates `.env` and one-time first-admin activation token. `Pass@123` is **an example only**, not a live default password.
- Cloudflare DNS is one-zone admin HTTP functionality; no DNS MCP tools are registered. DNS connection does not automate TLS, OAuth origin, or public ChatGPT connectivity.
- Previous GitHub CI run [40776225155](https://github.com/vibtoolshq/VPS-MCP/actions/runs/40776225155) completed successfully at the same source SHA. This was historical evidence, not rerun during docs publication.

## Evidentiary limitations

Source-path/exports and selected signatures are **fresh verification**. Every internal method parameter/DTO and every legacy doc passage have **not** been independently exhaustively audited. No new tests, real browser trials, live Cloudflare mutation, live VPS install, or ChatGPT OAuth connection was executed in this documentation task.

See [Coverage report](coverage-and-validation.md) and [Documentation mismatches](documentation-mismatches.md).
