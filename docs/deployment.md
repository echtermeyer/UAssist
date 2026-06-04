# Deployment

## Infrastructure

UAssist runs on a single Ubuntu 24.04 VM using **Docker Compose**. Three long-lived containers are managed by Compose; tenant-worker containers are spawned and removed dynamically by the API.

```
VM
├── docker-compose.yml
│   ├── api          (port 3000)
│   ├── frontend     (port 3001)
│   └── mongodb      (127.0.0.1:27017, not exposed)
│
└── dynamic containers (managed by API via Docker socket)
    ├── tenant-worker-<tenantId-A>
    ├── tenant-worker-<tenantId-B>
    └── ...
```

Container images are built by GitHub Actions and pushed to GitHub Container Registry (GHCR). The VM pulls from GHCR on every deploy.

---

## CI/CD Pipeline

Every push to `main` triggers `.github/workflows/deploy.yml`.

### Change detection

The workflow uses path filters to skip unnecessary builds:

| Changed path | Builds |
|---|---|
| `api/**` | `api` image |
| `frontend-app/**` | `frontend` image |
| `tenant-worker/**` | `tenant-worker` image |

If none of those paths changed (e.g. only docs updated), no images are built and the deploy step updates only the running compose stack.

### Build stage (parallel)

Three jobs run in parallel, each:
1. Checks out the repo
2. Logs into GHCR with `GITHUB_TOKEN`
3. Builds the Docker image with `--cache-from` for layer reuse
4. Pushes `ghcr.io/<owner>/uassist-<service>:latest`

### Deploy stage

After all builds succeed, a single deploy job:

1. SSHs into the VM as the `deploy` user
2. Pulls all three images from GHCR
3. Writes the `.env` file from GitHub secrets (KMS keys, JWT secret, passwords)
4. Stops all running tenant-worker containers
5. Runs `docker compose down --remove-orphans`
6. Runs `docker compose up -d`
7. Prunes dangling (untagged) images to reclaim disk space
8. Runs `node api/seed-demo.js` to reset demo account data

### Required GitHub Secrets

| Secret | Purpose |
|---|---|
| `SSH_HOST` | VM IP address |
| `SSH_USER` | `deploy` |
| `SSH_PRIVATE_KEY` | SSH private key for `deploy` user |
| `SSH_PORT` | `22` |
| `MONGO_PASS` | MongoDB `uassist_api` user password |
| `MONGO_ADMIN_PASS` | MongoDB `mongoadmin` password |
| `JWT_SECRET` | JWT signing secret (64+ random hex chars) |
| `AWS_KMS_KEY_ID` | KMS master key ARN |
| `AWS_ACCESS_KEY_ID` | AWS credentials for KMS |
| `AWS_SECRET_ACCESS_KEY` | AWS credentials for KMS |
| `ADMIN_PASS` | Initial admin user password |
| `TENANT_WORKER_IMAGE` | Full GHCR image name for tenant-worker |

---

## Environment Variables

Copy `.env.example` to `.env` and fill in all values before running.

### API

| Variable | Description | Example |
|---|---|---|
| `MONGO_URL` | MongoDB connection for app queries | `mongodb://uassist_api:pass@mongodb:27017/?authSource=admin` |
| `MONGO_ADMIN_URL` | MongoDB connection for tenant DB provisioning | `mongodb://mongoadmin:pass@mongodb:27017/?authSource=admin` |
| `JWT_SECRET` | JWT signing key — keep secret, rotate if leaked | 64+ random hex chars |
| `AWS_KMS_KEY_ID` | KMS master key ARN for envelope encryption | `arn:aws:kms:eu-central-1:...` |
| `AWS_ACCESS_KEY_ID` | AWS IAM key for KMS | — |
| `AWS_SECRET_ACCESS_KEY` | AWS IAM secret for KMS | — |
| `CORS_ORIGIN` | Allowed frontend origin | `http://46.225.227.83:3001` |
| `COOKIE_SECURE` | Set `Secure` flag on JWT cookie | `false` for HTTP, `true` for HTTPS |
| `TENANT_WORKER_IMAGE` | Docker image for tenant containers | `ghcr.io/<owner>/uassist-tenant-worker:latest` |
| `SMTP_USER` | SMTP username for outbound email | GMX address |
| `SMTP_PASS` | SMTP password | — |
| `ADMIN_PASS` | Password seeded for admin account | — |

### Frontend

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_API_URL` | API base URL — must be reachable from the browser |

### MongoDB

| Variable | Description |
|---|---|
| `MONGO_INITDB_ROOT_USERNAME` | Admin user created on first init |
| `MONGO_INITDB_ROOT_PASSWORD` | Admin password |

---

## Initial VM Setup

Run once after provisioning the VM:

```bash
# 1. Bootstrap: Docker, deploy user, GeoIP tools
bash scripts/bootstrap-vm.sh

# 2. Apply GeoIP restriction to port 3000
bash scripts/geoip-de.sh

# 3. Trigger full deploy via GitHub Actions
# (push a commit to main, or manually dispatch setup.yml)
```

The `setup.yml` workflow is a one-time manual trigger that:
- Installs Docker on the VM
- Creates the `deploy` user with Docker group membership
- Generates `.env` from GitHub secrets
- Pulls images and runs `docker compose up -d`

After setup, all subsequent deploys are handled automatically by `deploy.yml` on every push to `main`.

---

## Local Development

```bash
# Start MongoDB + API + frontend
cp .env.example .env   # fill in secrets (AWS KMS required for encryption)
docker compose up -d

# Frontend hot-reload (optional — faster than rebuilding the container)
cd frontend-app
npm install
npm run dev            # http://localhost:3001
```

The compose stack mounts no source volumes — each service runs from its built image. For iterative API development, rebuild just the API image:

```bash
docker compose build api && docker compose up -d api
```

### Running tests

```bash
cd api
npm test
# or against a running instance:
API_URL=http://localhost:3000 node --test test/integration.test.js
```

---

## Tenant Worker Lifecycle

Tenant-worker containers are created and managed by the API:

| Event | Action |
|---|---|
| User completes WhatsApp onboarding | API creates/restarts `tenant-worker-<tenantId>` container |
| User connects email or Slack | API restarts existing worker (new env vars needed) |
| Deploy | All tenant workers stopped before `docker compose down`, restarted after |
| Idle (no onboarded channels) | No container is running for that user |

Workers receive `TENANT_ID`, `MONGO_URL`, and `USER_DATA_KEY` (plaintext AES-256 key, hex) as environment variables. Session data persists in named Docker volumes (`wa-session-<tenantId>`, `signal-data-<tenantId>`).

---

## Monitoring & Logs

```bash
# Compose service logs
docker compose logs -f api
docker compose logs -f frontend

# Tenant worker logs
docker logs tenant-worker-<tenantId> -f

# List all running containers
docker ps
```

There is no centralized log aggregation or alerting configured. For production use, forwarding logs to a service like Loki, Datadog, or CloudWatch would be the recommended next step.
