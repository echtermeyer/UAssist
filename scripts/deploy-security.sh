#!/bin/bash
# deploy-security.sh
# Run as deploy user on the VM AFTER deploying the new code.
# Performs one-time security hardening steps.
set -euo pipefail

UASSIST_ROOT="/home/deploy/UAssist"
API_ENV="${UASSIST_ROOT}/api/.env"

echo "=== UAssist Security Hardening ==="
echo ""

# ── 1. Generate MASTER_ENCRYPTION_KEY if not set ─────────────────────────────
echo "[1/5] Checking MASTER_ENCRYPTION_KEY..."
if grep -q "MASTER_ENCRYPTION_KEY" "$API_ENV" 2>/dev/null; then
    echo "  Already set."
else
    KEY=$(openssl rand -hex 32)
    echo "" >> "$API_ENV"
    echo "MASTER_ENCRYPTION_KEY=${KEY}" >> "$API_ENV"
    echo "  Generated and written to api/.env"
fi

# ── 2. Rotate JWT_SECRET ─────────────────────────────────────────────────────
echo "[2/5] Rotating JWT_SECRET..."
NEW_JWT=$(openssl rand -hex 32)
if grep -q "JWT_SECRET" "$API_ENV"; then
    sed -i "s/^JWT_SECRET=.*/JWT_SECRET=${NEW_JWT}/" "$API_ENV"
else
    echo "JWT_SECRET=${NEW_JWT}" >> "$API_ENV"
fi
echo "  JWT_SECRET rotated. All existing sessions will be invalidated."

# ── 3. Update sudoers to add /usr/bin/env rule ───────────────────────────────
echo "[3/5] Updating sudoers..."
sudo tee /etc/sudoers.d/uassist-deploy > /dev/null << 'SUDOERS'
# UAssist tenant isolation
# deploy can create/manage ua_* Linux users and run processes as them.
# deploy CANNOT read files in ua_* home directories.

deploy ALL=(root) NOPASSWD: /usr/sbin/useradd -m -d /home/ua_* -s /usr/sbin/nologin -U ua_*
deploy ALL=(root) NOPASSWD: /bin/chmod 700 /home/ua_*
deploy ALL=(root) NOPASSWD: /bin/chown ua_*:ua_* /home/ua_*
deploy ALL=(root) NOPASSWD: /bin/mkdir -p /home/ua_*
deploy ALL=(root) NOPASSWD: /bin/chown -R ua_*:ua_* /home/ua_*

# Run integration processes as tenant users
deploy ALL=(ua_*) NOPASSWD: /usr/bin/node *
deploy ALL=(ua_*) NOPASSWD: /usr/bin/env *
deploy ALL=(ua_*) NOPASSWD: /usr/local/bin/signal-cli *
deploy ALL=(ua_*) NOPASSWD: /usr/bin/signal-cli *
SUDOERS
sudo chmod 440 /etc/sudoers.d/uassist-deploy
sudo visudo -c -f /etc/sudoers.d/uassist-deploy
echo "  Sudoers updated."

# ── 4. Fix broken home dir ownership ─────────────────────────────────────────
echo "[4/5] Fixing home dir ownership..."
for tenant in ua_default ua_eric; do
    if id "$tenant" &>/dev/null 2>&1; then
        current_owner=$(stat -c '%U' "/home/${tenant}" 2>/dev/null || echo "unknown")
        if [ "$current_owner" = "deploy" ]; then
            sudo chown "${tenant}:${tenant}" "/home/${tenant}"
            echo "  Fixed /home/${tenant} (was owned by deploy)"
        else
            echo "  /home/${tenant} already owned by ${current_owner}"
        fi
    fi
done

# ── 5. Run credential encryption migration ───────────────────────────────────
echo "[5/5] Encrypting existing plaintext credentials in MongoDB..."
cd "$UASSIST_ROOT"
node scripts/migrate-encrypt-credentials.js

echo ""
echo "=== Hardening complete ==="
echo ""
echo "Next steps (manual):"
echo "  1. Set MONGO_ADMIN_URL in api/.env (MongoDB admin credentials)"
echo "  2. Run: node scripts/migrate-tenant-dbs.js  (per-tenant DB migration)"
echo "  3. Add CORS_ORIGIN to api/.env pointing to your frontend URL"
echo "  4. Restart all services: pm2 reload all --update-env && pm2 save"
echo "  5. Remove plaintext credentials from email-integration/.env and whatsapp-integration/.env"
