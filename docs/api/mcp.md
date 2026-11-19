---
order: 2
---

# MCP Tool Surface

The observed server used **Streamable HTTP** at `/mcp` with OAuth. Tools are advertised based on the current allowed tool set, global/per-client policy and granted scopes. A tool can exist in the implementation but be unavailable to an individual client.

## Observed tool names

| Tool name | Purpose | Default private profile |
| --- | --- | --- |
| `system_status` | Read-only CPU/memory/uptime/system information | Enabled in earlier Compose profile |
| `disk_usage` | Read-only disk metrics for constrained paths | Enabled in earlier Compose profile |
| `workspace_list` | List items under configured read root | Not enabled by default |
| `workspace_read` | Read bounded text in configured read root | Not enabled by default |
| `docker_status` | Broker-mediated allowlisted Docker inspection | Requires separately configured broker |
| `deployment_status` | Restricted deployment state inspection | Requires separately configured broker |
| `operation_request` | Propose restricted approval-gated write | Not enabled by default |
| `operation_execute` | Execute a previously approved restricted operation | Not enabled by default |

### Parameters and return schemas

**Not complete:** The exact JSON input/output schemas for each tool could not be reopened in the current source access session. This reference **intentionally does not invent tool arguments or return fields**. Generate exact schemas from the current tool registration in `src/server/mcp.ts`/tool modules and a connected `tools/list` response before publishing a machine-readable API contract.

### Permissions

Tool access requires configured ceiling + policy + client authorization + granted OAuth scopes. Writes require additional operation controls, approvals and independent broker prerequisites. The private Docker profile does **not** grant unrestricted shell, root SSH, firewall control, public DNS control through MCP, or Docker daemon control.

### Live client verification sequence

1. Connect over a supported transport to the correct OAuth-protected `/mcp` resource.
2. Obtain authorization and read-only scope.
3. Call the MCP protocol's `tools/list` and inspect actual advertised schemas.
4. Invoke `system_status` and `disk_usage` using those schemas.
5. Deny one tool through policy, re-discover, and ensure it cannot be called.
6. Revoke the client and ensure its credentials stop working.

This verification was **not run in this documentation-only pass**.
