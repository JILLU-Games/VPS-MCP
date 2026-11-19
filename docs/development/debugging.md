# Debugging and Observability

## First checks

On the authorized VPS:

```bash
sudo docker compose ps
sudo docker compose logs --tail=100 api
curl --fail --silent http://127.0.0.1:3000/health
```

The default private setup binds to host localhost; use an SSH tunnel for remote browser access. If the host port was changed, query that host port, not the internal container port.

## Triage by layer

| Layer | Diagnostic |
| --- | --- |
| Installer | Check Docker/Compose and `.env` state without printing secrets |
| Browser login | Inspect setup status, session cookie and CSRF failure reason |
| MCP transport | Verify OAuth bearer, origin and requested tool scopes |
| Tool discovery | Check `MCP_ALLOWED_TOOLS`, tool policies and client restrictions |
| Provider | Confirm correct Cloudflare zone ID, token scope, API response category |
| Persistence | Check private `/data` mount, UID/file permissions and audit storage |
| Network | Check loopback host port, SSH tunnel and DNS-vs-SSL distinction |

`MCP_LOG_LEVEL` previously accepted `debug`, `info`, `warn`, `error` and defaulted to `info`. Enabling debug should **not** print secrets.

### Data hygiene

Never paste a populated `.env`, admin credentials, provider token, bearer headers, cookies, setup tokens, private archives or full audit data into public issues. Sanitize error reports while retaining non-secret status and module names.

If a Cloudflare mutation was accepted remotely but the UI didn't update, **re-list the zone** before retrying. DNS mutation and local audit write are not one atomic transaction.
