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

COPY tsconfig.base.json ./
COPY packages/types ./packages/types
COPY apps/admin ./apps/admin

ENV NEXT_TELEMETRY_DISABLED=1

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
