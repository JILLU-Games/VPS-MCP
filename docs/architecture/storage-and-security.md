# Storage, Isolation and Security Boundaries

## Private state observed

The earlier Compose implementation stored sensitive state in a private volume, including:

| Data | Observed purpose |
| --- | --- |
| `admin.json`, `admin.json.complete` | Administrator credential hash and durable setup marker |
| `oauth-state.json` | OAuth client and token-related persisted state |
| `control.json` | Master MCP enabled state |
| `policy.json` | Tool and client permission policy |
| `audit.jsonl` | Audit history |
| `network-draft.json` | Planned domain, SSL mode and private host port |
| `dns-provider.json` | Cloudflare zone ID, zone name and **live API token** |
| `.env` on host | Auto-generated operational secrets and runtime configuration |

File contents must not be copied into public documentation. Permission checks in reviewed code rejected insecure credential/policy files. The default Docker image ran under non-root UID, read-only filesystem, with dropped capabilities and no privileged Docker socket.

## Backup boundary

The scripts back up both `.env` and private volume. Backup archives are **unencrypted**, even if filesystem permissions are restrictive. Include provider-token rotation in a disaster recovery plan. Restoring a backup into an existing volume is intentionally blocked.

## HTTP security

Observed HTTP router enforced Host and Origin checks, CSP, no-store, `nosniff`, frame denial, restrictive referrer policy, HTTPS-only HSTS when secure cookies are configured, session/CSRF checks, and route-level rate limits. **These are source observations, not a penetration test**. Public reverse proxy trust handling is not certified.

## Cloudflare threat model

- Token is scoped to a single configured zone, never returned in status response.
- Destination URL is fixed to Cloudflare's HTTPS API to reduce SSRF surface.
- DNS edits can cause real availability/email outages; confirmations cannot substitute for careful change review.
- A stolen private backup includes provider-token material unless rotated.
- The DNS admin API is **not** an MCP tool and should not be exposed via an AI client.

## Broker warning

Mounting `/var/run/docker.sock` inside the web API grants effectively root-equivalent access. The private profile intentionally does not do this. An independent, least-privilege broker remains a separate production gate.
