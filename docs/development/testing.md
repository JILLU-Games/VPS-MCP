---
order: 2
---

# Testing and Verification

## Package scripts verified against current `package.json`

```bash
npm ci
npm run typecheck
npm test
npm run build
npm run check
```

The prior CI output showed `npm run check` executing `typecheck && test && build`; tests used `tsx --test tests/*.test.ts`. The scripts were rechecked at `5c19d0a9fff8d63bd55a4447c891f2b26374c32b`. `npm run check` runs `typecheck && test && build`. GitHub CI installs dependencies via `npm install --no-audit --no-fund`.

## Known test categories

- Environment validation, HTTP host/origin and private-container restrictions.
- Login, first-admin setup, session and CSRF.
- OAuth registration/token flow and client revocation.
- MCP permission ceilings, tool/client policies and approvals.
- Sidebar/UI mocks, dirty form preservation and DNS status semantics.
- Network plan validation, private host-port change/rollback-related smoke checks.
- Cloudflare mock provider connection, allowed-zone enforcement, record CRUD and stale-edit rejection.
- Private Docker installer, service restart, backup and isolated restore.

### Historic evidence (not a new execution)

The preceding codebase session reported **59/59 automated tests passed**, zero vulnerabilities *reported by npm audit*, and an isolated Docker smoke run for commit `5c19d0a9fff8d63bd55a4447c891f2b26374c32b` (GitHub Actions run `40776225155`). It used mocked Cloudflare responses. This historic CI result **does** match the verified source HEAD, but it does not verify real Cloudflare credentials, external OAuth or a real VPS.

## Further tests required for completion

- Export and route inventory against the actual source at current HEAD.
- Test exact HTTP and MCP request/response schemas using controlled fixtures.
- Negative test: private secret non-disclosure in JSON, redirects, audit logs and errors.
- Real-browser desktop/mobile keyboard/accessibility checks.
- Controlled failure injection for occupied port and restore rollback.
- Separate live Cloudflare test zone with non-critical records.
- Authenticated remote MCP integration with an actual client and valid HTTPS/tunnel topology.

No tests were executed during this documentation-only pass; the existing successful GitHub CI remains historical evidence.
