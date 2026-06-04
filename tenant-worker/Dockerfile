FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y \
    curl gnupg ca-certificates wget xdg-utils \
    fonts-liberation libgtk-3-0 libvulkan1 \
    libnspr4 libnss3 libatk1.0-0t64 libatk-bridge2.0-0t64 libcups2t64 \
    libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 \
    libgbm1 libasound2t64 libcairo2 libpango-1.0-0 \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && curl -fsSL https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb -o /tmp/chrome.deb \
    && apt-get install -y /tmp/chrome.deb \
    && rm /tmp/chrome.deb \
    && rm -rf /var/lib/apt/lists/*

ARG SIGNAL_VERSION=0.14.4.1
RUN curl -fsSL "https://github.com/AsamK/signal-cli/releases/download/v${SIGNAL_VERSION}/signal-cli-${SIGNAL_VERSION}-Linux-native.tar.gz" \
    | tar -xz -C /opt \
    && find /opt -name "signal-cli" -type f -exec ln -sf {} /usr/local/bin/signal-cli \;

WORKDIR /app

COPY package.json .
RUN npm install --production

COPY . .

VOLUME /home/tenant

ENV HOME=/home/tenant \
    CHROMIUM_PATH=/usr/bin/google-chrome \
    SIGNAL_CLI_PATH=/usr/local/bin/signal-cli

CMD ["node", "index.js"]
