# 004 — Comprehensive Error Handling Registry (Existing & Planned Additions)

**Baseline Reference:** `/notes/000-BASELINE-FREEZE-MANIFEST.md`  
**Audit Reference:** `/notes/001-PRODUCTION-READINESS-BUG-SPEC.md`

This document catalogs all **currently implemented** error handling across the HTTP server, Authentication, OAuth 2.1, Cloudflare DNS, Network/Domain Management, and Execution Broker, followed by the **missing error handlers** that will be added during Phases 1–4.

---

## 1. Currently Implemented Error Handling (Verified in Source Code)

### A. HTTP Protocol & Transport Guards (`src/server/http.ts`)
| HTTP Status | Error Code / Response | Trigger Condition | Source Reference |
| :--- | :--- | :--- | :--- |
| `414` | `URI too long` (plain text) | `req.url.length > 4096` | `src/server/http.ts:117` |
| `403` | `Invalid host` (plain text) | `Host` header does not match `config.origin`, loopback, or trusted container host | `src/server/http.ts:126` |
| `403` | `Invalid origin` (plain text) | `Origin` header does not match `config.origin`, loopback, or trusted container origin | `src/server/http.ts:135-136` |
| `415` | `{"error":"unsupported_media_type"}` | Request `Content-Type` does not match `application/json` or `application/x-www-form-urlencoded` | `src/server/http.ts:52` |
| `413` | `{"error":"request_too_large"}` | JSON/form body exceeds `16 KiB` (`MAX_BODY`) or `/mcp` body exceeds `64 KiB` | `src/server/http.ts:58, 452-453` |
| `411` | `{"error":"content_length_required"}` | `POST /mcp` is sent with chunked `transfer-encoding` or missing `content-length` | `src/server/http.ts:450-451` |
| `400` | `{"error":"invalid_request"}` | Malformed JSON body or invalid form payload | `src/server/http.ts:63` |
| `404` | `Not found` (plain text) | Unmatched route or HTTP method | `src/server/http.ts:363, 461` |
| `500` | `{"error":"internal_error"}` | Unhandled exception in route handler (fail-closed without stack leak) | `src/server/http.ts:469` |

### B. Setup, Authentication, Session & CSRF (`src/server/http.ts`, `src/security/admin-setup.ts`, `src/security/authentication.ts`)
| HTTP Status | Error Code | Trigger Condition | Source Reference |
| :--- | :--- | :--- | :--- |
| `503` | `first_setup_required` | Any login, OAuth, or API call before first-time admin setup is completed | `src/server/http.ts:175` |
| `409` | `already_initialized` | `POST /api/setup` called after admin account is already initialized | `src/server/http.ts:158` |
| `429` | `too_many_attempts` | `POST /api/setup` exceeds 5 attempts per 60 seconds per IP | `src/server/http.ts:159` |
| `400` | `invalid_setup_input` | Missing `token`, `username`, `password`, or `confirm` string fields | `src/server/http.ts:161-163` |
| `400` | `password_confirmation_mismatch` | `password !== confirm` in `POST /api/setup` | `src/server/http.ts:164` |
| `403` | `setup_token_or_password_rejected` | Invalid SHA-256 setup token proof, weak password (<12 chars), `Pass@123`, or username inside password | `src/server/http.ts:171` |
| `401` | `login_failed` | Wrong username/password, >5 failed attempts in 15 min window, or >4 concurrent `scrypt` verifications | `src/server/http.ts:183`, `src/security/authentication.ts:59,75,80` |
| `401` | `authentication_required` | Missing, expired, or unknown session cookie / `x-session-token` | `src/server/http.ts:67` |
| `403` | `csrf_rejected` | Missing or mismatched `x-csrf-token` header (or `csrf` form field on `/oauth/approve`) | `src/server/http.ts:72, 418` |

### C. Cloudflare DNS Error Handling (`src/security/cloudflare-dns.ts`, `src/server/http.ts`)
| HTTP Status | Error Code | Trigger Condition | Source Reference |
| :--- | :--- | :--- | :--- |
| `429` | `rate_limited` | Exceeds per-minute rate limit (`list`: 15/min, `connect`: 5/min, `write`: 20/min) | `src/server/http.ts:212, 220, 241` |
| `409` | `dns_provider_not_connected` | Listing or mutating records before connecting a Cloudflare zone | `src/security/cloudflare-dns.ts:85` |
| `400` | `invalid_cloudflare_credentials` | Zone ID is not 32 hex chars or token does not match `[a-zA-Z0-9_-]{20,256}` | `src/security/cloudflare-dns.ts:116` |
| `403` | `cloudflare_zone_mismatch` | Cloudflare API zone response does not match requested `zoneId` | `src/security/cloudflare-dns.ts:120` |
| `403` | `dns_provider_access_denied` | Cloudflare API returns `401` or `403` | `src/security/cloudflare-dns.ts:108` |
| `429` | `dns_provider_rate_limited` | Cloudflare API returns `429` | `src/security/cloudflare-dns.ts:109` |
| `502` | `dns_provider_unreachable` | Network failure or 9-second timeout reaching `api.cloudflare.com` | `src/security/cloudflare-dns.ts:98` |
| `502` | `dns_provider_response_too_large` | Cloudflare response exceeds `1 MiB` | `src/security/cloudflare-dns.ts:100` |
| `502` | `dns_provider_bad_response` | Non-JSON or malformed response from Cloudflare | `src/security/cloudflare-dns.ts:106, 146` |
| `502` | `dns_provider_request_failed` | Cloudflare API returns `success: false` or non-2xx status | `src/security/cloudflare-dns.ts:110` |
| `409` | `dns_record_changed_refresh_required` | Optimistic concurrency failure (`current.content !== expectedContent`) on update/delete | `src/security/cloudflare-dns.ts:169, 178` |
| `400` | `invalid_dns_record` / `invalid_record_name` / `invalid_ipv4_address` / `invalid_ipv6_address` / `invalid_dns_target` / `invalid_txt_content` / `mx_priority_required` / `proxy_not_supported` / `record_type_cannot_change` | Strict DNS record schema & type-specific validation errors | `src/security/cloudflare-dns.ts:38-61, 171` |
| `503` | `dns_storage_unavailable` | Durable audit log or `dns-provider.json` disk write failure | `src/server/http.ts:215, 226, 236, 254` |

### D. Network Plan, Manual Domains, Policy & Approvals (`src/server/http.ts`)
| HTTP Status | Error Code | Trigger Condition | Source Reference |
| :--- | :--- | :--- | :--- |
| `400` | `invalid_network_plan` | Invalid domain, port outside `1024-65535`, or `external-https` without domain | `src/server/http.ts:267` |
| `503` | `audit_storage_unavailable` | Durable audit write fails before staging network plan or domain action | `src/server/http.ts:271, 290` |
| `503` | `network_storage_unavailable` | Atomic file write to `network-draft.json` fails on `/api/network/plan` | `src/server/http.ts:274` |
| `400` | `invalid_domain_action` | `action` is not `'add' | 'update' | 'remove' | 'check'` | `src/server/http.ts:287` |
| `400` | `invalid_domain_request` | Invalid domain format, duplicate domain, domain not found, or >25 domains | `src/server/http.ts:305` |
| `400` | `not_allowed_or_storage_unavailable` | `/api/control/*` toggle for unconfigured tool/action or failed policy write | `src/server/http.ts:366` |
| `403` | `write_operations_disabled` | `POST /api/approval` called when `MCP_ENABLE_WRITES=false` | `src/server/http.ts:375` |
| `409` | `approval_blocked_by_current_policy` | Approving an operation whose client, tool, or action was subsequently disabled | `src/server/http.ts:383` |
| `409` | `approval_missing_or_expired` | Approval ID does not exist, already consumed, or expired (>5 min) | `src/server/http.ts:389` |

### E. OAuth 2.1 + PKCE & MCP Endpoint (`src/security/oauth.ts`, `src/server/http.ts`)
| HTTP Status | Error Code | Trigger Condition | Source Reference |
| :--- | :--- | :--- | :--- |
| `403` | `registration_closed` | `POST /oauth/register` called when 5-minute enrollment window is closed | `src/security/oauth.ts:113` |
| `429` | `registration_limit` / `too_many_authorizations` / `too_many_codes` | Capacity limits exceeded (32 clients, 5 per window, 48 pending, 96 codes) | `src/security/oauth.ts:114, 158, 172` |
| `400` | `invalid_client_metadata` / `invalid_redirect_uri` / `invalid_client` / `invalid_scope` / `invalid_target` / `invalid_grant` / `unsupported_grant_type` | OAuth 2.1 RFC validation failures | `src/security/oauth.ts:115-211` |
| `503` | `token_capacity_reached` | Active access tokens (`>=256`) or refresh tokens (`>=256`) full | `src/security/oauth.ts:217` |
| `503` | `mcp_disabled` | `POST /mcp` called while MCP master switch is disabled | `src/server/http.ts:437` |
| `401` | `unauthorized` (with `WWW-Authenticate` header) | Missing, expired, or invalid OAuth Bearer token on `POST /mcp` | `src/server/http.ts:442` |
| `403` | `client_read_access_disabled` | Per-client `vps:read` policy toggle is off | `src/server/http.ts:456` |

---

## 2. Missing Error Handling to Be Added in Phases 1–4

| Target Phase | Bug ID | Error Scenario Currently Mishandled | New / Improved Error Handling to Add |
| :--- | :--- | :--- | :--- |
| **Phase 1** | `BUG-02` | Frontend `api()` discards `data.message` from JSON error responses, causing `error.message` to be `undefined` in `panel.js` | Include `message: data.message` in the thrown error object in `public/panel.js:49` (`throw {status:response.status,code:data.error,message:data.message}`) and add human-readable mappings in `humanError(error)` |
| **Phase 2** | `BUG-12` | `POST /api/network/domains` returns `400 invalid_domain_request` when `network-draft.json` cannot be written due to disk/permission errors (`EACCES`, `EISDIR`, `ENOSPC`) | Distinguish storage `ErrnoException` errors from domain validation errors in `src/server/http.ts:303-308`, returning `503 { error: 'network_storage_unavailable' }` on storage failures |
| **Phase 2** | `BUG-03` | TLS connection errors, timeouts, expired certificates, and hostname mismatches on port 443 are swallowed and reported as `sslStatus: 'active'` | Return structured TLS error diagnostics (`https_unreachable`, `certificate_expired`, `hostname_mismatch`, `untrusted_issuer`) so `sslStatus` accurately reflects `'pending'` or `'failed'` with a clear diagnostic message |
| **Phase 2** | `BUG-04` | DNS resolution to an unrelated IP or missing `_vpsmcp-challenge` TXT record is not differentiated from verified domain ownership | Report specific DNS diagnostic states (`dns_target_mismatch`, `txt_challenge_verified`, `dns_not_resolved`) in `checkDomainDnsAndSsl()` |
| **Phase 4** | `BUG-08` | When broker socket is unreachable or misconfigured in Docker Compose, broker tools fail with generic error | Ensure `compose.yaml` health/startup dependency and clear broker socket error reporting |
