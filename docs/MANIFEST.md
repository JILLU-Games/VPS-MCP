# Developer Documentation Manifest

Scope: developer-facing design, initialization, HTTP/MCP APIs, configuration, tests, and operations for VPS-MCP. End-user walkthroughs are intentionally brief and linked to the repository's README.

## Pages

| Area | Documentation |
| --- | --- |
| Getting started | [Requirements](getting-started/requirements.md), [Installation](getting-started/installation.md), [Quickstart](getting-started/quickstart.md) |
| Guides | [Integration](guides/integration.md), [Access control](guides/access-control.md), [Cloudflare DNS](guides/cloudflare-dns.md), [Operations](guides/operations.md) |
| Interfaces | [API index](api/index.md), [HTTP API](api/http.md), [MCP tools](api/mcp.md), [TypeScript symbols](api/typescript.md), [Errors](api/errors.md) |
| Architecture | [Overview](architecture/overview.md), [Modules](architecture/modules.md), [Execution flow](architecture/execution-flow.md), [Storage and security](architecture/storage-and-security.md) |
| References | [Environment configuration](reference/configuration.md), [Dependencies](reference/dependencies.md), [Compatibility](reference/compatibility.md), [Glossary](reference/glossary.md) |
| Development | [Local setup](development/local-setup.md), [Testing](development/testing.md), [Debugging](development/debugging.md), [Contributing](development/contributing.md), [Release process](development/release-process.md) |
| Help | [Troubleshooting](help/troubleshooting.md), [FAQ](help/faq.md) |
| Audit | [Evidence, coverage and validation](audit/coverage-and-validation.md), [Documentation mismatches](audit/documentation-mismatches.md), [Fresh source verification](audit/source-verification-2026-11-20.md) |

## Latest reviewed revision

`main`: `5c19d0a9fff8d63bd55a4447c891f2b26374c32b` (source re-opened 2026-11-20). See [source verification](audit/source-verification-2026-11-20.md).

## Source-of-truth policy

- **Confirmed from current GitHub source:** package metadata, 22 TypeScript module paths and exported names, HTTP paths, MCP tool registration, configuration schema, private Compose and Cloudflare adapter. Selected signatures were compared with the checked-out source text; this is not a stable published SDK.
- **Previous CI evidence:** GitHub Actions run `40776225155` was successful at the reviewed HEAD; CI was not rerun as part of this docs preparation.
- **Still unverified:** complete input/output shape of every internal function, all real browser/client integrations, live provider behavior, execution of documentation examples, and production VPS readiness.
- Do **not** treat unverified code as a supported API. No source, package metadata, tests or Git state were changed.

## Revision boundary

**Verified source base:** `5c19d0a9fff8d63bd55a4447c891f2b26374c32b` on `main` (checked 2026-11-20). The documentation was originally drafted 2026-11-19 and reconciled with the current source on 2026-11-20. Pin this SHA when comparing source implementation.
