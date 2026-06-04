# Security

## Overview

UAssist applies defense in depth: encryption at rest for all message content, strict multi-tenant isolation at the database and process levels, JWT authentication with httpOnly cookies, rate limiting on auth endpoints, and GeoIP-based network filtering.

---

## Encryption at Rest

### Algorithm

All sensitive message fields are encrypted with **AES-256-GCM** (Galois/Counter Mode). GCM provides both confidentiality and authenticated integrity — decryption fails if ciphertext has been tampered with.

Each encrypted value is stored as `iv:authTag:ciphertext` (all hex-encoded).

### Envelope Encryption via AWS KMS

UAssist uses **envelope encryption** so the master key never leaves AWS:

```
AWS KMS (master key)
       │
       │  GenerateDataKey(AES_256)
       ▼
┌──────────────────────────────────────────┐
│  plaintext data key  (used in memory)    │ ──► encrypt/decrypt messages
│  encrypted data key  (stored in MongoDB) │ ──► users.encryptedDataKey
└──────────────────────────────────────────┘
```

**On signup:**
1. API calls `kms.GenerateDataKey` → receives plaintext key + KMS-encrypted key
2. Encrypted key is stored in `users.encryptedDataKey` (base64)
3. Plaintext key is passed to the tenant-worker container as `USER_DATA_KEY` env var — never written to disk

**On worker startup:**
1. API calls `kms.Decrypt(encryptedDataKey)` → recovers plaintext key
2. Passes it to the container; container uses it for all encrypt/decrypt operations
3. If KMS is unreachable, the worker cannot start (fail-closed)

**Key scope:** Each user has their own unique AES-256 data key. Compromise of one user's key does not affect any other user.

### Encrypted fields by channel

| Channel | Encrypted fields |
|---|---|
| WhatsApp | `body`, `from`, `to`, `_chat`, `author` |
| Signal | `message` |
| Email | `bodyText`, `bodyHtml` |
| Slack | `message` |
| User record | `emailPassword`, `slackBotToken`, `slackAppToken` |

Metadata fields (`_savedAt`, `envelope.subject`, `fromName`) are stored in plaintext for sorting and display purposes.

---

## Tenant Isolation

### Database isolation

Every user gets their own MongoDB database (`uassist_<tenantId>`). There is no shared collection that mixes data from multiple users.

All API queries also include an explicit `{ tenantId }` filter — even if the DB isolation were somehow bypassed, a query would still only return documents belonging to the requesting user.

The global `uassist` database holds only the `users` collection (auth + onboarding state). It is accessed by the API user (`uassist_api`) which has the minimum permissions required.

### Process isolation

Each user's integrations run inside a dedicated Docker container (`tenant-worker`). Containers:

- Are started and stopped by the API via the Docker daemon socket
- Receive the user's data key via environment variable (not mounted files)
- Have their own network namespace
- Persist session data (WhatsApp session, Signal account) in named Docker volumes scoped to the tenant
- Cannot read another tenant's volumes or environment

### Credential isolation

Email passwords and Slack tokens are:
1. Received over HTTPS at the `/onboard/*` endpoints
2. Immediately encrypted with the user's data key (AES-256-GCM)
3. Stored encrypted in MongoDB
4. Decrypted only inside the tenant-worker container at runtime

They are never logged, never written to disk in plaintext, and never appear in environment files or CI/CD secrets.

---

## Authentication

### Login mechanism

- **Identifier:** Phone number (e.g. `+491511234567`)
- **Secret:** Password (bcrypt, 12 rounds)
- **Session:** JWT (7-day expiry), signed with `JWT_SECRET`
- **Transport:** JWT stored in `ua_token` httpOnly, `Secure`, `SameSite=Strict` cookie — inaccessible to JavaScript

The httpOnly cookie prevents XSS attacks from exfiltrating the session token.

### Rate limiting

Auth endpoints are rate-limited to **10 requests per 15 minutes** per IP:

- `POST /auth/login`
- `POST /auth/signup`

Exceeding the limit returns `429 Too Many Requests`.

### Token validation

The API validates the JWT on every request (except signup/login). Expired, malformed, or tampered tokens are rejected with `401 Unauthorized`. The middleware extracts `tenantId` from the token payload and attaches it to the request — no DB lookup required per request.

### Admin role

A seeded admin user can call `POST /auth/register` to create additional users with explicit `tenantId` and `role`. All other admin-only endpoints require `role: "admin"` in the JWT payload.

---

## Network Security

### Firewall (UFW)

Only three ports are open externally:

| Port | Service |
|---|---|
| 22 | SSH (key-only, root disabled) |
| 3000 | API |
| 3001 | Frontend |

MongoDB (27017) and all other ports are blocked at the OS firewall level. MongoDB additionally binds to `127.0.0.1` only.

### GeoIP filtering

The API port (3000) is restricted to **German IP ranges** by default using `ipset` + iptables rules applied by `scripts/geoip-de.sh`. Traffic from other countries is dropped before it reaches the application layer.

The filter is applied as a block rule — all non-matching source IPs are silently dropped (not rejected). This reduces surface area for automated scanning.

### SSH hardening

- Key-only authentication (`PasswordAuthentication no`)
- Root login disabled (`PermitRootLogin no`)
- Only `deploy` user can SSH in (no shared accounts)
- Private key stored exclusively in GitHub Actions secrets

### MongoDB

- Binds to `127.0.0.1` only — not reachable from the network
- Authentication required: `mongoadmin` for admin operations, `uassist_api` for application queries
- `uassist_api` has `readWriteAnyDatabase` (needed for per-tenant DB provisioning) — this is intentional but could be scoped further by granting per-DB permissions as tenants are created

---

## CORS

The API allows cross-origin requests only from the origin specified in `CORS_ORIGIN`. In production this is set to the frontend's exact origin (e.g. `http://46.225.227.83:3001`). All other origins receive a CORS rejection.

---

## Known Limitations

- **No TLS on the VM.** Traffic between browser and VM is HTTP. A reverse proxy (e.g. nginx + Let's Encrypt) should be added before exposing to a wider audience.
- **MongoDB `readWriteAnyDatabase`.** The `uassist_api` MongoDB user needs broad DB permissions for tenant provisioning. Migrating to explicit per-DB grants after signup would reduce blast radius.
- **Docker socket access.** The API container mounts `/var/run/docker.sock` to manage tenant-worker containers. A Docker socket proxy (e.g. Tecnativa/docker-socket-proxy) would reduce the risk of container escape.
