#!/bin/bash
# Run once as root on a fresh Ubuntu 24.04 VM.
set -e

echo "==> Installing Docker..."
apt-get update -y
apt-get install -y ca-certificates curl
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] \
  https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  | tee /etc/apt/sources.list.d/docker.list
apt-get update -y
apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

echo "==> Creating deploy user..."
id deploy &>/dev/null || useradd -m -s /bin/bash deploy
usermod -aG docker deploy

echo ""
echo "Bootstrap complete. Next steps:"
echo "  1. Add your SSH public key to /home/deploy/.ssh/authorized_keys"
echo "  2. As deploy: git clone <repo> /home/deploy/UAssist"
echo "  3. cp /home/deploy/UAssist/.env.example /home/deploy/UAssist/.env"
echo "  4. Edit .env and fill in all secrets"
echo "  5. cd /home/deploy/UAssist && docker compose up -d"
