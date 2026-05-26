# UAssist Security Migration

Living document. Update as phases complete. Each phase is independently deployable.

---

## Current State

Single Hetzner VM running:
- `api` (Node.js, pm2, user: `deploy`)
- `frontend` (Next.js, pm2, user: `deploy`)
- MongoDB (local, port 27017)
- Integration processes per tenant (pm2, per-tenant Linux users `ua_<tenantId>`)

**What is encrypted today:**
- `emailPassword`, `slackBotToken`, `slackAppToken`, `encryptedMongoUrl` in MongoDB — AES-256-GCM via `lib/crypto.js`

**What is plaintext today:**
- All messages in `uassist_<tenantId>` collections (`whatsapp`, `signal`, `email`, `slack`)
- `MASTER_ENCRYPTION_KEY` sitting in `.env` on disk — anyone with SSH reads it and decrypts everything
- `MONGO_ADMIN_URL` with admin credentials in `.env`
- `JWT_SECRET` in `.env`

**Root problem:** a single static key on disk protects all encrypted data. SSH access = full data access.

---

## Target Architecture

```
AWS KMS (eu-central-1)
└── CMK — never exported, all usage logged in CloudTrail

Hetzner App VM (public IP, CX32)
├── api (pm2)
├── frontend (pm2)
├── integration processes per tenant (pm2, ua_<tenantId> users)
└── IAM credentials → can call KMS encrypt/decrypt only

Hetzner DB VM (private IP only, CX22)
└── MongoDB — not reachable from the internet
    ├── uassist global DB
    │   ├── users collection  { ..., encryptedDek: <KMS-encrypted per-user key> }
    │   └── user_keys collection (alternative, same idea)
    └── uassist_<tenantId> per-tenant DBs
        ├── whatsapp   { content: <AES-ciphertext>, iv, tag, ... }
        ├── signal     { content: <AES-ciphertext>, iv, tag, ... }
        ├── email      { content: <AES-ciphertext>, iv, tag, ... }
        └── slack      { content: <AES-ciphertext>, iv, tag, ... }
```

**Key hierarchy (envelope encryption):**
```
KMS CMK
  └── encrypts/decrypts per-user DEK (32-byte AES key, stored in MongoDB)
        └── encrypts/decrypts everything for that user:
              - messages (all services)
              - emailPassword
              - slackBotToken / slackAppToken
              - tenantMongoUrl
```

**What this achieves:**
- DB dump → useless ciphertext, no keys present
- `.env` stolen → IAM credentials only have KMS permission, CloudTrail shows every decrypt
- Per-user isolation → compromise of one user's key doesn't affect others
- No plaintext master key on disk

---

## Phase 1 — AWS KMS Setup

*No application changes. No downtime. Pure infrastructure.*

### 1.1 Create AWS account and IAM user

1. Create an AWS account if you don't have one (aws.amazon.com)
2. In IAM, create a user named `uassist-kms` with **no console access**
3. Attach an inline policy (not a managed policy) — create a custom policy:
   ```
   Allow: kms:Encrypt, kms:Decrypt, kms:GenerateDataKey
   Resource: arn:aws:kms:eu-central-1:<account-id>:key/<key-id>  ← fill in after next step
   ```
4. Generate an access key for this user. Save `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` — you will add these to the VM `.env` later.

### 1.2 Create the KMS Customer Managed Key

1. Go to KMS → Customer managed keys → Create key
2. Key type: **Symmetric**, Key usage: **Encrypt and decrypt**
3. Region: **eu-central-1** (Frankfurt — same region as Hetzner for low latency)
4. Alias: `uassist-master`
5. Key administrators: your AWS console user (not `uassist-kms`)
6. Key users: `uassist-kms` IAM user
7. After creation, copy the **Key ARN** — you need it in the IAM policy from step 1.3 and in `.env`

### 1.3 Update the IAM policy

Go back to the `uassist-kms` user, edit the inline policy, replace the `Resource` wildcard with the actual Key ARN from step 1.2.

### 1.4 Enable CloudTrail (audit log)

1. Go to CloudTrail → Create trail
2. Name: `uassist-audit`
3. Storage: create a new S3 bucket `uassist-cloudtrail-logs`
4. Enable **KMS data events** so every encrypt/decrypt is logged
5. This is how you can prove to users no bulk decryption happened

### 1.5 Add KMS credentials to VM .env

SSH into the App VM and add to `/home/deploy/UAssist/api/.env`:
```
AWS_ACCESS_KEY_ID=<from step 1.1>
AWS_SECRET_ACCESS_KEY=<from step 1.1>
AWS_REGION=eu-central-1
KMS_KEY_ARN=arn:aws:kms:eu-central-1:<account-id>:key/<key-id>
```

Do **not** remove `MASTER_ENCRYPTION_KEY` yet — it's still needed until Phase 5.

### 1.6 Verify KMS works from the VM

From the VM, run a quick test:
```bash
node -e "
const { KMSClient, EncryptCommand, DecryptCommand } = require('@aws-sdk/client-kms');
const kms = new KMSClient({ region: 'eu-central-1' });
// encrypt 'hello' then decrypt it back — should print 'hello'
"
```
If this works, Phase 1 is done.

---

## Phase 2 — Hetzner DB VM + Private Network

*MongoDB moves to its own VM. App VM connects via private network. No application code changes.*

### 2.1 Create Hetzner private network

1. Hetzner Cloud Console → Networks → Create network
2. Name: `uassist-private`, IP range: `10.0.0.0/16`
3. Add subnet: `10.0.1.0/24`, zone: same as your existing VM

### 2.2 Attach existing App VM to the network

1. Cloud Console → your existing VM → Networking → Attach network `uassist-private`
2. Assign private IP: `10.0.1.10` (or let Hetzner assign it — note it down)
3. No reboot needed

### 2.3 Provision the DB VM

1. Create new server: **CX22** (2 vCPU, 4 GB RAM), same datacenter as App VM
2. OS: Ubuntu 24.04 (same as App VM)
3. Attach to `uassist-private` network, assign private IP `10.0.1.20`
4. **Do not add a public SSH key that your whole team has** — restrict access
5. Name it `uassist-db`

### 2.4 Harden DB VM

SSH into DB VM and run:
```bash
# No public MongoDB — block port 27017 from public internet
ufw allow ssh
ufw allow from 10.0.1.0/24 to any port 27017  # only App VM private network
ufw enable

# Disable root SSH password login
sed -i 's/PermitRootLogin yes/PermitRootLogin prohibit-password/' /etc/ssh/sshd_config
systemctl restart sshd
```

### 2.5 Install MongoDB on DB VM

```bash
# Standard MongoDB 7 install (Ubuntu 24.04)
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | gpg --dearmor -o /usr/share/keyrings/mongodb-server-7.0.gpg
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] \
  https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" \
  | tee /etc/apt/sources.list.d/mongodb-org-7.0.list
apt update && apt install -y mongodb-org
```

### 2.6 Configure MongoDB to bind to private IP only

Edit `/etc/mongod.conf` on DB VM:
```yaml
net:
  bindIp: 127.0.0.1,10.0.1.20   # localhost + private network IP only
  port: 27017
security:
  authorization: enabled
```

Start MongoDB: `systemctl enable --now mongod`

### 2.7 Create MongoDB users on DB VM

Connect to MongoDB on DB VM and recreate all users from the old VM:
- Admin user (`mongoadmin`)
- API user (`uassist_api`)
- Per-tenant users (`ua_<tenantId>`) — use the same passwords or new ones

Use **new, strong passwords** — these are different from the old VM.

The full list of existing tenants can be found by running on the old VM:
```bash
mongosh --eval "db.adminCommand('listDatabases')" | grep uassist_
```

### 2.8 Export data from old VM, import to DB VM

On App VM (old VM):
```bash
# Dump all uassist databases
mongodump --uri "mongodb://mongoadmin:<pass>@localhost:27017/admin?authSource=admin" \
  --out /tmp/mongo-backup

# Copy to DB VM over private network
scp -r /tmp/mongo-backup deploy@10.0.1.20:/tmp/
```

On DB VM:
```bash
mongorestore --uri "mongodb://mongoadmin:<pass>@10.0.1.20:27017/admin?authSource=admin" \
  /tmp/mongo-backup
```

Verify collections and document counts match.

### 2.9 Update App VM connection strings

Update `/home/deploy/UAssist/api/.env` on App VM:
```
MONGO_URL=mongodb://uassist_api:<new-pass>@10.0.1.20:27017/uassist?authSource=uassist
MONGO_ADMIN_URL=mongodb://mongoadmin:<new-pass>@10.0.1.20:27017/admin?authSource=admin
```

Restart api: `pm2 restart api`

Verify the app works correctly — check logs: `pm2 logs api --lines 50`

### 2.10 Disable MongoDB on App VM

Once verified:
```bash
systemctl stop mongod
systemctl disable mongod
```

MongoDB no longer runs on the App VM. DB VM is the only MongoDB.

---

## Phase 3 — Per-User Encryption Keys (DEK)

*Application change. No data migration yet. Additive — existing users unaffected until Phase 4/5.*

### 3.1 New key management module

Replace `api/lib/crypto.js` with a new version that:
- On **encrypt**: generates a random AES-256-GCM key, calls KMS to encrypt that key, stores the KMS-encrypted key alongside the ciphertext
- On **decrypt**: calls KMS to unwrap the key, then decrypts the ciphertext
- Exposes `generateUserDek()` which creates a new per-user key, returns `{ plaintextDek, encryptedDek }` where `encryptedDek` is what gets stored in MongoDB (KMS-encrypted)
- Exposes `encryptWithDek(plaintext, plaintextDek)` and `decryptWithDek(ciphertext, plaintextDek)`

The `plaintextDek` never touches disk — it lives in memory only.

### 3.2 Add `encryptedDek` field to user documents

At user signup (in `routes/auth.js`):
1. Call `generateUserDek()` — returns `{ plaintextDek, encryptedDek }`
2. Store `encryptedDek` in the user document in MongoDB
3. Discard `plaintextDek` immediately — it is not stored anywhere

To use a user's DEK at runtime:
1. Fetch the user document from MongoDB, get `encryptedDek`
2. Call KMS to decrypt it → get `plaintextDek` (in memory)
3. Use `plaintextDek` to encrypt/decrypt that user's data
4. `plaintextDek` is discarded after the request

### 3.3 Helper: `getUserDek(tenantId)` 

Add a convenience function to `lib/crypto.js`:
```
getUserDek(tenantId):
  1. Fetch user from MongoDB by tenantId
  2. KMS.decrypt(user.encryptedDek) → plaintextDek (Buffer, in memory)
  3. Return plaintextDek
```

This will be called from routes every time a request needs to read or write user data. KMS call is ~1-5ms over private network — negligible.

---

## Phase 4 — Message Encryption

*Data migration required. Plan for a maintenance window of ~10-30 min depending on message volume.*

### 4.1 Update write path (integration services)

Each integration service (`whatsapp-integration`, `signal-integration`, `email-integration`, `slack-integration`) writes messages to MongoDB. Update each one to:

Before saving a message document, encrypt the sensitive fields:
- `content` / `body` / `text` / whatever the message field is called per integration
- Any sender/recipient metadata you consider sensitive

Use `encryptWithDek(content, plaintextDek)` where the DEK is fetched at process startup (not per message — fetch once, hold in memory for the process lifetime).

The document stored in MongoDB becomes:
```json
{
  "_id": "...",
  "_savedAt": "...",
  "_service": "whatsapp",
  "content": { "iv": "...", "ciphertext": "...", "tag": "..." },
  "from": "...",
  "timestamp": "..."
}
```

Fields like `from`, `timestamp`, `_savedAt` can remain plaintext — they are metadata, not message content. Decide per integration what counts as sensitive.

### 4.2 Update read path (api/routes/messages.js)

When serving messages to the frontend:
1. Fetch encrypted documents from MongoDB (same as today)
2. Call `getUserDek(tenantId)` once per request
3. Decrypt each document's sensitive fields before returning JSON
4. Return plaintext JSON over HTTPS to the frontend (TLS protects in transit)

The frontend receives plaintext — nothing changes on the frontend side.

### 4.3 Migration script for existing messages

Create `scripts/migrate-encrypt-messages.js`:

```
For each tenant in the system:
  1. Get tenant's DEK via getUserDek(tenantId)
  2. For each service collection (whatsapp, signal, email, slack):
     For each document where content is not yet encrypted:
       a. Encrypt the content field with the tenant's DEK
       b. Update the document in MongoDB
       c. Log progress
  3. Log completion for tenant
```

Run this script during a maintenance window. It is idempotent — check `isEncrypted(doc.content)` before encrypting, skip already-encrypted documents.

Estimated time: depends on message volume. For <100k messages: under 5 minutes.

### 4.4 Verify

After migration:
- Read messages via the API — they should display normally in the frontend
- Open MongoDB shell on DB VM and read a raw document — content should be ciphertext
- Check that `isEncrypted(doc.content)` returns true for all documents

---

## Phase 5 — Credential Migration (Remove MASTER_ENCRYPTION_KEY)

*Migrates existing integration credentials from master-key encryption to per-user DEK encryption. Short maintenance window.*

### 5.1 Context

Currently `emailPassword`, `slackBotToken`, `slackAppToken`, `encryptedMongoUrl` in user documents are encrypted with `MASTER_ENCRYPTION_KEY` via the old `encrypt()`/`decrypt()` functions in `lib/crypto.js`.

After this phase they are encrypted with each user's DEK (which is itself KMS-encrypted). The old `MASTER_ENCRYPTION_KEY` can then be removed from `.env`.

### 5.2 Migration script

Create `scripts/migrate-credentials-to-dek.js`:

```
For each user document in uassist.users:
  1. Get user's plaintextDek via getUserDek(tenantId)
  2. For each encrypted credential field (emailPassword, slackBotToken, slackAppToken, encryptedMongoUrl):
     a. Decrypt with old MASTER_ENCRYPTION_KEY (old decrypt())
     b. Re-encrypt with user's plaintextDek (new encryptWithDek())
     c. Update field in user document
  3. Log completion
```

Run during maintenance window. Idempotent — detect old vs new encryption format by checking the ciphertext structure (the new format includes a `dek` reference or a version field; decide on a marker).

### 5.3 Update onboard routes to use DEK

After migration, update `routes/onboard.js`:
- `router.post('/email')`: instead of `encrypt(password)`, use `encryptWithDek(password, await getUserDek(tenantId))`
- `router.post('/slack')`: same for `botToken` and `appToken`
- `getTenantMongoUrl()`: decrypt with `decryptWithDek(user.encryptedMongoUrl, await getUserDek(tenantId))`

### 5.4 Remove MASTER_ENCRYPTION_KEY

Once migration script has run and all credentials are re-encrypted:
1. Remove `MASTER_ENCRYPTION_KEY` from `.env` on App VM
2. Remove the `getKey()` function and old `encrypt()`/`decrypt()` from `lib/crypto.js`
3. Restart api: `pm2 restart api`
4. Verify onboarding still works for a test user

There is now no static master key on disk anywhere. The only thing on disk is the AWS IAM access key, which has permission to call KMS — but every call is logged in CloudTrail.

---

## Phase 6 — Secret Rotation

*Rotate all secrets that existed before this migration. One-time, no downtime.*

### 6.1 JWT_SECRET

Generate a new secret:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Update in `.env`, restart api. All existing sessions are invalidated — users will need to log in again. This is acceptable.

### 6.2 MongoDB passwords

For each MongoDB user (admin + per-tenant users):
1. Generate a new random password
2. Update via `mongosh`: `db.updateUser('<user>', { pwd: '<new-pass>' })`
3. Update the corresponding connection string in `.env` or in MongoDB (for per-tenant urls stored as `encryptedMongoUrl`)

### 6.3 AWS IAM access key rotation

Every 90 days:
1. Create a new access key for `uassist-kms` in IAM
2. Update `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` in `.env`
3. Restart services: `pm2 restart all`
4. Delete the old access key in IAM

Set a calendar reminder.

### 6.4 SMTP credentials

If using real SMTP credentials (not mocked): rotate the email password and update `.env`. Test email delivery.

---

## Verification Checklist

Run through this after all phases complete:

- [ ] MongoDB on DB VM, no MongoDB running on App VM
- [ ] `ufw status` on DB VM: port 27017 only open to `10.0.1.0/24`
- [ ] No `MASTER_ENCRYPTION_KEY` in App VM `.env`
- [ ] `KMS_KEY_ARN` and IAM credentials present in `.env`
- [ ] CloudTrail active and logging KMS events
- [ ] Raw MongoDB document for a message shows ciphertext (not plaintext)
- [ ] Frontend displays messages correctly
- [ ] Integration onboarding (email, Slack) still works end-to-end
- [ ] User signup creates a `encryptedDek` field in the user document
- [ ] `pm2 status` shows all processes `online`
- [ ] `pm2 logs api` shows no errors on startup

---

## Residual Risks (Accepted)

- **SSH + root access during active request**: attacker could dump process memory and retrieve a plaintext DEK in flight. Mitigation: restrict SSH to ≤2 people, use SSH certificate auth not keys, keep access list reviewed.
- **Compromised AWS account**: attacker could call KMS using stolen IAM credentials. Mitigation: IAM policy is narrow (encrypt/decrypt on one key only), CloudTrail alerts on anomalous call volume.
- **KMS API call logging creates metadata**: AWS can see that decryption happened (but not the plaintext). Acceptable for this threat model.

These risks are accepted by virtually all companies that run server-side AI. They are not a reason not to ship.
