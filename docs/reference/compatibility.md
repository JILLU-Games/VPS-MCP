---
order: 3
---

# Compatibility and Deployment Matrix

| Environment / client | Evidence | Decision |
| --- | --- | --- |
| Ubuntu 24.04 + Docker Compose | Previously exercised in CI | Candidate private host profile; live VPS not tested here |
| Node.js 22 | Previously configured in GitHub Actions | Development/runtime baseline observed |
| HTTP/HTTPS MCP client with OAuth | Protocol-level implementation observed | Requires matching authentication/transport; client-specific validation pending |
| ChatGPT public MCP connection | No successful live end-to-end evidence | **Unverified / not turnkey** |
| Windows PC with OpenSSH/PuTTY | Documented as SSH tunnel client | Browser/operator access only |
| Windows native Node server installation | Not inspected/tested | Not certified |
| Public HTTPS reverse proxy and automatic renewal | Not supplied as complete private profile | Not ready |
| Cloudflare zone DNS CRUD | Mocked API tests previously passed | Live Cloudflare token/zone unverified |
| Docker/Git privileged broker | Source path exists; private Compose does not run it | Not default feature / isolated deployment review required |
| Alternative DNS providers | Not implemented in reviewed provider integration | Unsupported |

Avoid describing any platform or AI client as tested merely because the protocol could theoretically support it.

Refer to [requirements](../getting-started/requirements.md), [integration](../guides/integration.md) and [evidence limitations](../audit/coverage-and-validation.md).
