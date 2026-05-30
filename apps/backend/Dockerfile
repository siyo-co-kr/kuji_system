# ---- deps ----
FROM node:22-alpine AS deps
WORKDIR /app
RUN npm install -g pnpm

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/backend/package.json ./apps/backend/
COPY packages/types/package.json ./packages/types/

RUN pnpm install --frozen-lockfile --filter @kuji/backend...

# ---- builder ----
FROM deps AS builder
WORKDIR /app

COPY tsconfig.base.json ./
COPY packages/types ./packages/types
COPY apps/backend ./apps/backend

RUN pnpm --filter @kuji/backend run db:generate
RUN pnpm --filter @kuji/backend run build

# ---- runner ----
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup -S kuji && adduser -S kuji -G kuji

COPY --from=builder --chown=kuji:kuji /app/apps/backend/dist ./dist
COPY --from=builder --chown=kuji:kuji /app/apps/backend/prisma ./prisma
COPY --from=builder --chown=kuji:kuji /app/node_modules/.pnpm /node_modules/.pnpm
COPY --from=builder --chown=kuji:kuji /app/node_modules/@prisma /node_modules/@prisma
COPY --from=builder --chown=kuji:kuji /app/node_modules/@kuji /node_modules/@kuji
COPY --from=builder --chown=kuji:kuji /app/apps/backend/node_modules ./node_modules

USER kuji

EXPOSE 4000

CMD ["node", "dist/index.js"]
