# MongoDB — Quick Reference

## Connection

MongoDB listens on `localhost:27017` only. Authentication is required.

```
mongodb://uassist_api:<password>@localhost:27017/uassist?authSource=uassist
```

The password is set in `ecosystem.config.js` and `api/.env`. Both must match.

## Users

| User | DB | Roles | Used by |
|---|---|---|---|
| `mongoadmin` | `admin` | userAdminAnyDatabase, readWriteAnyDatabase | Manual admin tasks |
| `uassist_api` | `uassist` | readWrite | API and all integration processes |

## Collections

| Collection | Contents |
|---|---|
| `users` | User accounts, hashed passwords, email/Slack credentials, onboarding state |
| `whatsapp` | Inbound WhatsApp messages (tenantId-stamped) |
| `whatsapp_outbox` | Outbound WhatsApp jobs — polled every 2s by the WA process |
| `email` | Inbound emails (tenantId-stamped) |
| `signal` | Inbound Signal messages (tenantId-stamped) |
| `signal_contacts` | Signal contact list per tenant |
| `slack` | Inbound Slack messages (tenantId-stamped) |
| `onboarding` | Transient QR/link state during onboarding flows |

## Useful commands

```bash
# Connect as admin
mongosh -u mongoadmin -p <pass> --authenticationDatabase admin

# Connect as API user
mongosh "mongodb://uassist_api:<pass>@localhost:27017/uassist?authSource=uassist"

# View messages
mongosh uassist -u uassist_api -p <pass> --authenticationDatabase uassist \
  --eval "db.whatsapp.find().sort({_savedAt:-1}).limit(5).pretty()"

# View users (no passwords shown)
mongosh uassist -u uassist_api -p <pass> --authenticationDatabase uassist \
  --eval "db.users.find({},{password:0}).pretty()"

# Check onboarding state
mongosh uassist -u uassist_api -p <pass> --authenticationDatabase uassist \
  --eval "db.onboarding.find().pretty()"
```

## Re-enable auth after accidental disable

```bash
# Edit /etc/mongod.conf — ensure this block exists:
# security:
#   authorization: enabled

sudo systemctl restart mongod
```
