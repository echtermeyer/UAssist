#!/bin/bash
# Run this once on the VM as root: bash setup-vm.sh
set -e

DB_NAME="uassist"
DB_USER="uassist"
DB_PASSWORD=$(openssl rand -base64 24)

echo "==> Installing PostgreSQL..."
apt-get update -y
apt-get install -y postgresql postgresql-contrib

echo "==> Creating database and user..."
sudo -u postgres psql <<EOF
CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';
CREATE DATABASE $DB_NAME OWNER $DB_USER;
GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;
EOF

echo "==> Writing .env for the app..."
cat > /home/deploy/UAssist/whatsapp-integration/.env <<EOF
DB_HOST=localhost
DB_PORT=5432
DB_NAME=$DB_NAME
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASSWORD
EOF
chown deploy:deploy /home/deploy/UAssist/whatsapp-integration/.env
chmod 600 /home/deploy/UAssist/whatsapp-integration/.env

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
echo "PostgreSQL credentials (saved to .env):"
echo "  DB_NAME: $DB_NAME"
echo "  DB_USER: $DB_USER"
echo "  DB_PASSWORD: $DB_PASSWORD"
echo ""
echo "noVNC Desktop: http://<VM_IP>:6080/vnc.html"
echo "VNC password: changeme  <-- change this with: vncpasswd (as deploy user)"
echo "======================================"
