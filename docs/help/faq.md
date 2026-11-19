---
order: 2
---

# Frequently Asked Developer Questions

### Is VPS-MCP a published reusable npm SDK?

The evidence proves a Node.js/TypeScript *application*, but not a stable published npm package interface. Only documented source-level symbols were confirmed in earlier review. See [API classification](../api/index.md).

### Can developers use the web admin cookie to call MCP tools?

No. Admin sessions and OAuth bearer tokens are distinct authentication mechanisms. The observed MCP endpoint requires OAuth authorization and policy checks.

### Can Cloudflare DNS records be changed by an AI MCP client?

Not through the observed default tool catalog. Cloudflare DNS CRUD was implemented as protected **administrator HTTP** endpoints. The project must explicitly implement and secure an MCP DNS tool before claiming that feature.

### Does saving a domain or selecting external HTTPS issue a certificate?

No. Network settings contain a draft mode. Actual Cloudflare DNS CRUD and SSL provisioning are different operations. Automatic certificate issuance was not implemented in the observed private profile.

### Does `MCP_ENABLE_WRITES=true` alone enable Docker/root changes?

No. The observed configuration also required appropriate allowed tools, approval controls, broker socket/secret and runtime isolation. The default Compose image did not start a privileged broker.

### Is 59/59 CI evidence proof of production readiness?

No. That result was historical for one commit, mocked the provider API and did not test public HTTPS, a live VPS or an external OAuth client.

### Why is full API coverage marked incomplete?

Current GitHub source fetch returned a linked-account error; the desktop working machine was offline, and the repository is not mounted in the runtime. Claiming all exports, exact dependencies and every tool schema under those conditions would violate the zero-fabrication requirement.

### Did documentation creation alter the repository or run Git?

No. This suite was generated in a separate `docs/` package for review and merge, with **no source edits or Git operations**.
