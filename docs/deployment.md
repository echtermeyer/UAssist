# Deployment

UAssist supports two deployment targets:

1. **Single VM (Hetzner-style)** — everything on one host via Docker Compose. See [Infrastructure](#infrastructure) below.
2. **GCP (Terraform)** — Cloud Run for api/frontend, one private GCE VM for MongoDB + tenant workers. See [GCP Deployment](#gcp-deployment-terraform).

In both targets, images are built by GitHub Actions and pushed to **GHCR** — GHCR stays the single source of truth; GCP pulls through an Artifact Registry remote (pull-through mirror), so no GCP build tooling is involved.

## Infrastructure

UAssist runs on a single Ubuntu 24.04 VM using **Docker Compose**. Long-lived containers (api, frontend, mongodb, worker-agent) are managed by Compose; tenant-worker containers are spawned and removed dynamically by the **worker-agent**, which the API calls over HTTP (`AGENT_URL`). On a single host the agent runs with `AUTH_DISABLED=true`; on GCP requests carry Google-signed OIDC ID tokens.

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

Two deploy jobs run after the builds, each gated by a repository variable:

| Job | Gate | Target |
|---|---|---|
| `deploy` | `vars.DEPLOY_HETZNER == 'true'` | SSH to the VM, compose pull/up |
| `deploy-gcp` | `vars.GCP_WIF_PROVIDER != ''` | `gcloud run deploy` by image digest + worker image refresh on the VM via IAP |

The Hetzner deploy job:

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

---

# GCP Deployment (Terraform)

```
                    Internet
                       │ HTTPS (*.run.app, managed TLS)
        ┌──────────────┴──────────────┐
        ▼                             ▼
┌─ Cloud Run ─────┐         ┌─ Cloud Run ─────┐
│ uassist-frontend│         │   uassist-api   │
└─────────────────┘         └────────┬────────┘
                                     │ direct VPC egress (10.10.1.0/26)
                       ┌─────────────┼──────────────┐
                       ▼ :8080 (OIDC)▼ :27017       │ VPC "uassist"
              ┌─ GCE VM (no external IP, 10.10.0.10) ─┐
              │  worker-agent ──► Docker              │
              │  mongodb (rs0)   tenant-worker-<id>…  │
              │  data disk: /mnt/disks/data (snapshots)│
              └────────────────────┬──────────────────┘
                                   │ Cloud NAT (egress only)
                                   ▼ WhatsApp / Signal / IMAP / Slack
```

Security posture:
- The VM has **no external IP**; SSH only via IAP; MongoDB and the worker-agent are reachable only from the API's egress subnet (firewall).
- The worker-agent verifies **Google-signed OIDC ID tokens** and only accepts the API's service account. The plaintext user data key never transits the network — the API sends the *encrypted* key and the agent decrypts via Cloud KMS.
- Envelope encryption uses **GCP Cloud KMS** (`KMS_KEY_NAME`); auth is via attached service accounts — no static cloud credentials anywhere.
- GitHub Actions deploys via **Workload Identity Federation** (no SA keys), restricted to this repository.
- Secrets live in **Secret Manager**; values never enter Terraform state.
- Note: the iptables GeoIP filter has no equivalent here (would require a load balancer + Cloud Armor); exposure control is TLS + auth + rate limiting.

## Bootstrap

```bash
# 0. One-time prerequisites
gcloud auth application-default login
gsutil mb -l europe-west3 gs://<your-tf-state-bucket>

# 1. Provision
cd infra
cp terraform.tfvars.example terraform.tfvars   # fill in project, repo, ghcr user
terraform init -backend-config="bucket=<your-tf-state-bucket>"
terraform apply

# 2. Add secret values (never via Terraform)
echo -n '<value>' | gcloud secrets versions add jwt-secret --data-file=-
# ...same for: admin-pass, mongo-root-password, mongo-api-password,
#    mongo-url, mongo-admin-url, smtp-user, smtp-pass, ghcr-pull-token
# mongo-url / mongo-admin-url shapes come from:
terraform output mongo_url_example

# 3. Set GitHub repository variables (values from `terraform output`)
#    GCP_WIF_PROVIDER, GCP_DEPLOY_SA, GCP_AR_PREFIX, GCP_REGION, GCP_ZONE,
#    GCP_NEXT_PUBLIC_API_URL (= api_url output)

# 4. Push to main → CI builds to GHCR and deploys to Cloud Run
```

The Cloud Run URLs are **deterministic** (`https://<service>-<project-number>.<region>.run.app`), so `NEXT_PUBLIC_API_URL` is known before the first deploy.

The `ghcr-pull-token` secret is a GitHub PAT with `read:packages` used by the Artifact Registry remote repository to pull from GHCR. **It expires** — rotate it or pulls fail silently.

## Cutover from Hetzner

1. Deploy code to Hetzner first and verify the worker-agent path still works (`AGENT_AUTH_DISABLED=true`).
2. Bring up GCP (bootstrap above).
3. Maintenance window:
   ```bash
   # on Hetzner: stop the api so no new writes/keys are created
   docker compose stop api frontend
   # re-encrypt user keys AWS KMS → Cloud KMS (idempotent, supports --dry-run)
   cd api && node ../scripts/migrate-kms.js
   # dump and restore Mongo to the GCP VM
   mongodump --uri "$MONGO_ADMIN_URL" --out dump/
   gcloud compute start-iap-tunnel uassist-vm 27017 --local-host-port=localhost:27017 &
   mongorestore --uri "mongodb://mongoadmin:<pass>@localhost:27017/?authSource=admin&directConnection=true" --drop dump/
   ```
4. Verify on the GCP URLs: login as an existing user (proves KMS migration), fresh signup, WhatsApp onboarding QR via SSE, message send/receive, `docker ps` on the VM shows tenant containers.
5. Set `DEPLOY_HETZNER` repo variable to `false`. Later: remove `@aws-sdk/client-kms` from api/ and worker-agent/.

## Operations

```bash
# SSH (via IAP, no public port)
gcloud compute ssh uassist-vm --zone europe-west3-a --tunnel-through-iap

# Logs
gcloud run services logs read uassist-api --region europe-west3
sudo docker logs uassist-worker-agent -f         # on the VM
sudo docker logs uassist-tenant-<tenantId> -f    # on the VM

# Restore the data disk from a snapshot
gcloud compute snapshots list --filter="sourceDisk:uassist-data"
# create a disk from the snapshot, detach uassist-data, attach the new disk
# as device-name "mongo-data", reboot the VM
```

Tenant state (WhatsApp Chromium session, signal-cli accounts) lives in Docker named volumes under the Docker data root, which is on the snapshotted data disk — VM recreation does not lose sessions as long as the data disk survives.
