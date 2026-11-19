---
order: 1
---

# Configuration Reference — Previously Inspected Schema

Primary source examined in the preceding session: `src/shared/config.ts` (`loadConfig` with Zod). **Defaults and validation below were rechecked against the current `src/shared/config.ts` at `5c19d0a9fff8d63bd55a4447c891f2b26374c32b`.** The private installer normally generates `.env`; do not confuse application-schema defaults with complete production deployment configuration.

## Listener and TLS

| Variable | Type / previously observed default | Validation or effect |
| --- | --- | --- |
| `MCP_HOST` | string, `127.0.0.1` | Only `127.0.0.1` or `0.0.0.0` accepted; public bind requires TLS unless private container flag |
| `MCP_PORT` | integer, `3000` | Internal listener port, 1–65535 |
| `MCP_BIND_PORT` | integer, `3000` | Docker **host loopback** published port, 1024–65535 |
| `MCP_PUBLIC_URL` | optional origin URL | Bare origin; no path/query/fragment/userinfo. Non-loopback requires HTTPS |
| `MCP_TLS_CERT_FILE` | optional path | Must be paired with TLS key path |
| `MCP_TLS_KEY_FILE` | optional path | Must be paired with TLS certificate path |
| `MCP_PRIVATE_CONTAINER` | `true` or `false`, default `false` | Private container mode requires `0.0.0.0` **internal** bind and loopback origin, no native TLS |

**Do not** combine `MCP_PRIVATE_CONTAINER=true` with an external HTTP/HTTPS origin and pretend it is a public TLS setup. In the private profile, the Compose host binding remains `127.0.0.1:${MCP_BIND_PORT}:3000`.

## Admin and persistence

| Variable | Previously observed default / shape | Purpose |
| --- | --- | --- |
| `ADMIN_USERNAME` | `admin`, length 3–64 | Legacy/default username field; first-run setup can establish actual account |
| `ADMIN_PASSWORD_HASH` | empty string or colon-delimited scrypt hex format | Pre-provisioned auth material; do not store plaintext |
| `MCP_SETUP_TOKEN_HASH` | empty string | One-time installer activation hash |
| `MCP_ADMIN_STATE_FILE` | `./data/admin.json` | Admin credential state |
| `MCP_AUDIT_FILE` | `./data/audit.jsonl` | Persistent audit events |
| `MCP_STATE_FILE` | `./data/oauth-state.json` | OAuth registration/refresh state |
| `MCP_CONTROL_FILE` | `./data/control.json` | MCP master state |
| `MCP_POLICY_FILE` | `./data/policy.json` | Persisted permissions |
| `MCP_NETWORK_DRAFT_FILE` | `./data/network-draft.json` | Domain/SSL/port drafts |
| `MCP_DNS_PROVIDER_FILE` | `./data/dns-provider.json` | Sensitive Cloudflare zone/token state |

In the Docker install, the earlier installer mapped state files into `/data/*` rather than the relative development defaults. All private files and backups require restricted access. Never publish a populated `.env` or provider token.

## OAuth, tools and restrictions

| Variable | Previously observed default | Behavior |
| --- | --- | --- |
| `OAUTH_ALLOWED_REDIRECT_URIS` | empty string | Comma-delimited exact redirect allowlist; external callbacks require HTTPS |
| `MCP_ALLOWED_TOOLS` | `system_status,disk_usage` | Comma-delimited hard ceiling; duplicate/unknown tools rejected |
| `MCP_READ_ROOT` | empty string | Optional absolute allowed read root |
| `MCP_WRITE_ROOT` | empty string | Optional absolute allowed write root |
| `MCP_DOCKER_CONTAINERS` | empty string | Optional comma-separated allowlisted container names |
| `MCP_DEPLOY_REPO` | empty string | Optional absolute deployment repository path |
| `MCP_DEPLOY_BRANCH` | `main` | Restricted Git branch name |
| `MCP_BROKER_SOCKET` | empty string | Required absolute socket path when broker tools/writes are configured |
| `MCP_BROKER_SECRET` | empty string | Long broker secret; previous validation required ≥32 characters when enabled |
| `MCP_ENABLE_WRITES` | `false` | Config hard gate; must also configure approval tools and broker |
| `MCP_ALLOW_GIT_SYNC` | `false` | Explicit deployment sync opt-in |
| `MCP_LOG_LEVEL` | `info` | One of `debug`, `info`, `warn`, `error` |

## Derived configuration fields (not env variables)

`AppConfig` additionally included `origin`, `redirectUris`, `allowedTools`, `secureCookies`, `writesEnabled` and boolean `MCP_ALLOW_GIT_SYNC`. These are computed by `loadConfig` and should not be confused with raw unvalidated strings.

### Example: conservative development defaults

```text
MCP_HOST=127.0.0.1
MCP_PORT=3000
MCP_ALLOWED_TOOLS=system_status,disk_usage
MCP_ENABLE_WRITES=false
MCP_ALLOW_GIT_SYNC=false
```

**Illustrative only:** This is not a complete deployable `.env`. Use `scripts/install.sh` for private deployment and the current `.env.example` for local development. The current `.env.example` was re-opened on 2026-11-20; the private Docker installer generates its own `.env`.
