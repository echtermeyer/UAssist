# UAssist

A unified messaging ingestion and API layer for WhatsApp, Signal, and Email. Messages from all three channels are stored in MongoDB. A REST API allows retrieving messages and sending outbound messages across all channels.

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
                   ┌──────────┴──────────┐
              collections:         outbox:
              whatsapp              whatsapp_outbox
              email
              signal
                              │
                      ┌───────┴───────┐
                      │     API       │
                      │  (port 3000)  │
                      └───────────────┘
```

**4 pm2 processes run on the VM:**

| Process | Directory | Role |
|---|---|---|
| `uassist` | `whatsapp-integration/` | Receives WhatsApp messages, polls outbox to send |
| `email` | `email-integration/` | Receives emails via IMAP |
| `signal` | `signal-integration/` | Receives Signal messages via signal-cli |
| `api` | `api/` | REST API for reading and sending messages |

---

## Services

### whatsapp-integration
Connects to WhatsApp Web via Puppeteer (whatsapp-web.js). On first run, prints a QR code to the terminal — scan it with your phone under **Settings → Linked Devices → Link a Device**. Session is saved locally so subsequent restarts reconnect automatically.

Every incoming message is saved to the `whatsapp` MongoDB collection.

Every 2 seconds, polls the `whatsapp_outbox` collection for pending outbound messages and sends them.

**Env vars:**
```
MONGO_URL=mongodb://localhost:27017/uassist
```

---

### email-integration
Connects to an email account via IMAP and listens for new messages in real time (IDLE). Saves incoming emails to the `email` MongoDB collection including full body text and HTML.

Auto-detects the IMAP host from the email domain (supports Gmail, Outlook, GMX, Yahoo). Falls back to `imap.<domain>` for others.

**Env vars:**
```
MONGO_URL=mongodb://localhost:27017/uassist
EMAIL=your@email.com
PASSWORD=yourpassword
```

---

### signal-integration
Runs `signal-cli` in watch mode and saves incoming Signal messages to the `signal` MongoDB collection.

**Requires signal-cli to be installed and a phone number registered first:**
```bash
signal-cli -a +YOURPHONENUMBER register
signal-cli -a +YOURPHONENUMBER verify CODE
```

**Env vars:**
```
MONGO_URL=mongodb://localhost:27017/uassist
SIGNAL_PHONE=+YOURPHONENUMBER
```

---

### api
Express REST API on port 3000. Provides endpoints to read messages from all channels and send outbound messages.

**Env vars:**
```
MONGO_URL=mongodb://localhost:27017/uassist
SMTP_USER=your@email.com
SMTP_PASS=yourpassword
SIGNAL_PHONE=+YOURPHONENUMBER   # optional, required for Signal sending
```

#### Endpoints

**Read messages**
```
GET /messages
GET /messages/whatsapp
GET /messages/email
GET /messages/signal
```
Returns the 100 most recent messages from the requested channel(s), sorted newest first.

**Send messages**
```
POST /send/whatsapp
Body: { "to": "491234567890", "message": "Hello" }
```
Queues the message in MongoDB. The whatsapp process picks it up within 2 seconds. Returns `202 Accepted`.

```
POST /send/signal
Body: { "to": "+491234567890", "message": "Hello" }
```
Sends immediately via signal-cli. Returns `200` on success.

```
POST /send/email
Body: { "to": "someone@example.com", "subject": "Hello", "message": "Body text" }
```
Sends immediately via SMTP. Returns `200` on success.

---

## VM Setup

The VM runs Ubuntu. One-time setup is handled by `setup-vm.sh`:

```bash
bash setup-vm.sh
```

This installs MongoDB, noVNC, XFCE desktop, and configures systemd services.

**Access the desktop:** `http://<VM_IP>:6080/vnc.html`

**Process management** is via pm2 with an ecosystem config at `/home/deploy/ecosystem.config.js`. On the VM:

```bash
pm2 list              # see all 4 processes
pm2 logs uassist      # tail WhatsApp logs
pm2 logs email        # tail email logs
pm2 logs signal       # tail Signal logs
pm2 logs api          # tail API logs
pm2 restart <name>    # restart a process
```

---

## Deployment

Every push to `main` triggers a GitHub Actions workflow (`.github/workflows/deploy.yml`) that:
1. SSHs into the VM
2. Runs `git pull`
3. Runs `npm install` in each service directory
4. Reloads each pm2 process gracefully (no downtime, no WhatsApp re-auth)

**Required GitHub Secrets:**

| Secret | Value |
|---|---|
| `SSH_HOST` | VM IP address |
| `SSH_USER` | `deploy` |
| `SSH_PRIVATE_KEY` | Private key for the deploy user |
| `SSH_PORT` | `22` |
