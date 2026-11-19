# Installation — Private Docker Profile

The following workflow is documented in the previously reviewed installer and Compose configuration. **It has not been executed during this documentation-only run.**

## Install dependencies on a reviewed Ubuntu host

Use an existing supported Docker Engine/Compose installation, or follow [Docker's maintained Ubuntu instructions](https://docs.docker.com/engine/install/ubuntu/).

```bash
sudo docker version
sudo docker compose version
```

Install Git and supporting tools if missing:

```bash
sudo apt-get update
sudo apt-get install -y git openssl curl ca-certificates
```

## Clone and run the built-in installer

```bash
git clone https://github.com/vibtoolshq/VPS-MCP.git
cd VPS-MCP
sudo bash scripts/install.sh
```

In the previously examined implementation, `install.sh` generates a private `.env`, a one-time first-admin activation token, and creates/starts the Docker Compose profile. The initial token appears in the server terminal; **never put it in version control, CI logs or an issue**.

The private service publishes **host loopback only** (initially `127.0.0.1:3000`). It is **not accessible through `http://PUBLIC_VPS_IP:3000`**.

## Establish an SSH tunnel from the developer workstation

```bash
ssh -N -L 3000:127.0.0.1:3000 ubuntu@YOUR_VPS_IP
```

Leave the tunnel running and visit `http://127.0.0.1:3000` on the workstation. Enter the one-time activation token and set a strong administrator password. The example `admin / Pass@123` is **not an active default credential**.

## Verify read-only functionality

On the VPS:

```bash
cd ~/VPS-MCP
sudo docker compose ps
curl --fail --silent http://127.0.0.1:3000/health
curl --fail --silent http://127.0.0.1:3000/api/setup/status
```

Expected health payload was `{ "status": "ok", "service": "vps-mcp" }` in the earlier snapshot. Setup status should eventually report `required: false`. These checks do not establish remote OAuth or public HTTPS readiness.

## Persistent data and recovery

The installer uses a private Docker volume. **Do not delete it** to recover from a missing `.env` or lost password. Use [Operations](../guides/operations.md) for backup and restore procedures.
