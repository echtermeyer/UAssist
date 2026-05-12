#!/bin/bash
# setup-tenant-isolation.sh
# Run ONCE on the VM as root (or a user with unrestricted sudo).
# After this script:
#   - Each tenant gets their own Linux user (ua_<tenantId>) with chmod 700 home
#   - MongoDB authentication is enabled; each tenant gets their own DB user
#   - deploy user gets a minimal sudoers entry — cannot read tenant home dirs
#   - The default tenant is migrated to ua_default with their session data
#   - All message data is PURGED (fresh start); auth users are preserved

set -euo pipefail

MONGO_ADMIN_PASS="${MONGO_ADMIN_PASS:-$(openssl rand -hex 20)}"
MONGO_API_PASS="${MONGO_API_PASS:-$(openssl rand -hex 20)}"
UASSIST_ROOT="/home/deploy/UAssist"
ECOSYSTEM_PATH="/home/deploy/ecosystem.config.js"

echo "=== UAssist Tenant Isolation Setup ==="
echo ""

# ── 1. Sudoers drop-in ────────────────────────────────────────────────────────
echo "[1/6] Writing sudoers drop-in for deploy..."

cat > /etc/sudoers.d/uassist-deploy << 'SUDOERS'
# UAssist tenant isolation
# deploy can create/manage ua_* Linux users and run processes as them.
# deploy CANNOT read files in ua_* home directories.

deploy ALL=(root) NOPASSWD: /usr/sbin/useradd -m -d /home/ua_* -s /usr/sbin/nologin -U ua_*
deploy ALL=(root) NOPASSWD: /bin/chmod 700 /home/ua_*
deploy ALL=(root) NOPASSWD: /bin/chown ua_*\:ua_* /home/ua_*
deploy ALL=(root) NOPASSWD: /bin/mkdir -p /home/ua_*
deploy ALL=(root) NOPASSWD: /bin/chown -R ua_*\:ua_* /home/ua_*

# Run integration processes as tenant users
deploy ALL=(ua_*) NOPASSWD: /usr/bin/node *
deploy ALL=(ua_*) NOPASSWD: /usr/local/bin/signal-cli *
deploy ALL=(ua_*) NOPASSWD: /usr/bin/signal-cli *
SUDOERS

chmod 440 /etc/sudoers.d/uassist-deploy
visudo -c -f /etc/sudoers.d/uassist-deploy
echo "  Done."

# ── 2. Create ua_default Linux user and migrate session data ──────────────────
echo "[2/6] Creating ua_default Linux user and migrating session data..."

if ! id "ua_default" &>/dev/null; then
    useradd -m -d /home/ua_default -s /usr/sbin/nologin -U ua_default
fi
chmod 700 /home/ua_default
chown ua_default:ua_default /home/ua_default

# Migrate WhatsApp session
WA_OLD="/home/deploy/wa-sessions/session-default"
WA_NEW="/home/ua_default/wa-session"
mkdir -p "$WA_NEW"
if [ -d "$WA_OLD" ] && [ "$(ls -A $WA_OLD)" ]; then
    cp -r "$WA_OLD/." "$WA_NEW/"
    echo "  Migrated WA session → $WA_NEW"
else
    echo "  No existing WA session to migrate."
fi
chown -R ua_default:ua_default "$WA_NEW"

# Migrate Signal data
SIG_OLD="/home/deploy/.local/share/signal-cli"
SIG_NEW="/home/ua_default/.local/share/signal-cli"
mkdir -p "/home/ua_default/.local/share"
if [ -d "$SIG_OLD" ]; then
    cp -r "$SIG_OLD" "$SIG_NEW"
    echo "  Migrated Signal data → $SIG_NEW"
else
    echo "  No existing Signal data to migrate."
fi
chown -R ua_default:ua_default /home/ua_default/.local
echo "  Done."

# ── 3. Enable MongoDB authentication ─────────────────────────────────────────
echo "[3/6] Enabling MongoDB authentication..."

# First create the admin user while auth is still disabled
mongosh --quiet uassist --eval "
db.getSiblingDB('admin').createUser({
  user: 'mongoadmin',
  pwd: '$MONGO_ADMIN_PASS',
  roles: [{ role: 'userAdminAnyDatabase', db: 'admin' }, { role: 'readWriteAnyDatabase', db: 'admin' }]
});
" 2>/dev/null || echo "  (admin user may already exist — skipping)"

# Create the API service user (read/write on uassist db)
mongosh --quiet -u mongoadmin -p "$MONGO_ADMIN_PASS" --authenticationDatabase admin uassist --eval "
db.getSiblingDB('uassist').createUser({
  user: 'uassist_api',
  pwd: '$MONGO_API_PASS',
  roles: [{ role: 'readWrite', db: 'uassist' }]
});
" 2>/dev/null || echo "  (api user may already exist — skipping)"

# Enable auth in mongod config
if ! grep -q "^security:" /etc/mongod.conf; then
    echo "" >> /etc/mongod.conf
    echo "security:" >> /etc/mongod.conf
    echo "  authorization: enabled" >> /etc/mongod.conf
    echo "  Enabled MongoDB auth in /etc/mongod.conf"
else
    # Replace existing authorization line
    sed -i 's/authorization:.*/authorization: enabled/' /etc/mongod.conf
    echo "  MongoDB auth already configured."
fi

systemctl restart mongod
sleep 3
echo "  Done. MongoDB now requires authentication."

# ── 4. Purge all message data (keep users collection) ────────────────────────
echo "[4/6] Purging message data..."

mongosh --quiet -u mongoadmin -p "$MONGO_ADMIN_PASS" --authenticationDatabase admin uassist --eval "
db.whatsapp.drop();
db.email.drop();
db.signal.drop();
db.signal_contacts.drop();
db.whatsapp_outbox.drop();
db.onboarding.drop();
print('Collections dropped.');
"
echo "  Message data purged. User accounts preserved."

# ── 5. Update ecosystem.config.js to use ua_default uid and new Mongo URL ────
echo "[5/6] Updating ecosystem.config.js..."

# We use node to safely update the ecosystem config
node - "$MONGO_API_PASS" "$ECOSYSTEM_PATH" << 'NODE'
const fs = require('fs');
const apiPass = process.argv[1];
const ecosystemPath = process.argv[2];
const mongoUrl = `mongodb://uassist_api:${apiPass}@localhost:27017/uassist?authSource=uassist`;

delete require.cache[require.resolve(ecosystemPath)];
const config = require(ecosystemPath);

for (const app of config.apps) {
    if (app.env) {
        app.env.MONGO_URL = mongoUrl;
    }
    // Add uid for default tenant processes
    if (['uassist', 'email', 'signal'].includes(app.name)) {
        app.uid = 'ua_default';
        // Update WA_DATA_PATH for default tenant
        if (app.name === 'uassist' && app.env) {
            app.env.WA_DATA_PATH = '/home/ua_default';
        }
        // Update HOME for signal default tenant
        if (app.name === 'signal' && app.env) {
            app.env.HOME = '/home/ua_default';
        }
    }
}

fs.writeFileSync(ecosystemPath, `module.exports = ${JSON.stringify(config, null, 2)}\n`);
console.log('  ecosystem.config.js updated.');
NODE

# ── 6. Update API .env with new Mongo URL ────────────────────────────────────
echo "[6/6] Writing new MONGO_URL into ecosystem for API process..."

MONGO_URL_NEW="mongodb://uassist_api:${MONGO_API_PASS}@localhost:27017/uassist?authSource=uassist"
node - "$MONGO_API_PASS" "$ECOSYSTEM_PATH" << 'NODE'
const fs = require('fs');
const apiPass = process.argv[1];
const ecosystemPath = process.argv[2];
const mongoUrl = `mongodb://uassist_api:${apiPass}@localhost:27017/uassist?authSource=uassist`;

delete require.cache[require.resolve(ecosystemPath)];
const config = require(ecosystemPath);

const api = config.apps.find(a => a.name === 'api');
if (api && api.env) {
    api.env.MONGO_URL = mongoUrl;
}

fs.writeFileSync(ecosystemPath, `module.exports = ${JSON.stringify(config, null, 2)}\n`);
console.log('  API MONGO_URL updated.');
NODE

# Reload all pm2 processes
pm2 reload all --update-env
pm2 save

echo ""
echo "=== Setup complete ==="
echo ""
echo "IMPORTANT — save these credentials somewhere safe:"
echo "  MongoDB admin:      mongoadmin / $MONGO_ADMIN_PASS"
echo "  MongoDB API user:   uassist_api / $MONGO_API_PASS"
echo ""
echo "All message data has been purged. Users can reconnect their integrations."
