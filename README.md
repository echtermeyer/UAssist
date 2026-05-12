# UAssist

A unified messaging platform for WhatsApp, Signal, Email, and Slack. Messages from all channels are stored in MongoDB, scoped per tenant. A REST API provides authentication, real-time streaming, and inbound/outbound messaging. A Next.js frontend lets users sign up, onboard their own accounts, and see messages stream in live.

---

## Architecture

```
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│   WhatsApp      │  │     Email        │  │     Signal      │  │     Slack       │
│  (whatsapp-     │  │  (email-         │  │  (signal-       │  │  (slack-        │
│  integration)   │  │  integration)    │  │  integration)   │  │  integration)   │
└────────┬────────┘  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘
         │                    │                     │                    │
         └────────────────────┼─────────────────────┼────────────────────┘
                              │
                         MongoDB (authenticated)
                      database: uassist
               collections: whatsapp, email, signal, slack
               all documents stamped with tenantId
                              │
                      ┌───────┴───────┐
                      │     API       │
                      │  (port 3000)  │
                      └───────────────┘
                              │
                      ┌───────┴───────┐
                      │   Frontend    │
                      │  (Next.js)    │
                      └───────────────┘
```

### pm2 processes

| Process | Directory | Role |
|---|---|---|
| `api` | `api/` | REST API — auth, messages, send, onboarding, SSE stream |
| `uassist_<tenantId>` | `whatsapp-integration/` | Receives WhatsApp messages, polls outbox to send |
| `email_<tenantId>` | `email-integration/` | Receives emails via IMAP |
| `signal_<tenantId>` | `signal-integration/` | Receives Signal messages via signal-cli |
| `slack_<tenantId>` | `slack-integration/` | Receives Slack messages via Socket Mode |

Each tenant gets their own set of processes. The default (legacy) tenant processes are named `uassist`, `email`, `signal` without a suffix.

---

## Getting Started (local frontend, remote API)

```bash
git clone https://github.com/echtermeyer/UAssist
cd UAssist/frontend-app
echo "NEXT_PUBLIC_API_URL=http://<VM_IP>:3000" > .env.local
npm install
npm run dev
```

Open `http://localhost:3000`:

1. Click **Sign up** and create a username + password
2. In the **Integrations** panel, expand WhatsApp or Signal and click **Generate QR code**
3. Scan with your phone — the integration is live once the QR is accepted
4. For Email: expand and enter your IMAP credentials (use an app password for Gmail/Outlook)
5. For Slack: enter a Bot Token and App Token
6. Messages appear in the inbox in real time

---

## Services

### whatsapp-integration

Connects to WhatsApp Web via Puppeteer (whatsapp-web.js). Google Chrome (`.deb`, not snap) must be installed on the VM — snap Chrome fails when launched from non-login processes.

Session data is stored per tenant in `$WA_DATA_PATH/session-<tenantId>/` under the tenant's Linux home directory.

**Two modes:**

- **Onboard mode** (`WA_ONBOARD_MODE=1`): spawned temporarily during setup. Emits `QR:<base64png>\n` to stdout for each QR refresh, then emits `READY:<tenantId>\n` once auth succeeds and exits. The API reads these lines and updates MongoDB.
- **Normal mode**: persistent pm2 process. Saves inbound messages to the `whatsapp` collection, polls `whatsapp_outbox` every 2s to send outbound messages.

**Env vars:**
```
MONGO_URL=mongodb://uassist_api:<pass>@localhost:27017/uassist?authSource=uassist
TENANT_ID=default
WA_DATA_PATH=/home/ua_default         # session written to $WA_DATA_PATH/session-<tenantId>/
CHROMIUM_PATH=/usr/bin/google-chrome  # must be .deb Chrome, not snap
```

---

### email-integration

Connects via IMAP (IDLE). Reads credentials from the MongoDB `users` collection at startup — set during onboarding via the API. Credentials are never stored in `ecosystem.config.js` or env vars.

Auto-detects IMAP host from email domain (Gmail, Outlook, GMX, Yahoo, or `imap.<domain>`).

**Env vars:**
```
MONGO_URL=mongodb://uassist_api:<pass>@localhost:27017/uassist?authSource=uassist
TENANT_ID=default
```

---

### signal-integration

Runs `signal-cli` in watch mode (`receive -t -1`). The Signal account must first be linked as a secondary device using the onboarding flow in the UI (`POST /onboard/signal`).

**Requires `signal-cli` installed on the VM** (e.g. `/usr/local/bin/signal-cli`).

**Env vars:**
```
MONGO_URL=mongodb://uassist_api:<pass>@localhost:27017/uassist?authSource=uassist
TENANT_ID=default
SIGNAL_CLI_PATH=/usr/local/bin/signal-cli
HOME=/home/ua_default   # signal-cli reads/writes $HOME/.local/share/signal-cli
```

---

### slack-integration

Connects via Slack Socket Mode. Tokens are read from the MongoDB `users` collection at startup.

**Env vars:**
```
MONGO_URL=mongodb://uassist_api:<pass>@localhost:27017/uassist?authSource=uassist
TENANT_ID=default
```

---

### api

Express REST API on port 3000. JWT-authenticated. All message data is scoped to the requesting user's `tenantId`. Admin users see all tenants.

**Env vars:**
```
MONGO_URL=mongodb://uassist_api:<pass>@localhost:27017/uassist?authSource=uassist
JWT_SECRET=your-secret-here
UASSIST_ROOT=/home/deploy/UAssist
ECOSYSTEM_PATH=/home/deploy/ecosystem.config.js
SIGNAL_CLI_PATH=/usr/local/bin/signal-cli
CHROMIUM_PATH=/usr/bin/google-chrome
```

#### Authentication

```
POST /auth/signup
Body: { "username": "alice", "password": "secret" }
→ 201 { "token": "<jwt>", "tenantId": "alice", "role": "user" }

POST /auth/login
Body: { "username": "alice", "password": "secret" }
→ 200 { "token": "<jwt>", "tenantId": "alice", "role": "user" }

POST /auth/register    # admin only — create users with explicit tenantId/role
Body: { "username": "bob", "password": "secret", "tenantId": "corp", "role": "user" }
```

All other endpoints require `Authorization: Bearer <token>`.

`tenantId` is auto-derived from username on signup (lowercased, spaces → underscores).

#### Messages

```
GET /messages                # all channels merged, newest first (up to 100)
GET /messages/whatsapp
GET /messages/email
GET /messages/signal
GET /messages/slack
```

Filtered server-side to the authenticated user's `tenantId`.

#### Send

```
POST /send/whatsapp
Body: { "to": "491234567890", "message": "Hello" }
→ 202 Accepted (queued in whatsapp_outbox)

POST /send/signal
Body: { "to": "+491234567890", "message": "Hello" }
→ 200 (sent immediately via signal-cli)

POST /send/email
Body: { "to": "someone@example.com", "subject": "Hello", "message": "Body" }
→ 200 (sent immediately via SMTP)

POST /send/slack
Body: { "to": "#channel-or-user", "message": "Hello" }
→ 200
```

#### Onboarding

```
POST /onboard/whatsapp           # start WA onboarding — spawns temp headless Chrome, generates QR
GET  /onboard/whatsapp/status    # poll → { status: "pending"|"connected", qr: "<base64png>"|null }

POST /onboard/signal             # start Signal onboarding — runs signal-cli link
GET  /onboard/signal/status      # poll → { status: "pending"|"linked", linkUri: "sgnl://..."|null }

POST /onboard/email
Body: { "email": "you@example.com", "password": "apppassword" }
→ stores credentials in MongoDB, provisions email pm2 process

POST /onboard/slack
Body: { "botToken": "xoxb-...", "appToken": "xapp-..." }
→ stores tokens in MongoDB, provisions slack pm2 process
```

When onboarding WhatsApp or Signal, the API:
1. Creates the tenant's Linux user (`ua_<tenantId>`) with a locked-down home directory if it doesn't exist
2. Spawns the integration script as that Linux user via `sudo -n -u ua_<tenantId> env ... node ...`
3. Polls stdout for `QR:` or `READY:` lines, writes them to the `onboarding` MongoDB collection
4. Frontend polls `/onboard/*/status` every 2s to show the QR code

#### Real-time stream

```
GET /stream
Authorization: Bearer <token>
```

Server-Sent Events. Pushes new messages for the authenticated tenant as they arrive.

Tries MongoDB change streams first (requires a replica set). Falls back automatically to 2-second polling on standalone MongoDB.

---

## Multi-tenancy and OS-level isolation

Every user gets a fully isolated environment:

**Data isolation in MongoDB:** Every document has a `tenantId` field. All API queries add `{ tenantId }` to every filter — it's impossible for one user to read another's messages through the API.

**Process isolation:** Each tenant's integration processes run as a dedicated Linux user `ua_<tenantId>`:
- Created by `ensureLinuxUser()` in `api/lib/pm2.js` before any process is spawned
- Home directory is `chmod 700` — the `deploy` user cannot read it
- WhatsApp session files, Signal account data, and config all live under `/home/ua_<tenantId>/`

**sudo isolation:** The `deploy` user has a narrow sudoers entry (`/etc/sudoers.d/uassist-deploy`) allowing only:
- `useradd` / `chmod` / `chown` on `/home/ua_*` paths
- Running `node` and `signal-cli` as `ua_*` users

**Why `env` after `sudo`:** sudo's `env_reset` strips all environment variables before executing the target command. Environment variables are therefore passed explicitly on the command line as `env KEY=VAL ...` after the sudo arguments — not via Node's `spawn({ env: ... })` option, which would be silently discarded.

---

## MongoDB authentication

MongoDB requires authentication. The API connects as the `uassist_api` user (read/write on the `uassist` database only). An `mongoadmin` superuser is used for administration.

The authenticated connection URL format is:
```
mongodb://uassist_api:<password>@localhost:27017/uassist?authSource=uassist
```

This URL is set in `ecosystem.config.js` and in `api/.env`. MongoDB itself only listens on `localhost` and is not exposed externally.

To set up MongoDB auth from scratch, see `setup-tenant-isolation.sh`.

---

## VM Setup

The VM runs Ubuntu 24.04. One-time setup:

```bash
# 1. Initial dependencies (MongoDB, noVNC, pm2, Node, signal-cli, etc.)
bash setup-vm.sh

# 2. Tenant isolation + MongoDB auth (run once as root or unrestricted sudo)
bash setup-tenant-isolation.sh
```

**`setup-tenant-isolation.sh` does:**
1. Writes `/etc/sudoers.d/uassist-deploy` — narrow sudo rules for `deploy`
2. Creates `ua_default` Linux user and migrates existing WA/Signal session data into their home
3. Enables MongoDB authentication, creates `mongoadmin` + `uassist_api` DB users
4. Purges all message collections (fresh start; user accounts are preserved)
5. Updates `ecosystem.config.js` with authenticated MONGO_URL for all processes

**Access the desktop:** `http://<VM_IP>:6080/vnc.html`

**Process management:**
```bash
pm2 list
pm2 logs api
pm2 logs uassist_<tenantId>
pm2 restart api
```

---

## Security

- **Firewall (UFW):** only ports 22 (SSH), 3000 (API), 6080 (noVNC) open externally
- **GeoIP allowlist:** only traffic from Europe, US, Canada, Australia, and New Zealand is allowed; Asia, Africa, and Russia are blocked (via `ipset` + iptables)
- **SSH:** key-only auth, root login disabled, `deploy` user only
- **MongoDB:** localhost only, authentication required, API user has minimum necessary permissions
- **JWT:** all API endpoints except `/auth/login` and `/auth/signup` require a valid token
- **OS-level tenant isolation:** each tenant runs as their own Linux user with a `chmod 700` home — tenants cannot access each other's session data even with shell access
- **Credentials:** email passwords and Slack tokens stored in MongoDB only, never in `ecosystem.config.js` or git

---

## Deployment

Every push to `main` triggers a GitHub Actions workflow (`.github/workflows/deploy.yml`) that:
1. SSHs into the VM
2. Runs `git pull`
3. Runs `npm install` in each service directory
4. Reloads each pm2 process with `--update-env`

**Required GitHub Secrets:**

| Secret | Value |
|---|---|
| `SSH_HOST` | VM IP address |
| `SSH_USER` | `deploy` |
| `SSH_PRIVATE_KEY` | Private key for the deploy user |
| `SSH_PORT` | `22` |

---

## Integration tests

Tests live in `api/test/integration.test.js` and use Node's built-in `node:test` runner (no extra dependencies). They run against a live API instance.

```bash
cd api
npm test
# or against a specific host:
API_URL=http://<VM_IP>:3000 node --test test/integration.test.js
```

**Coverage (26 tests):**
- Auth: signup, login, duplicate detection, password validation, JWT payload
- Auth middleware: token required, invalid token rejected, valid token accepted
- Messages: all channels return arrays, scoped to tenant
- Tenant isolation: separate tenantIds, no cross-tenant message leakage
- Send endpoints: input validation, unauthenticated requests rejected
- Onboarding status: auth required, returns `idle` for fresh users
- SSE stream: auth required, correct `text/event-stream` content type
