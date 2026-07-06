# MAB UNITED — Client
# Copyright © 2026 IT.MAB. All Rights Reserved.

# ---------- Stage 1: build ----------
FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci --no-audit --no-fund

COPY . .

# Build-time API URL (will be baked into bundle)
ARG VITE_API_URL=http://localhost:5000
ENV VITE_API_URL=${VITE_API_URL}

RUN npm run build

# ---------- Stage 2: serve via Nginx ----------
FROM nginx:1.27-alpine AS runtime

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy compiled static files
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
