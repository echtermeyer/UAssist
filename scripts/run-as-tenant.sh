#!/bin/bash
# Wrapper for pm2 to re-exec a Node script as a tenant Linux user.
# pm2 env vars are forwarded explicitly through sudo (which resets env by default).
# Set TENANT_USER and MAIN_SCRIPT in the pm2 process env; all other vars are forwarded.
set -euo pipefail

TENANT_USER="${TENANT_USER:?TENANT_USER env var required}"
MAIN_SCRIPT="${MAIN_SCRIPT:?MAIN_SCRIPT env var required}"

FORWARD=("HOME=/home/${TENANT_USER}")
for var in MONGO_URL TENANT_ID EMAIL EMAIL_PASSWORD SLACK_BOT_TOKEN SLACK_APP_TOKEN \
           SIGNAL_PHONE SIGNAL_CLI_PATH WA_DATA_PATH CHROMIUM_PATH; do
    [[ -n "${!var:-}" ]] && FORWARD+=("${var}=${!var}")
done

exec sudo -n -u "$TENANT_USER" /usr/bin/env "${FORWARD[@]}" /usr/bin/node "$MAIN_SCRIPT"
