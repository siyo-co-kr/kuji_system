# ─────────────────────────────────────────────────────────────
# Backend Dockerfile
# ─────────────────────────────────────────────────────────────
FROM node:22-alpine
WORKDIR /app

RUN npm install -g pnpm

# Docker/CI 환경에서 pnpm이 TTY 없이 node_modules 재구성 시 자동 확인
ENV CI=true

# 의존성 파일 먼저 복사 (레이어 캐시 활용)
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/backend/package.json   ./apps/backend/
COPY packages/types/package.json ./packages/types/

# shamefully-hoist: pnpm이 npm처럼 flat 구조로 설치
# → Docker에서 심볼릭 링크 대신 실제 파일 경로로 패키지 접근 가능
RUN pnpm install --frozen-lockfile --shamefully-hoist

# 소스코드 복사
COPY tsconfig.base.json ./
COPY packages/types     ./packages/types
COPY apps/backend       ./apps/backend

# Prisma 클라이언트 생성 + TypeScript 빌드
WORKDIR /app/apps/backend
RUN pnpm exec prisma generate
RUN pnpm exec tsc -p tsconfig.json

ENV NODE_ENV=production
EXPOSE 4000

CMD ["node", "dist/index.js"]
