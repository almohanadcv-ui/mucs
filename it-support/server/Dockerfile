# MAB UNITED — Support System API
# Copyright © 2026 IT.MAB. All Rights Reserved.

# ---------- Stage 1: deps ----------
FROM node:20-alpine AS deps

WORKDIR /app

# Install only production deps (uses package-lock for reproducible builds)
COPY package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund

# ---------- Stage 2: runtime ----------
FROM node:20-alpine AS runtime

# Add non-root user for security
RUN addgroup -S app && adduser -S app -G app

# Useful runtime utilities (mysqldump for backup script)
RUN apk add --no-cache mysql-client tini

WORKDIR /app

# Copy installed node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy app source
COPY --chown=app:app . .

# Create persistent directories
RUN mkdir -p uploads logs backups && chown -R app:app uploads logs backups

USER app

ENV NODE_ENV=production
ENV PORT=5000

EXPOSE 5000

# tini is PID 1 — handles signals & zombie processes
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server.js"]

# Healthcheck — Docker uses this to know the container is alive
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:5000/api/health || exit 1
