# Private Compose Operations and Data Recovery

The previously reviewed deployment shipped these shell scripts under `scripts/`:

| Script | Purpose / safety boundary |
| --- | --- |
| `install.sh` | Generate private initial environment and run Compose; existing secrets must not be reset |
| `status.sh` | Show deployment state |
| `stop.sh` | Stop services without deleting persistent data |
| `update.sh` | Update existing compatible private installation |
| `uninstall.sh` | Remove services but retain existing `.env` and volume |
| `backup.sh` | Stop API briefly, capture `.env` and volume state, restart API |
| `check-backup.sh` | Check archive structure and restricted permissions, **not** a restore |
| `restore.sh` | Restore into an **empty** installation only; reject existing `.env` or volume |
| `apply-network.sh` | Apply a staged loopback **host port** via SSH, health-check and attempt rollback |

Commands are to be executed from the actual VPS repository root:

```bash
sudo docker compose ps
sudo docker compose logs --tail=100 api
sudo bash scripts/backup.sh
```

The backup contains administrator credential hashes, OAuth state, policy, audit events, network draft, and—after Cloudflare DNS was added—the stored provider token. Its archive is **not encrypted**. Never attach a backup to a public issue.

### Restore operation

Review the current `scripts/restore.sh` allowlist and test in an isolated Compose project. The earlier script intentionally rejected non-regular archive entries, unexpected paths, existing `.env`, or existing Docker data volume. Restored credentials should be retained without reopening one-time admin setup.

### Port changes

`MCP_BIND_PORT` changes the host's **loopback** binding; it does not change internal `MCP_PORT` or publish an internet-facing service. The SSH forward must target the new VPS host port. Domain/SSL plan saves are not port changes until the SSH-admin script is applied.

No automatic public HTTPS gateway or certificate renewal service was verified in the previous source snapshot.
