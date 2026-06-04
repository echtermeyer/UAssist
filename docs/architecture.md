# Architecture

## System Components

UAssist is composed of four runtime components:

```
┌────────────────────────────────────────────────────────────────┐
│                         VM (Ubuntu 24.04)                       │
│                                                                  │
│  ┌──────────────────┐       ┌──────────────────────────────┐   │
│  │  frontend-app    │       │            api               │   │
│  │  Next.js 15      │──────►│  Express · port 3000         │   │
│  │  React 19 + TS   │       │  JWT auth · rate limiting    │   │
│  │  port 3001       │       │  SSE streaming               │   │
│  └──────────────────┘       └──────────┬───────────────────┘   │
│                                         │                        │
│                              ┌──────────▼──────────┐            │
│                              │       MongoDB        │            │
│                              │  uassist (global)    │            │
│                              │  uassist_<tenantId>  │            │
│                              │  per user            │            │
│                              └──────────────────────┘            │
│                                                                  │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐       │
│  │ tenant-worker │  │ tenant-worker │  │ tenant-worker │       │
│  │  user-alice   │  │   user-bob    │  │   user-...    │       │
│  │ ─────────────│  │ ─────────────│  │ ─────────────│       │
│  │ WhatsApp      │  │ WhatsApp      │  │ WhatsApp      │       │
│  │ Signal        │  │ Signal        │  │ Signal        │       │
│  │ Email (IMAP)  │  │ Email (IMAP)  │  │ Email (IMAP)  │       │
│  │ Slack         │  │ Slack         │  │ Slack         │       │
│  └───────────────┘  └───────────────┘  └───────────────┘       │
└────────────────────────────────────────────────────────────────┘
```

### frontend-app

Next.js 15 app (React 19 + TypeScript). Serves the login/signup screen, onboarding carousel, and the main message dashboard. Communicates with the API via `fetch` (credentials in httpOnly cookie). Real-time updates use `EventSource` (SSE).

**Key pages:**
- `/` → redirects to onboarding intro or home depending on auth state
- `/onboarding` → intro carousel, signup/login form, channel connection steps
- `/home` → live message dashboard

### api

Express REST API. Handles auth, serves messages (with on-the-fly decryption), manages tenant-worker container lifecycle, and exposes an SSE endpoint for real-time push.

All endpoints except `/auth/login` and `/auth/signup` require a valid JWT in the `ua_token` cookie (or `Authorization: Bearer` header). Every database query is scoped to `{ tenantId }` — it is structurally impossible for the API to return another user's data.

### MongoDB

Two database tiers:

| Database | Purpose |
|---|---|
| `uassist` | Global: users collection, auth, onboarding state |
| `uassist_<tenantId>` | Per-tenant: all message collections for one user |

Provisioned automatically when a user signs up. Runs on localhost only, never exposed externally.

### tenant-worker

A Docker container per user, spawned by the API when a user completes onboarding for any channel. The container runs all four integrations (WhatsApp, Signal, Email, Slack) for that user, writing encrypted messages to the tenant's MongoDB database.

The container receives the user's AES-256 data key via environment variable (`USER_DATA_KEY`) — never written to disk.

---

## Data Flow

### Inbound message (e.g. WhatsApp)

```
WhatsApp servers
       │
       ▼
tenant-worker (Puppeteer / whatsapp-web.js)
       │  encrypt fields with USER_DATA_KEY (AES-256-GCM)
       ▼
MongoDB: uassist_<tenantId>.whatsapp
       │
       ▼  (change stream or 2s poll)
api /stream (SSE)
       │
       ▼
frontend EventSource → message appears in dashboard
```

### Outbound message

```
frontend POST /send/<service>
       │
       ▼
api → queue in uassist_<tenantId>.<service>_outbox
       │
       ▼  (tenant-worker polls outbox every 2s)
tenant-worker → sends via platform SDK
```

### Real-time streaming

The API opens a MongoDB change stream on the tenant's database. New documents trigger an SSE event to connected clients. On standalone MongoDB (no replica set), it falls back automatically to 2-second polling.

---

## Integrations

### WhatsApp

- **Library:** whatsapp-web.js (Puppeteer + Chrome)
- **Auth:** QR code scan during onboarding; session persisted in container volume
- **Onboarding:** API spawns a temporary container in QR mode, polls stdout for `QR:<base64>` lines, writes them to MongoDB; frontend polls `/onboard/whatsapp/status` every 2s to render the QR code
- **Outbox:** polled every 2s, sent via `client.sendMessage()`
- **Encrypted fields:** `body`, `from`, `to`, `_chat`, `author`

### Signal

- **CLI:** signal-cli 0.14.4.1 (baked into container image)
- **Auth:** Linked as secondary device via `signal-cli link`; account data persisted in container volume under `$HOME/.local/share/signal-cli/`
- **Onboarding:** API runs `signal-cli link`, captures the `sgnl://...` linking URI from stdout, frontend displays it as a QR code
- **Receiving:** `signal-cli receive -t -1` (blocking)
- **Contacts:** synced every 30s via `signal-cli listContacts`
- **Encrypted fields:** `message`

### Email

- **Library:** ImapFlow (IMAP4 with IDLE)
- **Auth:** Credentials stored encrypted in MongoDB, read at worker startup
- **Host detection:** Auto-detects from domain — Gmail (`imap.gmail.com`), Outlook (`outlook.office365.com`), GMX (`imap.gmx.net`), Yahoo (`imap.mail.yahoo.com`), or `imap.<domain>` as fallback
- **Receiving:** IMAP IDLE, wakes on `exists` event
- **Sending:** Nodemailer via GMX SMTP (`mail.gmx.net:587`)
- **Encrypted fields:** `bodyText`, `bodyHtml`

### Slack

- **Library:** @slack/bolt (Socket Mode)
- **Auth:** Bot token (`xoxb-...`) + App-level token (`xapp-...`), stored encrypted in MongoDB
- **Receiving:** `app.message()` event listener
- **Sending:** `app.client.chat.postMessage()`
- **Outbox:** polled every 2s
- **Encrypted fields:** `message`

---

## Database Schema

### Global DB (`uassist`)

**Collection: `users`**

```
{
  _id:              ObjectId,
  username:         string,          // phone number e.g. "+490151234567"
  displayName:      string,
  passwordHash:     string,          // bcrypt
  tenantId:         string,          // unique, derived from username
  role:             "user" | "admin",
  encryptedDataKey: string,          // base64, AWS KMS envelope-encrypted
  onboarding: {
    whatsapp: "pending" | "connected",
    signal:   "pending" | "linked",
    email:    "connected" | undefined,
    slack:    "connected" | undefined,
  },
  emailAddress?:    string,
  emailPassword?:   string,          // AES-256-GCM encrypted
  slackBotToken?:   string,          // AES-256-GCM encrypted
  slackAppToken?:   string,          // AES-256-GCM encrypted
  _createdAt:       Date,
}
```

### Per-Tenant DB (`uassist_<tenantId>`)

All documents include `tenantId` and `_savedAt`.

| Collection | Contents | Encrypted fields |
|---|---|---|
| `whatsapp` | Inbound WhatsApp messages | `body`, `from`, `to`, `_chat`, `author` |
| `whatsapp_outbox` | Pending outbound (TTL 7d) | — |
| `signal` | Inbound Signal messages | `message` |
| `signal_outbox` | Pending outbound (TTL 7d) | — |
| `signal_contacts` | Cached Signal contacts | — |
| `email` | Inbound emails | `bodyText`, `bodyHtml` |
| `slack` | Inbound Slack messages | `message` |
| `slack_outbox` | Pending outbound (TTL 7d) | — |
| `onboarding` | Transient QR / linking state | — |
| `profile_pics` | WhatsApp group avatars | — |
| `contact_pics` | WhatsApp contact avatars | — |

---

## API Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/auth/signup` | — | Create account + provision tenant DB |
| POST | `/auth/login` | — | Authenticate, set cookie |
| POST | `/auth/logout` | ✓ | Clear `ua_token` cookie |
| POST | `/auth/register` | ✓ admin | Create user with explicit tenantId |
| GET | `/auth/me` | ✓ | Current user + onboarding state |
| GET | `/messages` | ✓ | All channels merged, newest-first (max 100) |
| GET | `/messages/:service` | ✓ | Single channel (whatsapp/signal/email/slack) |
| GET | `/stream` | ✓ | SSE real-time push for new messages |
| POST | `/send/whatsapp` | ✓ | Queue outbound WhatsApp message |
| POST | `/send/signal` | ✓ | Send Signal message immediately |
| POST | `/send/email` | ✓ | Send email immediately |
| POST | `/send/slack` | ✓ | Send Slack message immediately |
| POST | `/onboard/whatsapp` | ✓ | Start WhatsApp QR onboarding |
| GET | `/onboard/whatsapp/status` | ✓ | Poll QR + connection status |
| POST | `/onboard/signal` | ✓ | Start Signal secondary-device linking |
| GET | `/onboard/signal/status` | ✓ | Poll linking URI + status |
| POST | `/onboard/email` | ✓ | Store IMAP credentials, start email worker |
| POST | `/onboard/slack` | ✓ | Store Slack tokens, start Slack worker |
| GET | `/onboard/slack/status` | ✓ | Onboarding state |

---

## Frontend

**Framework:** Next.js 15 · React 19 · TypeScript

**Auth:** JWT in `ua_token` httpOnly cookie. All `fetch` calls use `credentials: "include"`.

**Real-time:** `EventSource` connects to `/stream`. New message events trigger a prepend to the message list without a full re-fetch.

**Key library functions** (`src/lib/api.ts`):

```
login() / signup() / logout() / getMe()
fetchMessages(service?)
openStream(onMessage)
sendWhatsApp() / sendSignal() / sendEmail() / sendSlack()
startWhatsAppOnboard() / pollWhatsAppStatus()
startSignalOnboard() / pollSignalStatus()
connectEmail() / connectSlack()
```

**Onboarding UX:**
1. Intro carousel (3 slides)
2. Signup / login form (phone + password)
3. Per-channel connection steps (QR scanner, URI display, credential inputs)
