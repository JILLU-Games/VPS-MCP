# Glossary

| Term | Meaning in VPS-MCP |
| --- | --- |
| **MCP** | Model Context Protocol; interface through which compatible clients discover/invoke tools |
| **Streamable HTTP** | Network transport used for MCP requests in the reviewed server |
| **OAuth resource** | Protected MCP endpoint requiring bearer authorization |
| **Admin session** | Cookie-backed dashboard authentication; separate from MCP bearer tokens |
| **CSRF token** | Session-linked request token required for state-changing admin routes |
| **Configuration ceiling** | Environment allowlist that UI toggles may restrict but not expand |
| **Per-client policy** | Additional tool/scope restriction applied to a registered OAuth client |
| **Broker** | Optional separately privileged mediator for constrained host operations |
| **Zone** | An authoritative Cloudflare DNS management boundary selected by Zone ID |
| **Provider token** | Cloudflare scoped secret for DNS API access; never return through admin status |
| **DNS draft** | Saved proposed domain/SSL setting; does **not** change real DNS |
| **Real DNS CRUD** | Separate Cloudflare API-backed record changes through admin panel |
| **Internal port** | Port on which the Node service listens inside its container |
| **Host bind port** | Loopback port published by Docker on the VPS host |
| **First-admin marker** | Durable state preventing anonymous re-setup after initial admin creation |
| **Source-level export** | Symbol exported from a `.ts` module; not necessarily a supported npm package API |
