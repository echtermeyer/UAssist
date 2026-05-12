# UAssist

A unified messaging platform for WhatsApp, Signal, and Email. Messages from all channels are stored in MongoDB, scoped per tenant. A REST API provides authentication, real-time streaming, and inbound/outbound messaging. A Next.js frontend lets users sign up, onboard their own accounts, and see messages stream in live.

---

## Architecture

```
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│   WhatsApp      │  │     Email        │  │     Signal      │
│  (whatsapp-     │  │  (email-         │  │  (signal-       │
│  integration)   │  │  integration)    │  │  integration)   │
└────────┬────────┘  └────────┬────────┘  └────────┬────────┘
         │                    │                     │
         └────────────────────┼─────────────────────┘
                              │
                         MongoDB
                      (uassist database)
               collections: whatsapp, email, signal
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

**pm2 processes (default tenant):**

| Process | Directory | Role |
|---|---|---|
| `uassist` | `whatsapp-integration/` | Receives WhatsApp messages, polls outbox to send |
| `email` | `email-integration/` | Receives emails via IMAP |
| `signal` | `signal-integration/` | Receives Signal messages via signal-cli |
| `api` | `api/` | REST API — auth, messages, send, onboarding, SSE stream |

Additional tenants get their own processes: `uassist_<tenantId>`, `email_<tenantId>`, `signal_<tenantId>`.

---

## Getting Started (your own machine)

```bash
git clone https://github.com/echtermeyer/UAssist
cd UAssist/frontend-app
echo "NEXT_PUBLIC_API_URL=http://<VM_IP>:3000" > .env.local
npm install
npm run dev
```

Open `http://localhost:3000`:

1. Click **Sign up** and create a username + password
2. In the **Integrations** panel, connect WhatsApp, Signal, and/or Email
3. Messages appear in the inbox in real time

---

## Services

### whatsapp-integration

Connects to WhatsApp Web via Puppeteer (whatsapp-web.js). Session is stored per tenant in `WA_DATA_PATH/session-<tenantId>/` — outside the repo, never committed.

- Inbound messages saved to the `whatsapp` collection with `tenantId`
- Outbound messages polled from `whatsapp_outbox` every 2s, filtered by `tenantId`
- Supports `WA_ONBOARD_MODE=1` for the onboarding flow: emits `QR:<base64png>` to stdout, exits after auth

**Env vars:**
```
MONGO_URL=mongodb://localhost:27017/uassist
TENANT_ID=default
WA_DATA_PATH=/home/deploy/wa-sessions
```

---

### email-integration

Connects to an email account via IMAP and listens for new messages (IDLE). Reads credentials from MongoDB `users` collection at startup (set during onboarding via the API) — credentials are never stored in ecosystem.config.js or env vars.

Falls back to `EMAIL`/`PASSWORD` env vars for the default tenant if no DB credentials are found.

Auto-detects the IMAP host from the email domain (Gmail, Outlook, GMX, Yahoo, or `imap.<domain>`).

**Env vars:**
```
MONGO_URL=mongodb://localhost:27017/uassist
TENANT_ID=default
# EMAIL and PASSWORD only needed for default tenant (legacy)
```

---

### signal-integration

Runs `signal-cli` in watch mode (`receive -t -1`). Syncs contacts before starting so incoming messages resolve to contact names.

**Requires signal-cli to be installed and linked as a secondary device (done via the onboarding flow in the UI).**

**Env vars:**
```
MONGO_URL=mongodb://localhost:27017/uassist
TENANT_ID=default
SIGNAL_CLI_PATH=/usr/local/bin/signal-cli
```

---

### api

Express REST API on port 3000. JWT-authenticated. All message data is scoped to the requesting user's `tenantId`. Admin users see all tenants.

**Env vars:**
```
MONGO_URL=mongodb://localhost:27017/uassist
JWT_SECRET=your-secret-here
ADMIN_PASS=changeme              # used only to seed the first admin user
SMTP_USER=your@email.com
SMTP_PASS=yourpassword
SIGNAL_CLI_PATH=/usr/local/bin/signal-cli
ECOSYSTEM_PATH=/home/deploy/ecosystem.config.js
UASSIST_ROOT=/home/deploy/UAssist
WA_DATA_PATH=/home/deploy/wa-sessions
```

#### Authentication

```
POST /auth/signup
Body: { "username": "alice", "password": "secret" }
→ { "token": "<jwt>", "tenantId": "alice", "role": "user" }
```

```
POST /auth/login
Body: { "username": "alice", "password": "secret" }
→ { "token": "<jwt>", "tenantId": "alice", "role": "user" }
```

```
POST /auth/register          # admin only — create users with explicit tenantId/role
Body: { "username": "bob", "password": "secret", "tenantId": "corp", "role": "user" }
```

All other endpoints require `Authorization: Bearer <token>`.

On first API startup, an `admin` user is seeded from `ADMIN_PASS`.

#### Messages

```
GET /messages                # all channels merged, newest first
GET /messages/whatsapp
GET /messages/email
GET /messages/signal
```

Returns up to 100 messages, filtered to the authenticated user's `tenantId`.

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
```

#### Onboarding

```
POST /onboard/whatsapp           # start WA onboarding — spawns temp client, generates QR
GET  /onboard/whatsapp/status    # poll → { status: "pending"|"connected", qr: "<base64png>" }

POST /onboard/signal             # start Signal onboarding — runs signal-cli link
GET  /onboard/signal/status      # poll → { status: "pending"|"linked", linkUri: "sgnl://..." }

POST /onboard/email
Body: { "email": "you@example.com", "password": "apppassword" }
# Stores credentials in MongoDB, provisions email pm2 process
```

#### Real-time stream

```
GET /stream
Authorization: Bearer <token>
Content-Type: text/event-stream
```

Server-Sent Events. Pushes new messages for the authenticated tenant as they arrive in MongoDB (change streams). Frontend falls back to 15s polling if SSE fails.

---

## Multi-Tenancy

Each user has a `tenantId` (auto-derived from username on signup). Every message is stamped with `tenantId` at ingestion. All API queries filter server-side — users cannot see other tenants' data.

**Session isolation:**
- WhatsApp: each tenant's Chromium session lives in `WA_DATA_PATH/session-<tenantId>/`
- Signal: each tenant's signal-cli account is a separate linked device
- Email credentials: stored in MongoDB `users` collection, not in ecosystem.config.js

**To add a tenant via the API (admin):**
```bash
TOKEN=$(curl -s -X POST http://<VM>:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"<pass>"}' | jq -r .token)

curl -X POST http://<VM>:3000/auth/register \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"username":"alice","password":"secret","tenantId":"alice"}'
```

Or simply have users sign up themselves at `POST /auth/signup`.

---

## VM Setup

The VM runs Ubuntu. One-time setup is handled by `setup-vm.sh`:

```bash
bash setup-vm.sh
```

Installs MongoDB, noVNC, XFCE desktop, and configures systemd services.

**Access the desktop:** `http://<VM_IP>:6080/vnc.html`

**Process management** via pm2. Ecosystem config at `/home/deploy/ecosystem.config.js`:

```bash
pm2 list
pm2 logs uassist
pm2 logs api
pm2 restart <name>
```

---

## Security

- Firewall (UFW): only ports 22 (SSH), 3000 (API), 6080 (noVNC) are open externally
- SSH: key-only auth, root login disabled, `deploy` user only, max 3 attempts
- Rate limiting: 5 SSH connections/60s, 30 API requests/60s per IP
- MongoDB: localhost only, not exposed externally
- JWT: all API endpoints except `/auth/login` and `/auth/signup` require a valid token
- Email passwords: stored in MongoDB, never in ecosystem.config.js or git

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
