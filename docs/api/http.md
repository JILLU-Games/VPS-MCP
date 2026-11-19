---
order: 1
---

# HTTP API — Observed Route Reference

Route names were rechecked on 2026-11-20 against `src/server/http.ts` at `5c19d0a9fff8d63bd55a4447c891f2b26374c32b`. Authentication and request examples derive from that implementation and earlier tests; not every route payload was exhaustively revalidated. These private admin routes are **not** a supported public SDK and have no backward-compatibility guarantee.

## Authentication rules

`GET /health` and OAuth metadata are public in the previous snapshot. Operator routes require an established administrator **session cookie**. State-changing admin routes additionally require a valid `x-csrf-token` header matching the session. MCP `/mcp` instead uses a valid OAuth **bearer** token.

| Method | Route | Context / function |
| --- | --- | --- |
| GET | `/health` | Liveness; returns `{status:"ok",service:"vps-mcp"}` in reviewed version |
| GET | `/api/setup/status` | Whether first admin setup is required |
| POST | `/api/setup` | First-visit setup with one-time token and administrator credentials |
| POST | `/api/login` | Admin password authentication; creates session |
| GET | `/api/session` | Current session, including CSRF value |
| POST | `/api/logout` | End session; CSRF required |
| GET | `/api/status` | Aggregated system, OAuth, tool, client, audit, network, DNS-provider status |
| POST | `/api/mcp` | Enable/disable MCP master switch |
| POST | `/api/enrollment` | Authorized OAuth client-registration window |
| POST | `/api/approval` | Admin approval decision for a pending operation |
| POST | `/api/control/tool` | Global tool permission switch |
| POST | `/api/control/action` | Action-class permission switch |
| POST | `/api/control/writes` | Pause/resume configured write gate |
| POST | `/api/control/client-tool` | Per-client tool restriction |
| POST | `/api/control/client-scope` | Per-client OAuth scope restriction |
| POST | `/api/control/revoke-client` | Revoke client registration/tokens |
| GET | `/api/network/dns` | Resolve saved draft domain A/AAAA (not provider record CRUD) |
| POST | `/api/network/plan` | Persist validated draft domain, hostPort, SSL mode |
| GET | `/api/dns/records` | List Cloudflare records for stored zone |
| POST | `/api/dns/connect` | Verify/save Cloudflare Zone ID + scoped token |
| POST | `/api/dns/disconnect` | Remove stored provider credential; leaves DNS records untouched |
| POST | `/api/dns/record` | Create, update, or delete a record in configured Cloudflare zone |
| POST | `/mcp` | OAuth-protected MCP Streamable HTTP |

### Known request body shapes

These are observed input keys; types and semantics come from the previous code inspection. They are *not* a standalone OpenAPI specification.

| Route | JSON body | Remarks |
| --- | --- | --- |
| `/api/setup` | `{ "token": string, "username": string, "password": string, "confirm": string }` | One-time only; strong new password required |
| `/api/login` | `{ "username": string, "password": string }` | Sets authenticated cookie |
| `/api/mcp` | `{ "enabled": boolean }` | Admin/CSRF |
| `/api/network/plan` | `{ "domain": string, "hostPort": integer, "sslMode": "private-only" \| "external-https" }` | Draft only, no TLS/DNS deployment |
| `/api/dns/connect` | `{ "zoneId": 32-hex string, "token": string }` | Token never returned on success |
| `/api/dns/record` | `{ "action": "create", "record": RecordInput }` | Changes live Cloudflare zone |
| `/api/dns/record` | `{ "action": "update", "id": string, "expectedContent": string, "record": RecordInput }` | Reject stale record changes |
| `/api/dns/record` | `{ "action": "delete", "id": string, "confirmName": string, "confirmType": string, "expectedContent": string }` | Re-reads record; reject mismatches |

`RecordInput` (observed): `{ type: "A" | "AAAA" | "CNAME" | "TXT" | "MX", name: string, content: string, ttl: number, proxied: boolean, priority?: number }`.

`ttl` was limited to `1` (automatic) or an integer between `60` and `86400` in the previously inspected validation. `priority` was required for MX and rejected for non-MX. `proxied` was restricted to A/AAAA/CNAME. Record names were validated within the configured zone; malformed and out-of-zone names were rejected.

### External OAuth discovery and authorization

| Method | Route | Role |
| --- | --- | --- |
| GET | `/.well-known/oauth-protected-resource` | Resource metadata |
| GET | `/.well-known/oauth-protected-resource/mcp` | Resource metadata variant |
| GET | `/.well-known/oauth-authorization-server` | Authorization-server metadata |
| POST | `/oauth/register` | Gated dynamic client registration |
| GET / authorization flow | `/oauth/authorize` | User consent/authorization; verify verb handling in current source |
| POST | `/oauth/token` | Token exchange / refresh |
| POST | `/oauth/revoke` | Token revocation |

The exact request JSON/form-encoding for OAuth endpoints is protocol-defined and must be checked against `src/security/oauth.ts` before writing a raw custom client. **Do not send administrator credentials directly to the MCP transport.**

### Minimal verified-shape health request

```bash
curl --fail --silent http://127.0.0.1:3000/health
```

This is a protocol example, **not executed in this documentation run**. Other protected routes should be called through the supplied dashboard or a correctly authorized client rather than a hard-coded example bearer token.

### Common responses

The previous HTTP implementation returned `401` for unauthenticated admin calls, `403` for CSRF/origin/permission failures, `400` for invalid requests, `409` for stale/unsupported state, `429` for rate limits and `503` for unavailable audit/private settings storage. Cloudflare errors are mapped to sanitized codes; details are in [Errors](errors.md).
