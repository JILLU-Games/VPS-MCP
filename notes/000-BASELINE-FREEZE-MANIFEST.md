# 000 — Baseline Freeze & Scope-Lock Manifest (2026-11-26)

**Status:** FROZEN BASELINE (`v0.4.0-audit-baseline`)  
**Frozen At:** 2026-11-26  
**Test Suite Baseline:** 61 / 61 tests passing (`tests/*.test.ts`)  
**Typecheck Baseline:** `tsc --noEmit -p tsconfig.json` (0 errors)  
**Audit Reference:** `/notes/PRODUCTION-FORENSIC-AUDIT-2026-11-26.md`

---

## 1. Frozen File Inventory & Line Counts

| File Path | Total Lines | Role in System | Baseline State |
| :--- | :--- | :--- | :--- |
| `/src/index.ts` | 55 | Runtime entrypoint & `applyRuntimeDefaults()` | Active (Has BUG-01) |
| `/src/shared/config.ts` | 104 | Zod environment configuration & validation | Active (Has BUG-01, BUG-05) |
| `/src/server/http.ts` | 502 | HTTP/HTTPS server, REST API, OAuth endpoints, CSP, Host/Origin guard | Active (Has BUG-06, BUG-07, BUG-12) |
| `/src/server/mcp.ts` | 107 | MCP server tool registration & RBAC policy wrapper | Active (Production Ready) |
| `/src/security/admin-setup.ts` | 71 | First-run SHA-256 setup token & `admin.json` persistence | Active (Has BUG-01) |
| `/src/security/authentication.ts` | 132 | `scrypt` password hashing, session manager, cookies & lockout | Active (Has BUG-07, BUG-09) |
| `/src/security/authorization.ts` | 17 | OAuth scope evaluators (`vps:read`, `vps:write`) | Active (Production Ready) |
| `/src/security/approvals.ts` | 85 | Single-use approval queue for write operations | Active (Production Ready) |
| `/src/security/audit.ts` | 57 | Durable JSONL security audit logger | Active (Production Ready) |
| `/src/security/cloudflare-dns.ts` | 183 | Cloudflare API v4 live DNS record manager | Active (Production Ready) |
| `/src/security/control.ts` | 24 | Persistent MCP master enable/disable toggle (`control.json`) | Active (Production Ready) |
| `/src/security/network.ts` | 237 | Network plan draft, manual domain CRUD, DNS & TLS checker | Active (Has BUG-03, BUG-04, BUG-05, BUG-11) |
| `/src/security/oauth.ts` | 272 | OAuth 2.1 + PKCE authorization server & token store | Active (Production Ready) |
| `/src/security/policy.ts` | 149 | Global & per-client tool/action/scope policy store (`policy.json`) | Active (Production Ready) |
| `/src/broker/protocol.ts` | 14 | Zod schemas for Unix socket broker requests | Active (Production Ready) |
| `/src/broker/client.ts` | 32 | Unix socket client for privileged broker calls | Active (Production Ready) |
| `/src/broker/server.ts` | 118 | Unix socket server executing `file.create`, `docker.*`, `deploy.*` | Active (Production Ready) |
| `/src/broker/main.ts` | 10 | Standalone broker process entrypoint | Active (Has BUG-08: not wired in Compose/Installer) |
| `/src/tools/system.ts` | 33 | `system_status` & `disk_usage` implementation | Active (Production Ready) |
| `/src/tools/filesystem.ts` | 75 | `workspace_list`, `workspace_read`, `workspaceCreate` with symlink protection | Active (Production Ready) |
| `/src/tools/docker.ts` | 9 | `docker_status` broker wrapper | Active (Production Ready) |
| `/src/tools/deployment.ts` | 8 | `deployment_status` broker wrapper | Active (Production Ready) |
| `/public/panel.html` | 169 | Compact dark Admin Console HTML markup | Active (Has BUG-10) |
| `/public/panel.css` | 908 | Compact Admin Console stylesheet | Active (Production Ready) |
| `/public/panel.js` | 888 | CSP-safe frontend controller (zero `innerHTML`/`eval`) | Active (Has BUG-02) |
| `/compose.yaml` | 52 | Docker Compose production stack definition | Active (Has BUG-08) |
| `/scripts/install.sh` | 59 | Production installer & `.env` generator | Active (Has BUG-08) |
| `/scripts/apply-network.sh` | 54 | SSH host-port applier | Active (Has BUG-06) |

---

## 2. Universal Scope-Lock Rules (Enforced Across All Phases)

1. **Zero Out-of-Scope Edits:** During any Phase `N`, ONLY the files and line ranges explicitly listed in Phase `N`'s **Locked File Scope** may be modified.
2. **Preserve All Existing Features & UI:**
   - Do NOT remove, rename, or break the compact Admin Panel UI layout, `.vibtools/logo.png` (`/assets/logo.png`, `/favicon.ico`), 7 sidebar pages (`Overview`, `Tool access`, `Operations`, `Clients`, `Approvals`, `Domain & SSL`, `Security audit`), or Cloudflare DNS manager.
   - Do NOT use `innerHTML` or `eval` in `public/panel.js` (strictly enforced by `tests/ui.test.ts`).
   - Every `$('id')` and `put('id', ...)` in `public/panel.js` MUST match an existing `id="..."` in `public/panel.html`.
3. **Mandatory Verification Gate Per Phase:**
   - All existing 61 tests + new phase-specific unit tests must pass (`npx tsx --test tests/*.test.ts`).
   - TypeScript build (`npm run build`) and typecheck (`npm run lint`) must pass with 0 errors.
   - Document completion in `/notes/003-PHASE-EXECUTION-LOG.md` and `/notes/005-ACTUAL-IMPLEMENTATION-TRACKER.md`.

---

## 3. Notes Directory Index

| Document | Purpose |
| :--- | :--- |
| `/notes/PRODUCTION-FORENSIC-AUDIT-2026-11-26.md` | Original deep-scan forensic audit report with source code proofs for all 12 bugs |
| `/notes/000-BASELINE-FREEZE-MANIFEST.md` | Frozen baseline file inventory, line counts, and universal scope-lock constitution |
| `/notes/001-PRODUCTION-READINESS-BUG-SPEC.md` | Exact file paths, line numbers, root-cause code blocks, and exact code patches for BUG-01 to BUG-12 |
| `/notes/002-PHASED-IMPLEMENTATION-ROADMAP.md` | Step-by-step A–Z implementation plan across Phases 1, 2, 3, and 4 with strict per-phase scope locks |
| `/notes/003-PHASE-EXECUTION-LOG.md` | Live phase completion tracker recording completed phases, changed files, test results, and remaining phases |
| `/notes/004-ERROR-HANDLING-REGISTRY.md` | Complete catalog of existing HTTP/OAuth/DNS/MCP error codes + new production error codes to add |
| `/notes/005-ACTUAL-IMPLEMENTATION-TRACKER.md` | Feature-by-feature ledger of what is currently working in real production vs. what is added per phase |
