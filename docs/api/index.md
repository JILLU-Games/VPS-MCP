---
title: "Developer API Reference"
description: "Private HTTP administration API, OAuth-protected MCP tools, and internal TypeScript source-level exports."
order: 3
draft: false
---

# Developer API Reference

VPS-MCP is an application service, not a verified published TypeScript SDK. The **stable surface for remote integrations is MCP over HTTP**, and the **administrative routes are operator-only**. No semver stability guarantee for internal TypeScript imports was established in this audit.

| Surface | Reference | Stability classification |
| --- | --- | --- |
| Authenticated HTTP admin API | [HTTP endpoints](http.md) | Project-specific/private, not general public SDK |
| MCP Streamable HTTP | [MCP tools](mcp.md) | Protocol endpoint; tool availability permission-controlled |
| Internal TypeScript exports | [TypeScript symbols](typescript.md) | Known source exports, **not verified stable package exports** |
| Failure modes | [Errors and denials](errors.md) | Route/provider-dependent |

> Evidence note: exact signatures below are from the **source verification report and earlier audits, with current file-level exports rechecked where stated**, not a current HEAD reinspection. For a public API commitment, inspect package `exports`/`main`/`types` and current code first.
