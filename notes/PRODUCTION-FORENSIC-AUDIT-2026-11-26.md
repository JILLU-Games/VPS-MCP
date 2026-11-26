# VPS-MCP Production Forensic Audit & Deep Scan Report

**Audit Date:** 2026-11-26  
**Scope:** End-to-End Source Code Forensic Verification of Production Readiness, Demo vs. Production Auth Parity, UI-to-Backend Functional Verification, and Backend Engine Completeness  
**Methodology:** Direct line-by-line inspection of all TypeScript source files (`src/**/*.ts`), frontend code (`public/panel.html`, `public/panel.js`, `public/panel.css`), deployment configs (`Dockerfile`, `compose.yaml`, `package.json`, `.env.example`), and operational scripts (`scripts/*.sh`). No assumptions or markdown docs were used as sources of truth.

---

## 1. Executive Summary & Feature Matrix (Demo Mode vs. Production Mode)

| Feature / Subsystem | Source Files | Demo Mode (`NODE_ENV=development`, `MCP_AUTH_MODE=demo`) | Production Mode (`NODE_ENV=production`, `MCP_AUTH_MODE=production`) | Forensic Status |
| :--- | :--- | :--- | :--- | :--- |
| **Runtime Startup & Config** | `src/index.ts`, `src/shared/config.ts` | Auto-populates loopback defaults & demo setup hashes | Fails closed unless `ADMIN_PASSWORD_HASH`, `MCP_SETUP_TOKEN_HASH`, or `data/admin.json` exists | **BUG FOUND (BUG-01, BUG-11)** |
| **Admin First-Run Setup** | `src/security/admin-setup.ts`, `src/server/http.ts` | Bypassed (`this.ready = true` auto-set) | Enforces SHA-256 setup token proof & atomic `admin.json` + `.complete` marker | **Working in Prod (with UX Defect BUG-10)** |
| **Admin Authentication & Session** | `src/security/authentication.ts`, `public/panel.js` | Accepts any 3–64 char username + 1+ char password; exposes `x-session-token` fallback | Enforces 64 MiB non-blocking `scrypt` + `timingSafeEqual` + strict cookie auth | **BUG FOUND (BUG-02, BUG-09)** |
| **Manual Domain & Subdomain Manager** | `src/security/network.ts`, `src/server/http.ts`, `public/panel.js` | Adds/edits/removes domains in `network-draft.json`, checks DNS & TLS | Persists to `network-draft.json`, checks DNS & TLS | **BUG FOUND (BUG-03, BUG-04, BUG-05)** |
| **Network Plan & SSL Gateway Mode** | `src/security/network.ts`, `scripts/apply-network.sh` | Stages JSON draft only | Stages JSON draft only; `apply-network.sh` only changes `127.0.0.1` Docker port | **UI-ONLY / DRAFT-ONLY (BUG-06)** |
| **Cloudflare DNS Manager** | `src/security/cloudflare-dns.ts`, `src/server/http.ts`, `public/panel.js` | Connects to real Cloudflare API v4 (`api.cloudflare.com`), CRUD for `A, AAAA, CNAME, TXT, MX` | Identical real Cloudflare API v4 engine with optimistic concurrency checks | **Production Ready** |
| **OAuth 2.1 + PKCE Server** | `src/security/oauth.ts`, `src/server/http.ts` | Real S256 PKCE, dynamic registration, refresh rotation | Real S256 PKCE, dynamic registration, refresh rotation | **BUG FOUND (BUG-07)** |
| **MCP Server & 8 Tools** | `src/server/mcp.ts`, `src/tools/*.ts` | `system_status` & `disk_usage` active by default | `workspace_*`, `docker_*`, `deployment_*`, `operation_*` require broker + env roots | **BUG FOUND (BUG-08)** |
| **Privileged Unix Socket Broker** | `src/broker/server.ts`, `src/broker/main.ts`, `compose.yaml` | Not started by `npm run dev` | Implemented in `src/broker/*`, **missing from `compose.yaml` & `scripts/install.sh`** | **MISSING DEPLOYMENT ENGINE (BUG-08)** |
| **Policy & Per-Client RBAC** | `src/security/policy.ts`, `src/server/http.ts` | Real atomic persistence to `policy.json` | Real atomic persistence to `policy.json` | **Production Ready** |
| **Durable Security Audit Log** | `src/security/audit.ts`, `src/server/http.ts` | Real JSONL append & tail reader (`audit.jsonl`) | Real JSONL append & tail reader (`audit.jsonl`) | **Production Ready** |

---

## 2. Category A: Demo-Only Features & Demo/Production Discrepancies

### BUG-01 (CRITICAL): Production Server Crashes on Startup in Cloud/Container Environments Unless Pre-Seeded
* **Location:** `src/index.ts:13-37` and `src/security/admin-setup.ts:32-40`
* **Source Code Evidence:**
  ```ts
  // src/index.ts:13-21
  const isProd = process.env.NODE_ENV === 'production';
  if (isProd) {
    // Production mode: strictly disallow demo auth mode and require real configured or persisted state.
    if (process.env.MCP_AUTH_MODE === 'demo') {
      throw new Error('Demo auth mode cannot run when NODE_ENV=production');
    }
    process.env.MCP_AUTH_MODE = 'production';
    return;
  }
  ```
  ```ts
  // src/security/admin-setup.ts:32-40
  }else if(config.ADMIN_PASSWORD_HASH){
    this.ready=true;
  }else if(config.authMode==='demo'){
    config.ADMIN_USERNAME=config.ADMIN_USERNAME||'admin';
    config.ADMIN_PASSWORD_HASH=hashPassword('AdminControl#2026');
    this.ready=true;
  }else if(!/^[a-f0-9]{64}$/.test(config.MCP_SETUP_TOKEN_HASH)){
    throw Error('A new installation requires an installer-generated setup token hash');
  }
  ```
* **Forensic Proof:**
  1. When running `npm start` (`NODE_ENV=production MCP_AUTH_MODE=production node --env-file-if-exists=.env dist/index.js`) or deploying the `Dockerfile` directly without running `scripts/install.sh` first, `applyRuntimeDefaults()` returns immediately at line 20.
  2. Neither `MCP_HOST=0.0.0.0` nor `MCP_SETUP_TOKEN_HASH` nor `ADMIN_PASSWORD_HASH` is set by default in `src/shared/config.ts`.
  3. Consequently, in a fresh production container or cloud deployment without a pre-existing `./data/admin.json` or `.env` generated by `scripts/install.sh`, `new AdminSetup(config)` throws `Error: A new installation requires an installer-generated setup token hash` and the server crashes on boot (`process.exitCode=1`).
  4. Furthermore, in production container environments (like Cloud Run / App Engine / Docker without `scripts/install.sh`), `MCP_HOST` defaults to `'127.0.0.1'` (`src/shared/config.ts:4`), which refuses external container ingress traffic on `0.0.0.0:3000`.

---

### BUG-02 (HIGH): Client-Side `x-session-token` Request Interceptor Is Missing in `public/panel.js` & Production Iframe Preview Fails Without Third-Party Cookies
* **Location:** `src/security/authentication.ts:92-97`, `src/server/http.ts:184-187`, and `public/panel.js:40-52`, `public/panel.js:477-480`
* **Source Code Evidence:**
  ```ts
  // src/server/http.ts:185-187
  return json(res,200,config.authMode==='demo'
    ?{ok:true,csrf:sessions.csrfForId(sid),sessionToken:sid}
    :{ok:true,csrf:sessions.csrfForId(sid)});
  ```
  ```ts
  // public/panel.js:40-44
  async function api(url,options={}){
    let response;
    try {response=await fetch(url,{credentials:'same-origin',cache:'no-store',...options});}
    catch {throw {network:true};}
  ```
  ```ts
  // public/panel.js:477-480
  const loginResult=await api('/api/login',{method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({username:$('username').value.trim(),password:$('password').value})});
  if(loginResult?.sessionToken)state.sessionToken=loginResult.sessionToken;
  ```
* **Forensic Proof:**
  1. In `public/panel.js:479`, `state.sessionToken` is saved from `loginResult.sessionToken`, and cleared on logout at `public/panel.js:491` (`state.sessionToken=''`).
  2. **However, `api(url, options)` at `public/panel.js:40-44` NEVER attaches `x-session-token: state.sessionToken` to outgoing `fetch` headers!** `state.sessionToken` is completely dead code on the frontend.
  3. Even though `src/security/authentication.ts:95` checks `req.headers['x-session-token']`, the frontend never sends that header. If a browser blocks third-party cookies inside an iframe, login still fails after `POST /api/login` when `GET /api/session` is called.

---

### BUG-09 (HIGH): Demo Mode Authentication Completely Bypasses Password Verification
* **Location:** `src/security/authentication.ts:60-72`
* **Source Code Evidence:**
  ```ts
  // src/security/authentication.ts:60-72
  const isDemo = this.config.authMode === 'demo' && process.env.NODE_ENV !== 'production';
  if (isDemo) {
    const cleanUser = username.trim();
    if (cleanUser.length >= 3 && cleanUser.length <= 64 && password.length >= 1) {
      this.failures.delete(address);
      for(const [id,session] of this.sessions) if(session.expires<=now) this.sessions.delete(id);
      if(this.sessions.size>=64) return null;
      const sid = token();
      this.sessions.set(sid, {username: cleanUser, csrf:token(), expires:now + SESSION_TTL});
      return sid;
    }
    return null;
  }
  ```
* **Forensic Proof:**
  1. In Demo mode (`NODE_ENV=development`), `SessionManager.login()` does not verify `ADMIN_PASSWORD_HASH` at all—it accepts **any** username (3–64 chars) and **any** 1-character password, and never increments brute-force failure counters (`this.failures`).
  2. While convenient for demo previews, this means the real production `verifyPasswordNonBlocking` (`scrypt`) code path and brute-force lockout (`MAX_FAILURES = 5`) are not exercised during development unless tested via unit tests or `NODE_ENV=production`.

---

## 3. Category B: UI Features That Are Cosmetic, Fake, or Non-Functional in Reality

### BUG-03 (CRITICAL): Manual Domain "Check DNS" Falsely Reports `SSL Connected (Auto-verified Gateway TLS)` When HTTPS/TLS Does Not Exist
* **Location:** `src/security/network.ts:204-215`
* **Source Code Evidence:**
  ```ts
  // src/security/network.ts:204-215
  if(dnsResolved){
   const tlsCheck=await checkTlsCertificate(item.domain);
   if(tlsCheck.ok){
    item.sslStatus='active';
    item.sslIssuer=tlsCheck.issuer;
    item.sslValidTo=tlsCheck.validTo;
   }else{
    item.sslStatus='active';
    item.sslIssuer='Auto-verified (Gateway TLS)';
    item.sslValidTo='';
   }
  }
  ```
* **Forensic Proof:**
  1. When the user clicks **Check DNS** on any domain that resolves in DNS (e.g., `example.com` or any domain with an `A`/`CNAME` record), `checkDomainDnsAndSsl` calls `checkTlsCertificate(item.domain)` on port 443.
  2. Look at the `else` branch at lines 210–214: **even when `tlsCheck.ok` is `false` (meaning port 443 connection failed, timed out, or has no TLS certificate at all), the code still sets `item.sslStatus = 'active'` and fabricates `item.sslIssuer = 'Auto-verified (Gateway TLS)'`!**
  3. Furthermore, at line 58:
     ```ts
     const socket=tls.connect({host:domain,port:443,servername:domain,timeout:3500,rejectUnauthorized:false},()=>{
     ```
     Because `rejectUnauthorized: false` is used without checking `socket.authorized` or certificate expiration/hostname match, even an expired, self-signed, or wrong-domain certificate is marked `ok: true` and displayed as `● SSL Connected` in the UI (`public/panel.js:308`).

---

### BUG-04 (HIGH): Manual Domain DNS Check Marks ANY Public Domain as `Verified` Without Verifying That It Points to This Server or Matches the TXT Token
* **Location:** `src/security/network.ts:190-203`
* **Source Code Evidence:**
  ```ts
  // src/security/network.ts:190-203
  const [v4,v6,cname,txt]=await Promise.allSettled([
   resolve4(item.domain),
   resolve6(item.domain),
   resolveCname(item.domain),
   resolveTxt(`_vpsmcp-challenge.${item.domain}`)
  ]);
  const ipv4=v4.status==='fulfilled'?v4.value.slice(0,8):[];
  const ipv6=v6.status==='fulfilled'?v6.value.slice(0,8):[];
  const cnames=cname.status==='fulfilled'?cname.value.slice(0,4):[];
  const txts=txt.status==='fulfilled'?txt.value.flat():[];
  const dnsResolved=ipv4.length>0 || ipv6.length>0 || cnames.length>0 || txts.some(t=>t.includes(item.verifyToken));
  item.resolvedIps=[...ipv4,...ipv6];
  item.resolvedCnames=cnames;
  item.dnsStatus=dnsResolved?'verified':'failed';
  ```
* **Forensic Proof:**
  1. `dnsResolved` uses logical `||` across `ipv4.length > 0 || ipv6.length > 0 || cnames.length > 0 || txts.some(...)`.
  2. If a user enters `google.com` or any existing domain on the internet, `ipv4.length > 0` is true, so `item.dnsStatus` immediately becomes `'verified'` (`● Verified` in the UI) even though the domain points to Google's IPs and does not have the `_vpsmcp-challenge` TXT record or point to the user's VPS IP.
  3. Additionally, look at `dnsRecommendations()` at `src/security/network.ts:52` vs `checkDomainDnsAndSsl()` at `src/security/network.ts:194`:
     - For a root domain (`example.com`), `dnsRecommendations()` tells the user to create a TXT record at `_vpsmcp-challenge` (which becomes `_vpsmcp-challenge.example.com`).
     - For a subdomain (`sub.alpha.example.com`), `hostLabel` is `sub.alpha`, so `dnsRecommendations()` tells the user to create `_vpsmcp-challenge.sub.alpha` (which becomes `_vpsmcp-challenge.sub.alpha.example.com`), matching `resolveTxt('_vpsmcp-challenge.' + item.domain)`.
     - However, because `ipv4.length > 0` short-circuits `dnsResolved`, the TXT challenge token `vpsmcp-verify=<token>` is never required to pass verification.

---

### BUG-05 (HIGH): Configure DNS Modal Hardcodes Fake RFC 5737 Documentation IP `203.0.113.10` Instead of the Real Server IP
* **Location:** `src/security/network.ts:46`
* **Source Code Evidence:**
  ```ts
  // src/security/network.ts:41-54
  function dnsRecommendations(item:ManagedDomain,originHost:string){
   const parts=item.domain.split('.');
   const isSub=parts.length>2;
   const hostLabel=isSub?parts.slice(0,-2).join('.'):'@';
   const rootDomain=isSub?parts.slice(-2).join('.'):item.domain;
   const targetIp=/^\d+\.\d+\.\d+\.\d+$/.test(originHost)&&originHost!=='127.0.0.1'?originHost:'203.0.113.10';
  ```
* **Forensic Proof:**
  1. In both private container mode (`origin = http://127.0.0.1:3000`) and domain-based production mode (`origin = https://mcp.yourdomain.com`), `originHost` is either `'127.0.0.1'` or a domain hostname (not an IPv4 address).
  2. Therefore, `/^\d+\.\d+\.\d+\.\d+$/.test(originHost) && originHost !== '127.0.0.1'` is almost **always `false`**.
  3. As a result, the Configure DNS modal always tells the administrator to point their `A` record to `203.0.113.10` (an RFC 5737 TEST-NET-3 documentation IP that is unroutable on the public internet!). If an admin copies that `A` record value into their DNS provider, their domain will break.

---

### BUG-06 (HIGH): Added Domains & Network Plan Are Never Connected to the HTTP Server's Host/Origin Allowlist or TLS Listener
* **Location:** `src/server/http.ts:126-136`, `src/security/network.ts:104-112`, and `scripts/apply-network.sh:1-54`
* **Source Code Evidence:**
  ```ts
  // src/server/http.ts:126
  if(host!==new URL(config.origin).host && !(localPeer && host===localHost) && !trustedContainerHost) return text(res,403,'Invalid host');
  ```
  ```ts
  // src/security/network.ts:108-112
  publicReady:false},draft:this.plan,
  domains:this.domains.map(d=>({...d,dnsConfig:dnsRecommendations(d,originHost)})),
  domainConfigured:false,sslCertificateManaged:false,
  applyInstruction:'sudo bash scripts/apply-network.sh',
  note:'Saving a plan does not change DNS, certificates, public HTTPS or the Docker port. Apply private host port over SSH.'};
  ```
* **Forensic Proof:**
  1. When a user adds a domain (e.g. `mcp.yourdomain.com`) in **Domains & Subdomains** or saves it in **Network Plan**, it is only written to `data/network-draft.json`.
  2. If the user actually points `mcp.yourdomain.com` to the server and sends an HTTP/HTTPS request with `Host: mcp.yourdomain.com`, `src/server/http.ts:126` immediately rejects the request with **`403 Invalid host`** because `http.ts` only checks `new URL(config.origin).host` (which is static from startup environment `MCP_PUBLIC_URL`) and completely ignores `network.domains` and `network.plan.domain`!
  3. Furthermore, `scripts/apply-network.sh` only reads `data.hostPort` from `/data/network-draft.json` and updates `127.0.0.1:${MCP_BIND_PORT}:3000` in `.env`—it never configures `MCP_PUBLIC_URL`, never provisions/reloads TLS certificates, and never enables external HTTPS.

---

## 4. Category C: Missing or Disconnected Backend Engines & Security Flaws

### BUG-07 (HIGH): Host Header Injection / Open Redirect Spoofing in ` MCP_PRIVATE_CONTAINER=true` Mode
* **Location:** `src/server/http.ts:118-136` and `src/security/authentication.ts:106-115`
* **Source Code Evidence:**
  ```ts
  // src/server/http.ts:124-134
  const trustedContainerHost=privateContainer && (host===localHost || host===localhostAlias || /^[a-z0-9.-]+\.run\.app(?::\d+)?$/i.test(host));
  // Never trust forwarded headers; only accept the local host alias from loopback peers.
  if(host!==new URL(config.origin).host && !(localPeer && host===localHost) && !trustedContainerHost) return text(res,403,'Invalid host');
  const trustedContainerOrigin=privateContainer && req.headers.origin && (
    req.headers.origin===`http://${localHost}` ||
    req.headers.origin===`http://${localhostAlias}` ||
    req.headers.origin===`https://${host}` ||
    req.headers.origin===`http://${host}` ||
    (forwardedHost && (req.headers.origin===`https://${forwardedHost}` || req.headers.origin===`http://${forwardedHost}`)) ||
    /^https:\/\/[a-z0-9.-]+\.run\.app(?::\d+)?$/i.test(req.headers.origin)
  );
  ```
* **Forensic Proof:**
  1. Production Docker installations generated by `scripts/install.sh:32` set `MCP_PRIVATE_CONTAINER=true`.
  2. When `MCP_PRIVATE_CONTAINER=true`, `trustedContainerHost` accepts **any** `Host` header ending in `.run.app` (`/[a-z0-9.-]+\.run\.app/i`), and `trustedContainerOrigin` accepts **any** `Origin` header ending in `.run.app` or matching an unvalidated `X-Forwarded-Host` header.
  3. Even worse, in `src/security/authentication.ts:107-115`, if an attacker on the local network or via port-forwarding sends `X-Forwarded-Proto: https` or `X-Forwarded-Host: anything` over plain HTTP (`http://127.0.0.1:3000`), `isIframePreview` becomes `true` and the server sets `Set-Cookie: vpsmcp_local=...; SameSite=None; Secure; Partitioned`. Because the connection is plain `http://127.0.0.1:3000` (not HTTPS), the browser rejects the `Secure` cookie over HTTP, breaking local `http://127.0.0.1:3000` login whenever any proxy sets `X-Forwarded-Host`.

---

### BUG-08 (CRITICAL): Privileged Execution Broker Engine Is Completely Missing from `compose.yaml` and `scripts/install.sh`
* **Location:** `compose.yaml:1-52`, `scripts/install.sh:24-45`, `src/shared/config.ts:89-92`, and `src/broker/main.ts:1-10`
* **Source Code Evidence:**
  ```ts
  // src/shared/config.ts:89-92
  if ((writesEnabled || allowedTools.some(v=>['docker_status','deployment_status','operation_request','operation_execute'].includes(v)))
    && (!parsed.MCP_BROKER_SOCKET.startsWith('/') || parsed.MCP_BROKER_SECRET.length<32)) {
    throw new Error('Broker socket (absolute) and long secret required for broker tools');
  }
  ```
* **Forensic Proof:**
  1. The codebase implements a full Unix-socket execution broker in `src/broker/server.ts` and `src/broker/main.ts` (`npm run broker`), which is required for 4 of the 8 MCP tools (`docker_status`, `deployment_status`, `operation_request`, `operation_execute`) and all 3 write actions (`file.create`, `docker.restart`, `deploy.sync`).
  2. **However, `compose.yaml` only defines `init-data` and `api` services—there is NO `broker` service or shared Unix socket volume in `compose.yaml`!**
  3. Furthermore, `scripts/install.sh:24-45` never generates `MCP_BROKER_SOCKET` or `MCP_BROKER_SECRET` in `.env`, nor does it start `dist/broker/main.js` on the host or in a container.
  4. Therefore, in a real production installation using `scripts/install.sh` and `compose.yaml`, the entire **Operations (Write Controls)** tab, **Approvals** tab, `docker_status`, and `deployment_status` tools are permanently locked/non-functional ("Locked by server configuration") and cannot work unless an operator manually writes a systemd service / container for `dist/broker/main.js`.

---

### BUG-10 (MEDIUM): First-Run Setup Form Pre-Fills Invalid Password `Pass@123` That the Backend Explicitly Rejects
* **Location:** `public/panel.html:12` vs `src/security/admin-setup.ts:50-52`
* **Source Code Evidence:**
  ```html
  <!-- public/panel.html:12 -->
  <label for="setup-password">Password</label><input id="setup-password" type="password" value="Pass@123" autocomplete="new-password" minlength="12" required>
  ```
  ```ts
  // src/security/admin-setup.ts:50-52
  if(password.length<12 || password.length>1024 || password==='Pass@123' ||
     password.toLowerCase().includes(account.toLowerCase()))
     throw Error('Choose a unique 12+ character password; the starter password is not allowed');
  ```
* **Forensic Proof:**
  1. `public/panel.html:12` hardcodes `value="Pass@123"` into `#setup-password` while setting `minlength="12"`.
  2. `Pass@123` is only 8 characters long (violating `minlength="12"`) and is explicitly forbidden in `src/security/admin-setup.ts:50`. Pre-filling an invalid 8-character password in a password field masks the placeholder and confuses admins during first-time production initialization.

---

### BUG-11 (MEDIUM): Multi-Part Public Suffix TLD Domains (e.g., `.co.uk`, `.com.bd`, `.org.uk`) Are Misclassified as Subdomains
* **Location:** `src/security/network.ts:37-45`
* **Source Code Evidence:**
  ```ts
  // src/security/network.ts:37-45
  function classifyDomain(domain:string):'root'|'subdomain'{
   const parts=domain.split('.');
   return parts.length>2?'subdomain':'root';
  }
  function dnsRecommendations(item:ManagedDomain,originHost:string){
   const parts=item.domain.split('.');
   const isSub=parts.length>2;
   const hostLabel=isSub?parts.slice(0,-2).join('.'):'@';
   const rootDomain=isSub?parts.slice(-2).join('.'):item.domain;
  ```
* **Forensic Proof:**
  1. `classifyDomain` and `dnsRecommendations` assume every root domain has exactly 2 labels (`parts.length === 2`).
  2. If a user adds a country-code second-level root domain such as `example.co.uk` or `company.com.bd` (`parts.length === 3`), the engine misclassifies it as a `Subdomain`, sets `hostLabel = 'example'`, and tells the user to create a `CNAME` record for `example` pointing to `co.uk` (or `com.bd`), which is completely invalid DNS configuration.

---

### BUG-12 (LOW): Manual Domain Persistence Errors Return HTTP `400 Bad Request` Instead of `503 Service Unavailable`
* **Location:** `src/server/http.ts:303-307`
* **Source Code Evidence:**
  ```ts
  // src/server/http.ts:303-307
  }catch(err){
    const msg=err instanceof Error?err.message:'invalid_domain_request';
    return json(res,400,{error:'invalid_domain_request',message:msg});
  }
  ```
* **Forensic Proof:**
  1. Unlike `POST /api/network/plan` (`src/server/http.ts:273-274`), which separates validation errors (`400 invalid_network_plan`) from disk/filesystem persistence failures (`503 network_storage_unavailable`), `POST /api/network/domains` catches all exceptions—including `EACCES`/`ENOSPC`/`EISDIR` from `this.persist()`—and returns `400 invalid_domain_request`.

---

## 5. Summary of All 12 Verified Bugs & Defects

1. **BUG-01 (CRITICAL):** Production mode startup (`NODE_ENV=production`) crashes if `MCP_SETUP_TOKEN_HASH` / `ADMIN_PASSWORD_HASH` / `admin.json` is not pre-created, and binds to `127.0.0.1` by default instead of container interface when deployed outside `scripts/install.sh`.
2. **BUG-02 (HIGH):** `public/panel.js` stores `state.sessionToken` on login but `api()` never sends the `x-session-token` header on requests, leaving iframe fallback broken when third-party cookies are blocked.
3. **BUG-03 (CRITICAL):** `checkDomainDnsAndSsl()` in `src/security/network.ts` sets `sslStatus = 'active'` (`● SSL Connected`) and `Auto-verified (Gateway TLS)` even when the TLS connection on port 443 completely fails (`tlsCheck.ok === false`), and uses `rejectUnauthorized: false` without checking certificate validity.
4. **BUG-04 (HIGH):** `checkDomainDnsAndSsl()` marks any domain on the internet as `dnsStatus = 'verified'` if it has any `A`/`AAAA`/`CNAME` record, without checking whether the IP matches the server or whether the `_vpsmcp-challenge` TXT token matches.
5. **BUG-05 (HIGH):** `dnsRecommendations()` in `src/security/network.ts` hardcodes the unroutable documentation IP `203.0.113.10` for `A` records whenever `config.origin` is `127.0.0.1` or a hostname.
6. **BUG-06 (HIGH):** Domains added in **Domains & Subdomains** or saved in **Network Plan** are never added to `http.ts` Host/Origin validation; actual HTTP requests to those domains fail with `403 Invalid host`.
7. **BUG-07 (HIGH):** `MCP_PRIVATE_CONTAINER=true` trusts arbitrary `*.run.app` `Host`/`Origin` headers and `X-Forwarded-Host`, and sets `Secure; SameSite=None` cookies over plain HTTP when forwarded headers are present.
8. **BUG-08 (CRITICAL):** The Unix-socket execution broker (`src/broker/main.ts`) is completely absent from `compose.yaml` and `scripts/install.sh`, leaving all write operations, approvals, Docker status, and Git deployment tools disabled in standard production installs.
9. **BUG-09 (HIGH):** Demo auth mode (`src/security/authentication.ts:60-72`) bypasses password hash verification and brute-force rate limiting entirely, accepting any 1+ char password.
10. **BUG-10 (MEDIUM):** `public/panel.html:12` pre-fills `value="Pass@123"` in `#setup-password`, which violates `minlength="12"` and is rejected by `AdminSetup.setup()`.
11. **BUG-11 (MEDIUM):** `classifyDomain()` and `dnsRecommendations()` misclassify multi-part TLD root domains (e.g., `example.co.uk`, `example.com.bd`) as subdomains and generate broken `CNAME` targets (`co.uk`).
12. **BUG-12 (LOW):** `POST /api/network/domains` returns HTTP `400` on storage/disk write failures instead of HTTP `503`.

---

## 6. Recommended Phased Remediation Roadmap (For Future Implementation)

To resolve all 12 verified issues cleanly without regressions, fixes should be executed in **4 focused phases**:

* **Phase 1: Auth, Session & Production Startup Hardening (Fixes BUG-01, BUG-02, BUG-07, BUG-09, BUG-10)**
  - Wire `x-session-token` in `public/panel.js` `api()` helper when present.
  - Verify real password hash in Demo mode against the configured demo password (`AdminControl#2026`) so `scrypt` and lockout logic are identically tested, while auto-filling credentials in the demo UI.
  - Ensure production startup gracefully handles container bind/bootstrap token generation or clear setup state, tighten `Host`/`Origin`/`Cookie` checks in `http.ts` and `authentication.ts`, and remove the invalid `value="Pass@123"` default from `public/panel.html`.
* **Phase 2: Real Domain, DNS & SSL Verification Engine (Fixes BUG-03, BUG-04, BUG-05, BUG-11, BUG-12)**
  - Remove the fake `else { item.sslStatus = 'active' }` fallback in `checkDomainDnsAndSsl()`; perform real TLS handshake verification (checking certificate authorization, CN/SAN hostname match, and expiry).
  - Detect or allow configuring the server's real public IPv4/IPv6 address (instead of hardcoded `203.0.113.10`), validate that `A`/`AAAA`/`CNAME` or `_vpsmcp-challenge` TXT records genuinely match the target server/token, handle multi-part public suffixes (`.co.uk`, `.com.bd`, etc.), and return `503` on storage failures.
* **Phase 3: Live Domain Routing & Dynamic Host/Origin Binding (Fixes BUG-06)**
  - Connect verified/configured domains in `NetworkSettings` to the HTTP server's `Host` and `Origin` allowlist so requests arriving via a configured domain/reverse-proxy are accepted rather than rejected with `403 Invalid host`.
* **Phase 4: Production Broker Engine Integration (Fixes BUG-08)**
  - Integrate the privileged Unix-socket broker (`dist/broker/main.js`) and shared socket volume/configuration into `compose.yaml` and `scripts/install.sh` so Docker status, deployment status, and approval-gated write operations work out-of-the-box in production deployments.
