---
title: "VPS-MCP Developer Documentation"
description: "Engineering reference for the VPS-MCP TypeScript server, MCP tools, OAuth, security controls, Cloudflare DNS, tests, and private Docker deployment."
version: "0.4.0"
order: 0
draft: false
---

# VPS-MCP Developer Documentation

**Node.js/TypeScript MCP server · private administration API · OAuth · Docker Compose · Cloudflare DNS integration**

This documentation is for developers operating, integrating with, testing, or extending **VPS-MCP**. It is not a replacement for the beginner-facing repository README.

> **Source verification update (2026-11-20):** The current `main` revision `5c19d0a9fff8d63bd55a4447c891f2b26374c32b` was reopened through the linked GitHub repository. The package manifest, configuration, entrypoint, HTTP routes, MCP registration, Cloudflare DNS adapter, Docker scripts, Compose, and **all 22 `src/**/*.ts` modules** were inventoried. The documentation includes a [fresh source-verification report](audit/source-verification-2026-11-20.md). **No tests or examples were executed in this documentation publication pass**, and an exhaustive line-by-line API or live production certification is not claimed.

## Choose a path

| Your task | Start here |
| --- | --- |
| Build locally | [Requirements](getting-started/requirements.md) → [Development setup](development/local-setup.md) |
| Deploy private Docker profile | [Installation](getting-started/installation.md) → [Operational guide](guides/operations.md) |
| Understand external MCP integration | [MCP transport and OAuth](guides/integration.md) |
| Use the administrator HTTP API | [HTTP API reference](api/http.md) |
| Understand supported MCP tools | [MCP tool reference](api/mcp.md) |
| Work with Cloudflare DNS | [Cloudflare DNS integration](guides/cloudflare-dns.md) |
| Configure permissions | [Permissions and approvals](guides/access-control.md) |
| Change environment options | [Configuration reference](reference/configuration.md) |
| Maintain or extend source | [Architecture](architecture/overview.md) · [Internal modules](architecture/modules.md) |
| Troubleshoot | [Troubleshooting](help/troubleshooting.md) |

## Implementation boundary

The observed system has **two distinct interfaces**:

1. **Private administrator HTTP interface**: session cookie + CSRF for state changes; not an MCP tool or a generally supported public REST SDK.
2. **MCP Streamable HTTP interface**: OAuth bearer-protected `/mcp` with server-advertised tools controlled by environment and persisted policy.

A Cloudflare DNS administration form is **not equivalent to an MCP DNS tool**: the DNS CRUD APIs are in the private panel, not the MCP tool catalog.

The default Compose configuration uses loopback-host access and read-only MCP tools. Public HTTPS, remote ChatGPT OAuth, automatic SSL issuance, and privileged VPS operations require separate engineering and validation.

Review the [source-verification report](audit/source-verification-2026-11-20.md), [coverage limitations](audit/coverage-and-validation.md), and [Vib Docs Engine configuration checklist](audit/vib-docs-engine-checklist.md) before relying on this material as a production release reference.

> **Publishing note:** Repository governance file `MANIFEST.md` is intentionally excluded from the public documentation portal by Vib Docs Engine.
