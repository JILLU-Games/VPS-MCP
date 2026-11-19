---
title: "Vib Docs Engine Configuration Checklist"
description: "Frozen schema and ten-point documentation portal validation for the VPS-MCP developer documentation target."
order: 1
draft: false
---

# Vib Docs Engine — VPS-MCP Configuration Verification

**Portal target:** `developer.vibtools.io` only (`docsType: developer`). The developer material already lives under `docs/` and its root `index.md`. The repository's beginner-facing guide is the root `README.md`, not a separate `docs/users` portal tree. No user-portal target is invented.

**Frozen schema:** [Vib Docs Engine Schema](https://docs.vib.tools/schemas/vibtools-docs.schema.json), implemented in the [Vib Docs Engine source](https://github.com/vibtoolshq/vib-docs-engine/blob/main/src/utils/vibtoolsConfig.ts). Both portals use the same configuration contract. The hosted endpoints could not be fetched directly during this audit; checks were performed against the engine's checked-in spec and schema-builder source. A live portal sync/build is a separate verification step.

## Ten-point self-verification

| # | Official check | VPS-MCP outcome |
| - | - | - |
| 1 | One canonical config, no alias conflict | `.vibtools/docs.config.json` is the only `.vibtools` config file. |
| 2 | JSON parses and follows frozen schema | `$schema` is canonical, `schemaVersion` is integer `1`, and only source-defined root properties are used. |
| 3 | Correct `docsType` and targets | `developer` routes `docs/` to the developer portal; `targets` omitted because the project does not maintain a distinct user-portal tree. |
| 4 | Valid slug and accent | `vps-mcp` follows lower-case kebab-case; `#2563EB` is a six-digit hexadecimal accent. |
| 5 | Safe relative paths | `docsPath` is `docs` and `logoPath` is `.vibtools/logo.png`; both are safe repository-relative paths. |
| 6 | Root index exists | `docs/index.md` contains explicit page title, description, version, order, and body. |
| 7 | Frontmatter valid | Newly added metadata uses YAML delimiters, numeric `order`, and unquoted boolean `draft: false`. Existing documentation with no frontmatter is supported. |
| 8 | No typo manifests | `docs/MANIFEST.md` uses the exact recognized filename; no `MINIFEST.md`. Its public index link was removed because the engine strips manifests. |
| 9 | Relative links/assets | Repository documentation relative Markdown targets were audited, and category landing pages link only to existing files. Portal build verification remains untested against live sites. |
| 10 | Logo compliance | `logoPath: .vibtools/logo.png` points to the committed 512×512 transparent RGBA PNG (106,908 bytes, under the 2 MB limit). PNG signature and Git blob SHA are verified; the monogram fallback is no longer used. |

## Logo asset verification

The logo is stored as `.vibtools/logo.png` and displayed in the root README. It was resized from the approved generated transparent icon, not redesigned. Its Git blob SHA is `30f2a4eb54ab3144d6c9944aad942fced7e91fde` and SHA-256 is `24df4b06559c280dfad2a3adbf45889030f85fc8ae2c0823368298f53238c157`. GitHub confirms the binary asset separately from this checklist. Vib Docs Engine reads the repository-relative path from the frozen `logoPath` field. Live portal publication is a separate verification.

## Route-collision note

An existing root document `docs/ARCHITECTURE.md` normalizes to the `architecture` URL. For that reason **no** `docs/architecture/index.md` is added: it could collide with the legacy document. Existing `docs/architecture/*.md` technical pages remain available via their own routes. This preserves existing links without renaming source documents.

## Scope and release boundaries

Only documentation and the canonical `.vibtools/docs.config.json` were changed. Application code, dependencies, Docker files, tests, and the previous release baseline remain intact. A repository-side GitHub CI pass does **not** certify a live Vib Docs Engine sync, user portal publication, or a functioning public ChatGPT OAuth deployment.
