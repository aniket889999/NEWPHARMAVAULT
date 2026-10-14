FROM node:22-bookworm-slim

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=5001
ENV DOCUMENT_STORAGE_ROOT=/var/lib/pharmavault/documents

COPY package*.json ./
RUN npm ci --omit=dev --engine-strict --no-audit --no-fund && npm cache clean --force

COPY --chown=node:node . .
RUN mkdir -p /var/lib/pharmavault/documents \
    && chown -R node:node /var/lib/pharmavault \
    && node -e "require('./data/academicMedicineCatalogue'); require('./services/trustRag/identityResolutionService'); import('pdf-to-img').then(() => console.log('Runtime dependencies verified.')).catch(() => process.exit(1))"

USER node
EXPOSE 5001

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:5001/api/ready', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "server.js"]
