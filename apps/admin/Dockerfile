# ─────────────────────────────────────────────────────────────
# Admin (Next.js standalone) Dockerfile
# ─────────────────────────────────────────────────────────────

# ---- builder ----
FROM node:22-alpine AS builder
WORKDIR /app

RUN npm install -g pnpm

# Docker/CI 환경에서 pnpm TTY 확인 프롬프트 자동 건너뜀
ENV CI=true

ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_WS_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL
ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/admin/package.json     ./apps/admin/
COPY packages/types/package.json ./packages/types/

RUN pnpm install --frozen-lockfile --shamefully-hoist

COPY tsconfig.base.json ./
COPY packages/types     ./packages/types
COPY apps/admin         ./apps/admin

WORKDIR /app/apps/admin
RUN pnpm exec next build

# ---- runner ----
# Next.js standalone 출력에 node_modules 포함되므로 추가 설치 불필요
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup -S kuji && adduser -S kuji -G kuji

COPY --from=builder --chown=kuji:kuji /app/apps/admin/public           ./public
COPY --from=builder --chown=kuji:kuji /app/apps/admin/.next/standalone ./

# 모노레포 구조: server.js는 /app/apps/admin/server.js 위치
# → static 파일은 /app/apps/admin/.next/static 에 있어야 함
COPY --from=builder --chown=kuji:kuji /app/apps/admin/.next/static     ./apps/admin/.next/static

USER kuji
EXPOSE 3000

# 모노레포 구조: standalone 서버 파일은 apps/admin/ 하위에 위치
CMD ["node", "apps/admin/server.js"]
