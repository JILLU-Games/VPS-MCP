# Requirements and Supported Contexts

## Observed architecture

- Runtime: **Node.js + TypeScript**, with application code in `src/`.
- Development package manager: **npm** with a tracked `package-lock.json`; prior CI used **Node.js 22** and `npm ci`.
- Runtime framework: Node HTTP/HTTPS server, MCP Streamable HTTP handler, OAuth authorization endpoints and admin-panel static assets.
- Server host profile: Ubuntu 24.04 was used in earlier CI/operational guidance; Docker Engine with **Compose plugin** required for the private installer.
- UI: static HTML/CSS/vanilla JavaScript; no Electron or separate SPA framework was identified in earlier review.

## Verified vs unverified support

| Item | Status |
| --- | --- |
| Node 22 in previous CI | Observed |
| Ubuntu 24.04 Docker CI | Observed |
| Windows as browser/SSH client | Documented operational use; not a Windows-native server build |
| macOS as browser/SSH client | Generic SSH client behavior; no project-specific runtime certification |
| Other Node versions and Linux distributions | **Not verified** |
| npm publishable library entrypoint / package exports | **Not verified**; do not assume it is an SDK |
| Latest dependency semver constraints | **Not re-inspected** in this pass |

For a current compatibility matrix, rerun the repository workflows and read the actual `package.json`, lockfile, Dockerfile, `compose.yaml` and `.github/workflows/` on the target revision.

## Private profile prerequisites

A reviewed Ubuntu VPS with sudo, Git, OpenSSL, outbound network access, sufficient Docker storage and a free loopback host port. Docker installation itself is privileged; granting a non-root user Docker daemon access is effectively root-level access. Avoid modifying the Docker host without reviewing other running workloads.
