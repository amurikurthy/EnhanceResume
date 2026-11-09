# EnhanceResume - web resume builder (Node 22 + Chromium for PDF export)
FROM node:22-bookworm-slim

ENV NODE_ENV=production \
    CHROME_PATH=/usr/bin/chromium \
    PORT=3000 \
    DATA_DIR=/data

RUN apt-get update \
 && apt-get install -y --no-install-recommends chromium ca-certificates tini \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY . .
RUN node scripts/build-assets.js \
 && mkdir -p /data && chown -R node:node /data /app

USER node
VOLUME /data
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/auth/me').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "--disable-warning=ExperimentalWarning", "server/index.js"]
