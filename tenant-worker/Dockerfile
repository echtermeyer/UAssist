FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y \
    curl gnupg ca-certificates \
    libnspr4 libnss3 libatk1.0-0t64 libatk-bridge2.0-0t64 libcups2t64 \
    libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 \
    libgbm1 libasound2t64 libcairo2 libpango-1.0-0 \
    openjdk-17-jre-headless \
    && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb -o /tmp/chrome.deb \
    && apt-get install -y /tmp/chrome.deb \
    && rm /tmp/chrome.deb \
    && rm -rf /var/lib/apt/lists/*

RUN SIGNAL_VERSION=$(curl -s https://api.github.com/repos/AsamK/signal-cli/releases/latest | grep '"tag_name"' | sed -E 's/.*"v([^"]+)".*/\1/') \
    && curl -fsSL "https://github.com/AsamK/signal-cli/releases/download/v${SIGNAL_VERSION}/signal-cli-${SIGNAL_VERSION}-Linux.tar.gz" \
    | tar -xz -C /opt \
    && ln -sf /opt/signal-cli-${SIGNAL_VERSION}/bin/signal-cli /usr/local/bin/signal-cli

WORKDIR /app

COPY package.json .
RUN npm install --production

COPY . .

VOLUME /home/tenant

ENV HOME=/home/tenant \
    CHROMIUM_PATH=/usr/bin/google-chrome \
    SIGNAL_CLI_PATH=/usr/local/bin/signal-cli

CMD ["node", "index.js"]
