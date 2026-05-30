# ─────────────────────────────────────────────────────────────
# Display App Dockerfile (Vite SPA → nginx static)
# ─────────────────────────────────────────────────────────────

# ---- builder ----
FROM node:22-alpine AS builder
WORKDIR /app

RUN npm install -g pnpm
ENV CI=true

# VITE_* 변수는 빌드 시 번들에 삽입됨
ARG VITE_API_URL
ARG VITE_WS_URL
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_WS_URL=$VITE_WS_URL

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/display/package.json   ./apps/display/
COPY packages/types/package.json ./packages/types/

RUN pnpm install --frozen-lockfile --shamefully-hoist

COPY tsconfig.base.json ./
COPY packages/types     ./packages/types
COPY apps/display       ./apps/display

WORKDIR /app/apps/display
RUN pnpm exec vite build

# ---- runner ----
FROM nginx:alpine AS runner

COPY --from=builder /app/apps/display/dist /usr/share/nginx/html

# SPA 라우팅: /events/:id 직접 접속 시 index.html 반환
COPY apps/display/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
