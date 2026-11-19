# Documentation Consistency and Known Misreadings

On 2026-11-20, the live GitHub tree at `5c19d0a9fff8d63bd55a4447c891f2b26374c32b` was inspected, including the list of existing `docs/*.md` paths. This documentation suite adds new nested pages without replacing existing legacy guides. The table below captures important distinctions verified from current source; a complete line-by-line reconciliation of each legacy doc remains out of scope.

| Topic | Potential mismatch to correct | Correct interpretation from earlier source review |
| --- | --- | --- |
| “Domain & DNS management” | Draft/diagnostic vs live Cloudflare record CRUD | Separate features: draft is not a mutation; Cloudflare endpoints mutate real provider records |
| “Automatic SSL” | Choosing HTTPS mode implies live TLS | No certificate issuance/renewal performed by draft save |
| “MCP supports DNS” | Admin DNS API assumed to be an MCP tool | Cloudflare admin API not registered in observed MCP tool catalog |
| “All tools enabled from sidebar” | UI toggles assumed to bypass `.env` | Configuration allowlist is a hard permission ceiling |
| “Admin default password” | `Pass@123` treated as valid login | Shown only as onboarding example; strong password required on first visit |
| “Cloudflare token security” | Token never stored in backup | Provider token is in private state **and in private backup archive** |
| “Production ready” | Historical CI translated to live VPS readiness | CI verifies disposable build/tests; real provider/VPS and public OAuth pending |
| “TypeScript API exports” | Source export assumed to be supported npm SDK | `package.json` is private with no npm export map; internal source symbols are not supported external imports |
| “Quickstart works on every OS” | Ubuntu Docker path assumed universal | Previous CI primarily exercised Ubuntu 24.04 and Node 22 |

## Recommended reconciliation procedure

For any future source change, compare the legacy `docs/*.md` pages, README and the modules named in [module inventory](../architecture/modules.md) against the new HEAD. Preserve unrelated documents; update only demonstrably inaccurate technical statements. Document exact symbol definitions and line numbers in the next audit revision.
