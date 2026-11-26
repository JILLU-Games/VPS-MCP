# 002 — A-to-Z Phased Implementation Roadmap (With Strict Scope Locks)

**Baseline Reference:** `/notes/000-BASELINE-FREEZE-MANIFEST.md`  
**Bug Specification Reference:** `/notes/001-PRODUCTION-READINESS-BUG-SPEC.md`

To guarantee zero regressions, every bug fix from the forensic audit is organized into **4 sequential, scope-locked phases**. No phase may touch files outside its locked scope.

---

## Phase 1: Auth, Session, First-Run Setup & Production Startup Hardening

* **Bugs Resolved:** `BUG-01`, `BUG-02`, `BUG-07`, `BUG-09`, `BUG-10` (5 Bugs)
* **Locked File Scope (ONLY these files may be edited in Phase 1):**
  1. `/src/index.ts`
  2. `/src/security/authentication.ts`
  3. `/public/panel.html`
  4. `/public/panel.js`
  5. `/tests/setup.test.ts` (and/or `/tests/ui.test.ts` for new unit tests)
* **Strictly Out of Scope in Phase 1:**
  - `/src/security/network.ts`, `/src/security/cloudflare-dns.ts`, `/src/security/oauth.ts`, `/src/security/policy.ts`, `/src/broker/*`, `/compose.yaml`, `/scripts/*`, `/public/panel.css`.
* **Step-by-Step Implementation Checklist:**
  1. **`/src/index.ts` (`BUG-01`):** In `applyRuntimeDefaults()`, when `NODE_ENV === 'production'`, ensure that if no `ADMIN_PASSWORD_HASH`, no `MCP_SETUP_TOKEN_HASH`, and no `MCP_ADMIN_STATE_FILE` (or `.complete` marker) exist on disk, a cryptographically random one-time setup token is generated (`MCP_SETUP_TOKEN_HASH`) and logged to `stderr` so fresh container/cloud deployments boot cleanly into the mandatory First-Run Setup screen instead of crashing.
  2. **`/src/security/authentication.ts` (`BUG-07`, `BUG-09`):**
     - Remove the unverified password bypass in `SessionManager.login()` so Demo mode verifies against the actual `ADMIN_PASSWORD_HASH` (`AdminControl#2026` initialized by `AdminSetup`) using `verifyPasswordNonBlocking` and enforces brute-force lockout counters identically to production.
     - Tighten `cookieAttributes(req)` so `SameSite=None; Secure; Partitioned` is only set when `x-forwarded-proto === 'https'` or `Origin` is an `https://*.run.app` origin, preventing plain HTTP `127.0.0.1` cookies from being marked `Secure`.
  3. **`/public/panel.js` (`BUG-02`):** In `api(url, options)`, automatically attach `headers['x-session-token'] = state.sessionToken` whenever `state.sessionToken` is non-empty, and include `message: data.message` on thrown API error objects.
  4. **`/public/panel.html` (`BUG-10`):** Remove the invalid 8-character `value="Pass@123"` attribute from `#setup-password` (line 12) and replace it with `placeholder="Choose a strong 12+ character password"`.
  5. **Verification Gate:** Run `npx tsx --test tests/*.test.ts`, `npm run build`, and `npm run lint`, then log completion in `/notes/003-PHASE-EXECUTION-LOG.md`.

---

## Phase 2: Real Domain, DNS & SSL Verification Engine

* **Bugs Resolved:** `BUG-03`, `BUG-04`, `BUG-05`, `BUG-11`, `BUG-12` (5 Bugs)
* **Locked File Scope (ONLY these files may be edited in Phase 2):**
  1. `/src/shared/config.ts`
  2. `/.env.example`
  3. `/src/security/network.ts`
  4. `/src/server/http.ts` (lines 280–310 `/api/network/domains` error handling only)
  5. `/public/panel.js` (lines 295–315 & 785–845 DNS/SSL status badge rendering only)
  6. `/tests/network.test.ts`
* **Strictly Out of Scope in Phase 2:**
  - `/src/security/authentication.ts`, `/src/security/admin-setup.ts`, `/src/security/oauth.ts`, `/src/security/cloudflare-dns.ts`, `/src/broker/*`, `/compose.yaml`, `/scripts/*`, `/public/panel.html`, `/public/panel.css`.
* **Step-by-Step Implementation Checklist:**
  1. **`/src/shared/config.ts` & `/.env.example` (`BUG-05`):** Add `MCP_PUBLIC_IP: z.string().default('')` to allow explicit public IPv4 configuration, and add a helper in `/src/security/network.ts` that resolves the server's real target IP from `config.MCP_PUBLIC_IP`, `originHost` (if public IPv4), or non-internal IPv4 from `os.networkInterfaces()`.
  2. **`/src/security/network.ts` (`BUG-11`):** Update `classifyDomain()` and `dnsRecommendations()` to recognize multi-part public suffixes (`.co.uk`, `.org.uk`, `.com.bd`, `.com.au`, `.co.in`, etc.) so `example.co.uk` is classified as a `root` domain (`@`) while `mcp.example.co.uk` is classified as a `subdomain` (`mcp`).
  3. **`/src/security/network.ts` (`BUG-03`):**
     - Remove the fake `else { item.sslStatus = 'active'; item.sslIssuer = 'Auto-verified (Gateway TLS)'; }` block in `checkDomainDnsAndSsl()`.
     - Update `checkTlsCertificate(domain)` to validate certificate expiry (`valid_to`) and hostname identity (`tls.checkServerIdentity(domain, cert)`). If port 443 is unreachable or presents an invalid cert, set `sslStatus` to `'pending'` or `'failed'` with the real reason.
  4. **`/src/security/network.ts` (`BUG-04`):** Enhance `checkDomainDnsAndSsl()` with injectable DNS/TLS resolver support for deterministic unit testing and real verification of `_vpsmcp-challenge.<domain>` TXT token (`vpsmcp-verify=<verifyToken>`) or target IP/CNAME match.
  5. **`/src/server/http.ts` (`BUG-12`):** In `POST /api/network/domains`, return HTTP `503 { error: 'network_storage_unavailable' }` when filesystem persistence fails (`EACCES`, `EISDIR`, `ENOSPC`, etc.), and HTTP `400` for validation errors.
  6. **Verification Gate:** Run `npx tsx --test tests/*.test.ts`, `npm run build`, and `npm run lint`, then log completion in `/notes/003-PHASE-EXECUTION-LOG.md`.

---

## Phase 3: Live Domain Routing & Dynamic Host/Origin Allowlist

* **Bugs Resolved:** `BUG-06` (1 Bug)
* **Locked File Scope (ONLY these files may be edited in Phase 3):**
  1. `/src/security/network.ts`
  2. `/src/server/http.ts` (lines 118–138 Host/Origin check)
  3. `/tests/network.test.ts`
* **Strictly Out of Scope in Phase 3:**
  - `/src/security/authentication.ts`, `/src/security/oauth.ts`, `/src/security/policy.ts`, `/src/broker/*`, `/public/*`, `/compose.yaml`, `/scripts/*`.
* **Step-by-Step Implementation Checklist:**
  1. **`/src/security/network.ts` (`BUG-06`):** Add `isAllowedHost(hostHeader: string): boolean` and `isAllowedOrigin(originHeader: string): boolean` to `NetworkSettings` so any domain added to `this.domains` (or staged in `this.plan.domain`) is recognized at runtime.
  2. **`/src/server/http.ts` (`BUG-06`):** Update the `Host` and `Origin` guard at lines 124–136 to consult `network.isAllowedHost(host)` and `network.isAllowedOrigin(req.headers.origin)` so traffic routed through a reverse proxy / HTTPS gateway for a managed domain is accepted instead of returning `403 Invalid host`.
  3. **Verification Gate:** Add a test in `/tests/network.test.ts` proving that adding `mcp.example.com` allows requests with `Host: mcp.example.com` and `Origin: https://mcp.example.com`, while unlisted external hosts are still blocked with `403`. Run full test suite & log in `/notes/003-PHASE-EXECUTION-LOG.md`.

---

## Phase 4: Production Execution Broker Engine Integration

* **Bugs Resolved:** `BUG-08` (1 Bug)
* **Locked File Scope (ONLY these files may be edited in Phase 4):**
  1. `/compose.yaml`
  2. `/scripts/install.sh`
  3. `/scripts/restore.sh` (if needed for `.env` validation)
  4. `/tests/phase04.test.ts`
* **Strictly Out of Scope in Phase 4:**
  - All frontend files (`/public/*`) and all unrelated security modules.
* **Step-by-Step Implementation Checklist:**
  1. **`/compose.yaml` (`BUG-08`):**
     - Add shared volume `mcp-socket` mounted at `/run/vps-mcp` in `init-data`, `broker`, and `api`.
     - Update `init-data` command to initialize `/data` and `/run/vps-mcp` with `chown 10001:10001` and `chmod 0700`.
     - Add the `broker` service running `["node", "dist/broker/main.js"]` with `user: "10001:10001"`, `read_only: true`, `cap_drop: [ALL]`, and `security_opt: ["no-new-privileges:true"]`.
  2. **`/scripts/install.sh` (`BUG-08`):**
     - Generate `broker_secret="$(openssl rand -hex 32)"` and include `MCP_BROKER_SOCKET=/run/vps-mcp/broker.sock` and `MCP_BROKER_SECRET=$broker_secret` in the generated `.env`.
  3. **Verification Gate:** Run `npx tsx --test tests/*.test.ts`, `npm run build`, and `npm run lint`, then log completion in `/notes/003-PHASE-EXECUTION-LOG.md`.
