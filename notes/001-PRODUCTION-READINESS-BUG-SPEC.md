# 001 — Production Readiness Forensic Bug Specification & Exact Code Patches

**Baseline Reference:** `/notes/000-BASELINE-FREEZE-MANIFEST.md`  
**Forensic Audit Reference:** `/notes/PRODUCTION-FORENSIC-AUDIT-2026-11-26.md`  
**Total Verified Bugs:** 12 (`BUG-01` through `BUG-12`)

This document specifies every bug found during the forensic audit with its **exact file path**, **exact line range**, **current broken source code block**, **exact code patch to apply**, and **assigned Scope-Locked Phase**.

---

## Phase 1 Scope-Locked Bugs (Auth, Session, Startup & Request Origin Hardening)

### BUG-01 (CRITICAL): Production Startup Crash & Host Bind Failure Without Pre-Existing `.env`
* **Phase:** Phase 1
* **Target Files:** `/src/index.ts` (lines 13–21) and `/src/security/admin-setup.ts` (lines 32–41)
* **Current Code (`/src/index.ts:13-21`):**
  ```ts
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
* **Root Cause:** When `NODE_ENV=production` is run in a container or cloud host where `.env` was not pre-created by `scripts/install.sh` (or `MCP_SETUP_TOKEN_HASH` / `ADMIN_PASSWORD_HASH` is absent and `./data/admin.json` does not exist yet), `AdminSetup` throws `Error: A new installation requires an installer-generated setup token hash` and crashes the server on boot. Also, if `PORT` is provided by a cloud container host without `MCP_TLS_CERT_FILE`, `MCP_HOST` defaults to `127.0.0.1` instead of container-private mode.
* **Exact Patch Specification (`/src/index.ts`):**
  ```ts
  const isProd = process.env.NODE_ENV === 'production';
  if (isProd) {
    if (process.env.MCP_AUTH_MODE === 'demo') {
      throw new Error('Demo auth mode cannot run when NODE_ENV=production');
    }
    process.env.MCP_AUTH_MODE = 'production';
    const stateFile = process.env.MCP_ADMIN_STATE_FILE || './data/admin.json';
    const markerFile = stateFile + '.complete';
    if (!process.env.ADMIN_PASSWORD_HASH && !process.env.MCP_SETUP_TOKEN_HASH && !existsSync(stateFile) && !existsSync(markerFile)) {
      const generatedToken = process.env.MCP_SETUP_TOKEN || randomBytes(24).toString('hex');
      process.env.MCP_SETUP_TOKEN_HASH = createHash('sha256').update(generatedToken).digest('hex');
      process.stderr.write(`[VPS-MCP PRODUCTION BOOTSTRAP] First-time setup token generated: ${generatedToken}\n`);
    }
    return;
  }
  ```
  *(Note: When `ADMIN_PASSWORD_HASH` or `MCP_SETUP_TOKEN_HASH` is explicitly passed as empty in unit tests via `loadConfig({...})`, `loadConfig` + `AdminSetup` directly still fails closed as required by `tests/setup.test.ts`!)*

---

### BUG-02 (HIGH): Frontend `api()` Helper Never Sends `x-session-token` Header Despite Storing `state.sessionToken`
* **Phase:** Phase 1
* **Target File:** `/public/panel.js` (lines 40–52)
* **Current Code (`/public/panel.js:40-52`):**
  ```js
  async function api(url,options={}){
    let response;
    try {response=await fetch(url,{credentials:'same-origin',cache:'no-store',...options});}
    catch {throw {network:true};}
    const data=await response.json().catch(()=>({}));
    if(!response.ok){
      if(response.status===401 && !['/api/login','/api/session'].includes(url)){
        showLogin('Session expired. Sign in again.',true);
      }
      throw {status:response.status,code:data.error};
    }
    return data;
  }
  ```
* **Root Cause:** `state.sessionToken` is assigned on login (`/public/panel.js:479`), and `src/security/authentication.ts:94-97` checks `req.headers['x-session-token']`, but `api()` never merges `x-session-token` into `options.headers`, nor does it pass `data.message` on error responses.
* **Exact Patch Specification (`/public/panel.js:40-52`):**
  ```js
  async function api(url,options={}){
    const headers={...(options.headers||{})};
    if(state.sessionToken && !headers['x-session-token']){
      headers['x-session-token']=state.sessionToken;
    }
    let response;
    try {response=await fetch(url,{credentials:'same-origin',cache:'no-store',...options,headers});}
    catch {throw {network:true};}
    const data=await response.json().catch(()=>({}));
    if(!response.ok){
      if(response.status===401 && !['/api/login','/api/session'].includes(url)){
        showLogin('Session expired. Sign in again.',true);
      }
      throw {status:response.status,code:data.error,message:data.message};
    }
    return data;
  }
  ```

---

### BUG-07 (HIGH): Over-Permissive Forwarded Header Cookie Downgrade & Host Validation in Private Container Mode
* **Phase:** Phase 1
* **Target File:** `/src/security/authentication.ts` (lines 105–117)
* **Current Code (`/src/security/authentication.ts:105-117`):**
  ```ts
  private cookieAttributes(req?: IncomingMessage): string {
    const forwardedHost = (req?.headers['x-forwarded-host'] as string | undefined) || '';
    const isIframePreview = this.config.MCP_PRIVATE_CONTAINER === 'true' && req && (
      req.headers['x-forwarded-proto'] === 'https' ||
      Boolean(forwardedHost) ||
      /\.run\.app(?::\d+)?$/i.test(req.headers.host || '') ||
      /\.run\.app(?::\d+)?$/i.test(req.headers.origin || '')
    );
    if (isIframePreview) {
      return 'Path=/; HttpOnly; SameSite=None; Secure; Partitioned';
    }
    return `Path=/; HttpOnly; SameSite=Strict${this.config.secureCookies ? '; Secure' : ''}`;
  }
  ```
* **Root Cause:** Checking `Boolean(forwardedHost)` alone without verifying that the request actually arrived over an HTTPS proxy (`x-forwarded-proto === 'https'` or `https://*.run.app` origin) causes plain HTTP requests (`http://127.0.0.1:3000`) with an `X-Forwarded-Host` header to receive a `Secure; SameSite=None` cookie, which browsers reject over plain HTTP.
* **Exact Patch Specification (`/src/security/authentication.ts:105-117`):**
  ```ts
  private cookieAttributes(req?: IncomingMessage): string {
    const proto = (req?.headers['x-forwarded-proto'] as string | undefined) || '';
    const origin = req?.headers.origin || '';
    const isHttpsIframePreview = this.config.MCP_PRIVATE_CONTAINER === 'true' && Boolean(req) && (
      proto === 'https' ||
      /^https:\/\/[a-z0-9.-]+\.run\.app(?::\d+)?$/i.test(origin)
    );
    if (isHttpsIframePreview) {
      return 'Path=/; HttpOnly; SameSite=None; Secure; Partitioned';
    }
    return `Path=/; HttpOnly; SameSite=Strict${this.config.secureCookies ? '; Secure' : ''}`;
  }
  ```

---

### BUG-09 (HIGH): Demo Mode Bypasses `scrypt` Password Verification & Lockout Tracking
* **Phase:** Phase 1
* **Target File:** `/src/security/authentication.ts` (lines 60–91)
* **Current Code (`/src/security/authentication.ts:60-72`):**
  ```ts
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
* **Root Cause:** In Demo mode, `AdminSetup` already initializes `config.ADMIN_USERNAME = 'admin'` and `config.ADMIN_PASSWORD_HASH = hashPassword('AdminControl#2026')` (`src/security/admin-setup.ts:35-36`), and `public/panel.js:20-21` pre-fills `admin` / `AdminControl#2026`. Bypassing `verifyPasswordNonBlocking` in `SessionManager.login()` accepts bogus passwords in demo mode and skips testing the real `scrypt` engine.
* **Exact Patch Specification (`/src/security/authentication.ts:60-91`):**
  Remove the fake password bypass in `SessionManager.login()` so both Demo and Production mode verify credentials through the real non-blocking `scrypt` hash (`verifyPasswordNonBlocking(password, this.config.ADMIN_PASSWORD_HASH)`) and `safeEqual(username, this.config.ADMIN_USERNAME)`. In Demo mode, `AdminSetup` provides the real hash for `AdminControl#2026` and the UI auto-fills it, while wrong passwords are properly rejected.

---

### BUG-10 (MEDIUM): First-Run Setup Form Pre-Fills Forbidden 8-Character Password `value="Pass@123"`
* **Phase:** Phase 1
* **Target File:** `/public/panel.html` (line 12)
* **Current Code (`/public/panel.html:12`):**
  ```html
  <label for="setup-password">Password</label><input id="setup-password" type="password" value="Pass@123" autocomplete="new-password" minlength="12" required>
  ```
* **Root Cause:** `Pass@123` is 8 characters (violating `minlength="12"`) and is explicitly rejected by `src/security/admin-setup.ts:50` (`password === 'Pass@123'`).
* **Exact Patch Specification (`/public/panel.html:12`):**
  ```html
  <label for="setup-password">Password</label><input id="setup-password" type="password" placeholder="Choose a strong 12+ character password" autocomplete="new-password" minlength="12" required>
  ```

---

## Phase 2 Scope-Locked Bugs (Real Domain, DNS & SSL Verification Engine)

### BUG-03 (CRITICAL): `checkDomainDnsAndSsl()` Fakes `sslStatus = 'active'` (`Auto-verified Gateway TLS`) When Port 443 TLS Fails
* **Phase:** Phase 2
* **Target File:** `/src/security/network.ts` (lines 56–73 and 204–219)
* **Current Code (`/src/security/network.ts:56-73, 204-219`):**
  ```ts
  async function checkTlsCertificate(domain:string):Promise<{ok:boolean;issuer:string;validTo:string}>{
   return new Promise(resolve=>{
    const socket=tls.connect({host:domain,port:443,servername:domain,timeout:3500,rejectUnauthorized:false},()=>{
     try{
      const cert=socket.getPeerCertificate();
      socket.end();
      if(cert && (cert.subject?.CN || cert.valid_to)){
       const issuer=cert.issuer?.O || cert.issuer?.CN || 'Verified TLS';
       resolve({ok:true,issuer:String(issuer),validTo:String(cert.valid_to||'')});
       return;
      }
     }catch{}
     resolve({ok:false,issuer:'',validTo:''});
    });
    socket.on('error',()=>resolve({ok:false,issuer:'',validTo:''}));
    socket.on('timeout',()=>{socket.destroy();resolve({ok:false,issuer:'',validTo:''});});
   });
  }
  ```
  ```ts
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
* **Root Cause:**
  1. When `tlsCheck.ok` is `false` (no HTTPS server on port 443), the `else` branch falsely sets `item.sslStatus = 'active'` and `item.sslIssuer = 'Auto-verified (Gateway TLS)'`.
  2. `checkTlsCertificate` uses `rejectUnauthorized: false` without checking `tls.checkServerIdentity(domain, cert)` or `Date.parse(cert.valid_to) > Date.now()`.
* **Exact Patch Specification (`/src/security/network.ts`):**
  1. In `checkTlsCertificate(domain)`:
     - Check that `cert` exists, `cert.valid_to` is in the future (`Date.parse(cert.valid_to) > Date.now()`), and `tls.checkServerIdentity(domain, cert) === undefined`.
     - Return `{ ok: boolean; authorized: boolean; issuer: string; validTo: string; reason?: string }`.
  2. In `checkDomainDnsAndSsl(id)`:
     - Only set `item.sslStatus = 'active'` when `tlsCheck.ok === true`.
     - When `dnsResolved === true` but `tlsCheck.ok === false`, set `item.sslStatus = 'pending'` (or `'failed'` if an invalid/expired cert was presented) and `item.sslIssuer = tlsCheck.reason || 'HTTPS not reachable on port 443'`. Never fabricate `'Auto-verified (Gateway TLS)'`.

---

### BUG-04 (HIGH): `checkDomainDnsAndSsl()` Marks Any Public Domain as `Verified` Without Checking Target Match or TXT Verification Token
* **Phase:** Phase 2
* **Target File:** `/src/security/network.ts` (lines 186–204)
* **Current Code (`/src/security/network.ts:190-203`):**
  ```ts
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
* **Root Cause:** Any domain with an `A` record (like `example.com`) passes `ipv4.length > 0` and is marked `'verified'`, even if it points to another server and lacks the TXT verification token.
* **Exact Patch Specification (`/src/security/network.ts`):**
  - Distinguish between DNS resolution and ownership/target verification:
    - Check if `txts.some(t => t.includes('vpsmcp-verify=' + item.verifyToken))` OR if `resolvedIps` includes the configured/detected server IP (`expectedTargetIp`) OR if `cnames` points to `rootDomain` / `originHost`.
    - When a domain resolves in public DNS (`ipv4.length > 0 || ipv6.length > 0 || cnames.length > 0`), record `item.resolvedIps` and `item.resolvedCnames`. If a server target IP is configured (or TXT token matches, or custom DNS resolver in tests resolves it to the expected target), mark `verified`; if it resolves to an unrelated IP when a specific target IP is configured, report the mismatch clearly.

---

### BUG-05 (HIGH): Configure DNS Modal Hardcodes Unroutable Documentation IP `203.0.113.10`
* **Phase:** Phase 2
* **Target Files:** `/src/shared/config.ts` and `/src/security/network.ts` (lines 41–55)
* **Current Code (`/src/security/network.ts:46`):**
  ```ts
  const targetIp=/^\d+\.\d+\.\d+\.\d+$/.test(originHost)&&originHost!=='127.0.0.1'?originHost:'203.0.113.10';
  ```
* **Root Cause:** `203.0.113.10` is hardcoded whenever `originHost` is `127.0.0.1` or a domain name.
* **Exact Patch Specification (`/src/shared/config.ts` & `/src/security/network.ts`):**
  1. Add optional `MCP_PUBLIC_IP: z.string().default('')` in `src/shared/config.ts` (and `.env.example`).
  2. In `src/security/network.ts`, detect the server's non-internal IPv4 address from `os.networkInterfaces()` or `config.MCP_PUBLIC_IP` or `originHost` (if `originHost` is a public IPv4). If running in an isolated local environment with no public interface configured, display the detected host interface IP or `<YOUR_VPS_PUBLIC_IP>` rather than misleading the user with a fake documentation IP.

---

### BUG-11 (MEDIUM): Multi-Part Public Suffix TLD Domains (`.co.uk`, `.com.bd`, `.org.uk`, etc.) Misclassified as Subdomains
* **Phase:** Phase 2
* **Target File:** `/src/security/network.ts` (lines 37–46)
* **Current Code (`/src/security/network.ts:37-45`):**
  ```ts
  function classifyDomain(domain:string):'root'|'subdomain'{
   const parts=domain.split('.');
   return parts.length>2?'subdomain':'root';
  }
  ```
* **Root Cause:** `parts.length > 2` treats 3-label root domains under multi-part public suffixes (e.g., `example.co.uk`, `portal.com.bd`, `site.com.au`) as subdomains of `co.uk` / `com.bd`.
* **Exact Patch Specification (`/src/security/network.ts`):**
  Add a multi-part public suffix detector (`MULTI_PART_TLDS = new Set(['co.uk','org.uk','gov.uk','ac.uk','com.bd','net.bd','org.bd','edu.bd','gov.bd','com.au','net.au','org.au','co.in','net.in','org.in','co.jp','co.nz','co.za','com.br','com.sg','com.my'])` plus generic 2-char + 2-char ccSLD pattern `/^(?:co|com|net|org|edu|gov|ac|mil)\.[a-z]{2}$/`) so `rootPartsCount` is `3` for compound public suffixes and `2` for standard TLDs.
  - `example.co.uk` -> `root` (`hostLabel = '@'`, `rootDomain = 'example.co.uk'`)
  - `mcp.example.co.uk` -> `subdomain` (`hostLabel = 'mcp'`, `rootDomain = 'example.co.uk'`)

---

### BUG-12 (LOW): `POST /api/network/domains` Returns HTTP `400` on Disk/Storage Errors Instead of HTTP `503`
* **Phase:** Phase 2
* **Target File:** `/src/server/http.ts` (lines 291–308)
* **Current Code (`/src/server/http.ts:303-307`):**
  ```ts
  }catch(err){
    const msg=err instanceof Error?err.message:'invalid_domain_request';
    return json(res,400,{error:'invalid_domain_request',message:msg});
  }
  ```
* **Root Cause:** Filesystem errors thrown by `writeFileSync`/`renameSync`/`mkdirSync` (which have `code` properties like `'EACCES'`, `'EPERM'`, `'EISDIR'`, `'ENOSPC'`, `'EROFS'`) are caught in the same block as Zod/domain validation errors and returned as `400` instead of `503 network_storage_unavailable`.
* **Exact Patch Specification (`/src/server/http.ts:303-308`):**
  Check if `err` is a Node filesystem `ErrnoException` (`typeof (err as NodeJS.ErrnoException)?.code === 'string' && !(err instanceof z.ZodError)`), and if so return `json(res, 503, { error: 'network_storage_unavailable' })`; otherwise return `400` with a sanitized validation message.

---

## Phase 3 Scope-Locked Bugs (Live Domain Routing & Dynamic Host/Origin Allowlist)

### BUG-06 (HIGH): Added/Managed Domains Are Rejected by `http.ts` with `403 Invalid host` / `403 Invalid origin`
* **Phase:** Phase 3
* **Target Files:** `/src/security/network.ts` and `/src/server/http.ts` (lines 118–138)
* **Current Code (`/src/server/http.ts:126, 135-136`):**
  ```ts
  if(host!==new URL(config.origin).host && !(localPeer && host===localHost) && !trustedContainerHost) return text(res,403,'Invalid host');
  ...
  if(req.headers.origin && req.headers.origin!==config.origin &&
    !(localPeer && req.headers.origin===`http://${localHost}`) && !trustedContainerOrigin) return text(res,403,'Invalid origin');
  ```
* **Root Cause:** `http.ts` only checks `new URL(config.origin).host` and never checks `network.hasAllowedHost(host)`. When an administrator adds a domain or subdomain in the **Domain & SSL** panel (e.g. `mcp.example.com`) or stages it in `network.plan.domain`, incoming requests with `Host: mcp.example.com` or `Origin: https://mcp.example.com` are rejected with `403 Invalid host` / `403 Invalid origin`.
* **Exact Patch Specification (`/src/security/network.ts` & `/src/server/http.ts`):**
  1. Add `isAllowedHost(rawHost: string): boolean` and `isAllowedOrigin(rawOrigin: string): boolean` methods on `NetworkSettings` in `/src/security/network.ts`:
     - Strip optional port from `rawHost` (`rawHost.toLowerCase().replace(/:\d+$/, '')`) and check if it matches any domain in `this.domains` or `this.plan.domain` (when `this.plan.sslMode === 'external-https'` or domain exists in `this.domains`).
     - In `isAllowedOrigin(rawOrigin)`, allow `https://<managedDomain>` (and `http://<managedDomain>` when `privateContainer` is active over reverse proxy).
  2. In `/src/server/http.ts:126-136`, permit requests where `network.isAllowedHost(host)` and `network.isAllowedOrigin(req.headers.origin)` are true.

---

## Phase 4 Scope-Locked Bugs (Production Execution Broker Engine Integration)

### BUG-08 (CRITICAL): Unix Socket Execution Broker Is Missing from `compose.yaml` and `scripts/install.sh`
* **Phase:** Phase 4
* **Target Files:** `/compose.yaml`, `/scripts/install.sh`, and `/src/broker/main.ts`
* **Current Code (`/compose.yaml:14-48` & `/scripts/install.sh:24-45`):**
  - `compose.yaml` only defines `init-data` and `api`.
  - `scripts/install.sh` does not generate `MCP_BROKER_SOCKET` or `MCP_BROKER_SECRET`.
* **Root Cause:** Without the broker process running and listening on `MCP_BROKER_SOCKET` with a 32+ char `MCP_BROKER_SECRET`, `config.ts:89-92` forbids enabling `docker_status`, `deployment_status`, `operation_request`, `operation_execute`, or `MCP_ENABLE_WRITES=true`.
* **Exact Patch Specification (`/compose.yaml` & `/scripts/install.sh`):**
  1. In `/compose.yaml`:
     - Add a `broker` service using the same built image (`vps-mcp:local`), running `["node", "dist/broker/main.js"]`, sharing a private Unix socket volume (`mcp-socket:/run/vps-mcp`) with `api`, and initializing `/run/vps-mcp` with `0700` permissions owned by `10001:10001` in `init-data`.
  2. In `/scripts/install.sh`:
     - Generate a 64-hex-char `broker_secret="$(openssl rand -hex 32)"` and write `MCP_BROKER_SOCKET=/run/vps-mcp/broker.sock` and `MCP_BROKER_SECRET=$broker_secret` into `.env`.
