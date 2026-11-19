# Tool Permissions, Client Restrictions and Approvals

## Effective permission model

A granted tool call is restricted by multiple independent checks:

```text
Configuration allowlist (hard ceiling)
  ∩ global tool switch
  ∩ registered-client tool policy
  ∩ OAuth scopes / identity
  ∩ read/write capability prerequisites
  ∩ (for writes) operation gate + approval + broker restrictions
```

Turning a control ON in the panel **cannot** override a tool absent from `MCP_ALLOWED_TOOLS`. The previously inspected private Compose profile used `system_status,disk_usage`, disabled writes, and did not provide the privileged broker.

## Administrative controls

Observed protected endpoints included `POST /api/control/tool`, `/api/control/action`, `/api/control/writes`, `/api/control/client-tool`, `/api/control/client-scope`, and `/api/control/revoke-client`. They require a valid administrator session and CSRF token; see [HTTP API reference](../api/http.md).

The control panel also supports an MCP master switch, OAuth client enrollment window, client revocation, audit history, and one-time approvals. No browser-only check is treated as a backend authorization decision.

## Write-operation boundary

The source contains restricted broker-oriented operations for file creation, Docker restart and deployment sync. The default private Compose stack does **not** ship with an enabled privileged broker, and does not grant the web API host Docker socket access. Do not document these write operations as available in a default installation.

An approval is not an authorization bypass; an action must still pass current policy and broker scope checks. Revoked clients lose their registered access. Review pending approvals and their lifespan against the current code before altering approval semantics.

## Recommended extension pattern

When introducing a tool, update the configuration ceiling, server-side policy checks, MCP registration and test matrix together. Add negative tests for disabled client, missing scope, master switch off, stale approval, and revoked token. Never enable by adding only a UI toggle.
