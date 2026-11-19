FROM node:22-bookworm-slim@sha256:e9f565d32859f0cbfb52125eafe8be39390f24dac302dc3cdf566e8ba3ab21ee AS build
WORKDIR /build
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY . .
# Same-origin API: no provider key, host credential or patient data in the bundle.
ENV VITE_API_URL=/api
RUN npm run build:frontend

FROM nginx:stable-alpine@sha256:3bc3836dc0be3b811f238210360bf8e7ca8a2d0effdae46160bf1f3578710051
# nginx 1.30.7 (fixes CVE-2026-121810, -123007, -123633). Also apply Alpine security fixes released after the pinned digest (CI gates on fixable
# CRITICAL CVEs; Dependabot moves the digest forward weekly).
RUN apk upgrade --no-cache
COPY deploy/nginx.conf /etc/nginx/nginx.conf
COPY --from=build /build/dist /usr/share/nginx/html
USER nginx
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
CMD ["nginx", "-g", "daemon off;"]
