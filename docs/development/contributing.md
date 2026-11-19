# Contributing and Maintenance

VPS-MCP was operated as a GitHub-hosted project with a tracked lockfile, test workflow and source-specific feature documentation in previous sessions. **A formal CONTRIBUTING policy, code owner list, required PR status rules and open-source redistribution license were not re-inspected.** Do not invent a governance policy.

## Conservative contribution procedure

1. Verify the current repository license and contributor documents before redistribution.
2. Create a feature branch using your own approved team workflow.
3. Keep changes within a reviewed scope and preserve production data/secrets.
4. Add negative tests for authorization and error behavior, not only happy-path tests.
5. Run the exact current package scripts and review CI before requesting merge.
6. Update developer docs when a route, config variable, tool schema or policy boundary changes.

### Change review checklist

- MCP tool registration and policy checks modified together.
- Newly added HTTP mutation requires server-side auth and CSRF, not merely UI confirmation.
- Secrets are stored in private state and never echoed in API responses or logs.
- Docker/host privileges remain separate from the web API.
- Backup/restore allowlists include newly added private state files.
- Existing data and interfaces receive focused regression coverage.
- Examples use actual source exports and tested inputs.

This is **recommended technical practice**, not an assertion that the repository already enforces all listed PR policies.
