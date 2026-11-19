# Developer Troubleshooting

| Symptom | Likely layer | Safe action |
| --- | --- | --- |
| `docker: command not found` | Host prerequisites | Follow official Docker Engine Ubuntu installation instructions |
| `docker compose` unavailable | Compose plugin | Install/check Compose plugin, not assumed legacy `docker-compose` |
| Private panel inaccessible from laptop | SSH forward / binding | Verify VPS `127.0.0.1:3000` and local SSH port forward |
| Public `VPS_IP:3000` doesn't work | Expected isolation | **Do not** expose the port; use authorized tunnel |
| `first_setup_required` | Admin initialization | Complete token-backed first visit; do not reset the persisted volume |
| Admin password forgotten | Account recovery | Restore reviewed backup; no anonymous account reset |
| `.env` missing while data volume exists | Installer safety | Restore original private config, don't issue new secrets on existing data |
| Tools missing from `tools/list` | Permission ceilings | Inspect environment tool allowlist, client scopes and global policy |
| Cloudflare `dns_provider_access_denied` | Token scope / zone | Use a zone-scoped token with Zone Read and DNS Edit |
| Cloudflare record `409` | Stale or invalid state | Re-list records; compare before retry |
| DNS name resolves but website HTTPS fails | Certificate/gateway | DNS and SSL are independent; provision an approved TLS gateway |
| Plan saved but port unchanged | Draft only | Authorized SSH administrator must run port apply helper |
| Docker host port changed but tunnel broken | Forward destination mismatch | Forward PC source 3000 to newly configured VPS host port |
| Cannot connect ChatGPT to localhost | Remote transport | Public HTTPS/tunnel plus reachable OAuth flow required |
| Backup restore rejects existing volume | Disaster recovery guard | Use an independent empty destination; do not delete live state to force restore |
| New provider state causes restore failure | Restore-file allowlist | Inspect `restore.sh` allowlist on current revision; do not bypass archive safeguards |

Before filing a defect, capture non-secret Node/Docker versions, route/error code, minimal reproducer, clean CI log excerpts and exact immutable commit SHA. Use [Debugging](../development/debugging.md) for commands.
