---
order: 3
---

# Runtime and Request Execution Flows

## Initialization

```mermaid
flowchart TD
    A[Process start] --> B[loadConfig and validate env]
    B --> C[Construct sessions, setup, OAuth, audit, policy]
    C --> D[Load network and DNS provider private state]
    D --> E[Create HTTP and MCP handlers]
    E --> F[Bind listener]
    F --> G[Serve health, metadata, admin and MCP routes]
```

The diagram represents the previously inspected application factory and startup configuration. The exact current entrypoint invocation and initialization ordering require fresh source verification.

## First-admin onboarding

Installation issues a one-time setup token. Before account initialization, the server rejects protected login/OAuth/MCP operations and exposes a restricted setup endpoint. The first account password becomes a hash in private state; a separate durable completion marker stops the setup flow reopening after account-state loss.

## Administrator mutation

```mermaid
flowchart TD
    Req[Admin POST] --> Session{Authenticated session?}
    Session -->|No| Deny[Deny]
    Session -->|Yes| CSRF{Valid CSRF?}
    CSRF -->|No| Deny
    CSRF -->|Yes| Validate[Validate request]
    Validate --> Audit[Record authorization intent]
    Audit -->|Persistence failure| Fail[Fail closed]
    Audit --> Apply[Persist plan or call Cloudflare]
    Apply --> Result[Sanitized status]
```

**Important:** Not all older admin routes necessarily use the same durable-audit gate; the explicit before-write ordering was observed for network plan and new Cloudflare mutation routes. Review each route before assuming universal transactional behavior.

## Provider mutation semantics

Cloudflare record changes use the configured zone ID, validate the payload, and on edit/delete re-read the target record before the mutation. A stale `expectedContent` mismatch rejects the change. Cloudflare and local audit storage are **not a single distributed transaction**; a successful remote operation followed by a local failure may require reconciliation.
