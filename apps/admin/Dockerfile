# ---- deps ----
FROM node:22-alpine AS deps
WORKDIR /app
RUN npm install -g pnpm

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/admin/package.json ./apps/admin/
COPY packages/types/package.json ./packages/types/

RUN pnpm install --frozen-lockfile --filter @kuji/admin...

# ---- builder ----
FROM deps AS builder
WORKDIR /app

# NEXT_PUBLIC_* 변수는 빌드 시점에 소스코드에 삽입되므로 ARG로 받아야 함
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_WS_URL

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL
ENV NEXT_TELEMETRY_DISABLED=1

COPY tsconfig.base.json ./
COPY packages/types ./packages/types
COPY apps/admin ./apps/admin

RUN pnpm --filter @kuji/admin run build

# ---- runner ----
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup -S kuji && adduser -S kuji -G kuji

COPY --from=builder --chown=kuji:kuji /app/apps/admin/public ./public
COPY --from=builder --chown=kuji:kuji /app/apps/admin/.next/standalone ./
COPY --from=builder --chown=kuji:kuji /app/apps/admin/.next/static ./.next/static

USER kuji

EXPOSE 3000

CMD ["node", "server.js"]
