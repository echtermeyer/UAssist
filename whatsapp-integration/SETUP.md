# Server Setup

## Install dependencies
```sh
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs git
npm install -g pm2
apt-get install -y libnspr4 libnss3 libatk1.0-0t64 libatk-bridge2.0-0t64 libcups2t64 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libasound2t64 libcairo2 libpango-1.0-0
```

## Clone & start
```sh
git clone https://github.com/echtermeyer/UAssist.git
cd UAssist/whatsapp-integration
npm install
pm2 start index.js --name uassist-wa
pm2 save
pm2 startup
```

## Update
```sh
git pull
pm2 restart uassist-wa
```

## PM2 commands
```sh
pm2 logs uassist-wa      # live logs (QR code appears here on first run)
pm2 status               # show all processes
pm2 stop uassist-wa
pm2 restart uassist-wa
```
