#!/bin/bash
# Run this once on the VM as root: bash setup-vm.sh
set -e

MONGO_USER="uassist"
MONGO_PASSWORD=$(openssl rand -base64 24)

echo "==> Installing MongoDB..."
apt-get update -y
apt-get install -y gnupg curl
curl -fsSL https://www.mongodb.org/static/pgp/server-8.0.asc | gpg -o /usr/share/keyrings/mongodb-server-8.0.gpg --dearmor
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-8.0.gpg ] https://repo.mongodb.org/apt/ubuntu noble/mongodb-org/8.0 multiverse" | tee /etc/apt/sources.list.d/mongodb-org-8.0.list
apt-get update -y
apt-get install -y mongodb-org
systemctl enable mongod
systemctl start mongod

echo "==> Creating MongoDB user..."
mongosh uassist --eval "
  db.createUser({
    user: '$MONGO_USER',
    pwd: '$MONGO_PASSWORD',
    roles: [{ role: 'readWrite', db: 'uassist' }]
  })
"

echo "==> Writing .env files..."
for dir in whatsapp-integration email-integration; do
    env_file="/root/UAssist/$dir/.env"
    cat > "$env_file" <<EOF
MONGO_URL=mongodb://$MONGO_USER:$MONGO_PASSWORD@localhost:27017/uassist
EOF
    chmod 600 "$env_file"
done


echo "==> Installing noVNC + XFCE desktop..."
apt-get install -y xfce4 xfce4-goodies tightvncserver novnc websockify

echo "==> Setting up VNC for deploy user..."
sudo -u deploy bash -c '
    mkdir -p ~/.vnc
    echo "changeme" | vncpasswd -f > ~/.vnc/passwd
    chmod 600 ~/.vnc/passwd
    cat > ~/.vnc/xstartup <<XEOF
#!/bin/bash
xrdb $HOME/.Xresources
startxfce4 &
XEOF
    chmod +x ~/.vnc/xstartup
'

echo "==> Creating systemd service for VNC..."
cat > /etc/systemd/system/vncserver.service <<EOF
[Unit]
Description=VNC Server
After=network.target

[Service]
Type=forking
User=deploy
ExecStartPre=-/usr/bin/vncserver -kill :1
ExecStart=/usr/bin/vncserver :1 -geometry 1280x800 -depth 24
ExecStop=/usr/bin/vncserver -kill :1
Restart=on-failure

[Install]
WantedBy=multi-user.target
EOF

echo "==> Creating systemd service for noVNC..."
cat > /etc/systemd/system/novnc.service <<EOF
[Unit]
Description=noVNC Web Client
After=vncserver.service

[Service]
ExecStart=/usr/bin/websockify --web=/usr/share/novnc 6080 localhost:5901
Restart=on-failure

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable vncserver novnc
systemctl start vncserver novnc

echo ""
echo "======================================"
echo "Setup complete!"
echo ""
echo "MongoDB credentials (saved to .env files):"
echo "  User: $MONGO_USER"
echo "  Password: $MONGO_PASSWORD"
echo "  URL: mongodb://$MONGO_USER:$MONGO_PASSWORD@localhost:27017/uassist"
echo ""
echo "noVNC Desktop: http://<VM_IP>:6080/vnc.html"
echo "VNC password: changeme  <-- change this with: vncpasswd (as deploy user)"
echo "======================================"
