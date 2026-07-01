# 자체쿠지 시스템 (Kuji System)

소규모 굿즈샵·동인샵·팝업스토어가 자체적으로 "이치방쿠지(一番くじ)" 방식의 추첨 이벤트를 운영할 수 있도록 만든 SaaS형 시스템입니다. 매장 어드민이 이벤트/경품을 등록하면, 매장에 설치된 태블릿·PC·TV가 실시간으로 추첨 현황을 보여주는 구조입니다.

pnpm workspace + Turborepo 기반 모노레포로, 백엔드 API 서버 1개와 프론트엔드 앱 2개(어드민 웹, 디스플레이 앱)로 구성되어 있습니다.

## 목차

- [핵심 기능](#핵심-기능)
- [시스템 구성](#시스템-구성)
- [기술 스택](#기술-스택)
- [기술적으로 신경 쓴 부분](#기술적으로-신경-쓴-부분)
- [데이터 모델](#데이터-모델)
- [API 개요](#api-개요)
- [프로젝트 구조](#프로젝트-구조)
- [실행 방법](#실행-방법)
- [배포](#배포)

## 핵심 기능

**어드민 (매장 운영자)**
- 이벤트(쿠지) 생성 — 총 수량, 회당 가격, 보너스 규칙, 경품 구성
- 온라인 모드(고객이 직접 뽑는 방식) / 오프라인 모드(매장에서 실물 뽑기 후 번호만 입력) 이원 지원
- 번호 수동 추첨(클릭 토글) 및 여러 번호 일괄 추첨(오프라인 뽑기 결과 한 번에 입력)
- 경품 등록(이미지 여러 장, 순서 지정) 및 매장 공용 경품 카탈로그(카테고리별 재사용)
- 매장 TV/키오스크에 띄울 디스플레이 레이아웃 구성 (2/3/4/6분할 멀티뷰 또는 단일뷰, 슬롯별 이벤트 매핑)
- 이벤트 소프트 삭제 + 대시보드(진행중/대기/종료 이벤트 수, 공지사항)

**슈퍼어드민 (플랫폼 운영자)**
- 매장 계정 가입 승인/반려, 매장(스토어) 목록 관리
- 계정별 임시 비밀번호 발급 및 이메일 발송(Nodemailer), 최초 로그인 시 비밀번호 변경 강제
- 전체 공지사항 작성/고정

**디스플레이 앱 (매장 TV·키오스크, 별도 SPA)**
- 로그인 후 매장에 배정된 슬롯 레이아웃을 그대로 렌더링
- Socket.io로 번호 추첨 결과, 이벤트 상태 변경, 레이아웃 변경을 실시간 반영 (새로고침 불필요)
- 잔여 수량 게이지, 경품 보드, 번호 그리드 등 매장 진열용 UI

## 시스템 구성

```
┌─────────────┐        REST(JWT)        ┌──────────────────┐
│  admin (웹)  │ ──────────────────────▶ │                  │
│  Next.js 16 │ ◀────── Socket.io ────── │  backend         │
└─────────────┘                         │  Fastify 5        │
                                         │  + Prisma 6       │
┌─────────────┐        REST(JWT)        │  + Socket.io 4    │
│ display (SPA)│ ─────────────────────▶ │  + Redis          │
│  Vite+React  │ ◀────── Socket.io ──── │                  │
└─────────────┘                         └────────┬─────────┘
                                                  │
                                        ┌─────────▼─────────┐
                                        │ PostgreSQL(Supabase)│
                                        │ + Supabase Storage │
                                        └────────────────────┘
```

프로덕션은 Docker Compose로 backend / admin / display / redis 4개 컨테이너를 띄우고, 앞단에 Nginx + Certbot(Let's Encrypt)으로 HTTPS 리버스 프록시를 구성합니다.

## 기술 스택

| 영역 | 스택 |
|---|---|
| 백엔드 | Fastify 5, Prisma 6, Socket.io 4, Redis, Zod, JWT(`@fastify/jwt`), bcryptjs, Nodemailer, Supabase Storage |
| 어드민 웹 | Next.js 16 (App Router), React 19, Tailwind CSS v4, Zustand, shadcn 기반 커스텀 UI, axios, socket.io-client |
| 디스플레이 앱 | Vite 6, React 19, React Router 7, Tailwind CSS v4, Zustand, socket.io-client |
| 공유 패키지 | `@kuji/types` — Event/Account/Socket 이벤트 등 도메인 타입을 백엔드·프론트가 공유 |
| 인프라 | pnpm workspace + Turborepo, Docker Compose, Nginx, Certbot, PostgreSQL(Supabase), Redis |

## 기술적으로 신경 쓴 부분

- **역할 기반 접근 제어**: JWT payload에 `storeId`/`role`(superadmin·admin)을 담아, REST 미들웨어(`requireAuth`/`requireSuperAdmin`)와 Socket.io 연결 시점(`socket.handshake.auth.token` 검증) 양쪽에서 동일한 토큰으로 권한을 검사합니다. 소켓의 `admin:join`도 자신의 `storeId`가 아니면 룸 입장을 거부합니다.
- **온라인/오프라인 하이브리드 추첨**: 오프라인 매장 뽑기(실물 제비뽑기)를 시스템에 반영하기 위해, 1~`maxNumber` 범위를 경품 번호 포함 1회 노출 후, 이후 사이클은 경품 번호를 제외하고 순환 생성하는 번호 생성 알고리즘을 구현했습니다 (`apps/backend/src/routes/events.ts`의 `generateOfflineNumbers`).
- **디스플레이 슬롯 배치 조회 최적화**: 멀티뷰(최대 6분할) 슬롯마다 이벤트/통계/번호를 개별 조회하면 슬롯 수에 비례해 쿼리가 늘어나는 문제(6분할 시 36쿼리)가 있어, 슬롯 수와 무관하게 항상 7개의 배치 쿼리로 끝나도록 재작성했습니다 (`apps/backend/src/routes/display-config.ts`).
- **실시간 동기화**: 번호 추첨/취소, 이벤트 상태 변경, 디스플레이 레이아웃 변경을 Socket.io room(`event:{id}`, `store:{id}`) 단위로 브로드캐스트하여 어드민에서의 조작이 디스플레이 앱에 즉시 반영되도록 했습니다.
- **소프트 삭제 + 가시성 분리**: 이벤트는 `deletedAt`으로 소프트 삭제하고, `isVisible` 플래그로 "존재하지만 고객에게 아직 비공개"인 상태를 별도로 관리해 공개 API(`/api/public`)에서 자연스럽게 필터링됩니다.
- **가입 승인 플로우**: 매장 계정은 슈퍼어드민 승인 전까지 로그인이 제한되며, 임시 비밀번호 발급 시 이메일 발송과 최초 로그인 강제 비밀번호 변경(`mustChangePassword`)을 연계했습니다.

## 데이터 모델

Prisma 스키마 기준 핵심 엔티티 (`apps/backend/prisma/schema.prisma`):

- `Store` — 매장. `Account`, `Event`, `PrizeCatalog`, `DisplayLayout`을 소유
- `Account` — 로그인 계정 (`role`: superadmin/admin, 가입 승인·비밀번호 변경 플래그 포함)
- `Event` — 쿠지 이벤트 (총 수량, 단가, 보너스 규칙, `mode`: online/offline, 상태: draft/active/closed, 소프트 삭제)
- `KujiNumber` — 이벤트에 속한 개별 추첨 번호 (당첨 여부, 추첨 여부/시각)
- `Prize` / `PrizeImage` / `PrizeNumber` — 경품, 경품 이미지, 경품-번호 매핑
- `PrizeCatalogCategory` / `PrizeCatalog` — 매장 공용 경품 카탈로그(이벤트 간 재사용)
- `DisplayLayout` / `DisplaySlot` — 매장별 디스플레이 분할(2/3/4/6) 및 슬롯-이벤트 매핑
- `Notice` — 공지사항 (상단 고정 가능)

## API 개요

Fastify 라우트 프리픽스 기준 (`apps/backend/src/app.ts`):

| Prefix | 설명 |
|---|---|
| `/api/auth` | 회원가입, 로그인, 내 정보, 프로필 수정, 비밀번호 변경 |
| `/api/events` | 이벤트 CRUD, 상태 변경, 번호 수동/일괄 추첨, 노출 설정, 소프트 삭제 |
| `/api/prizes` | 경품 CRUD, 경품 이미지 업로드 |
| `/api/prize-catalog` | 매장 공용 경품 카탈로그/카테고리 CRUD |
| `/api/display-config` | 디스플레이 레이아웃(슬롯 수, 뷰 모드, 슬롯-이벤트 매핑) 조회/수정 |
| `/api/stores` | 내 매장 정보 조회/수정 |
| `/api/notices` | 공지사항 조회, 슈퍼어드민 작성/수정/삭제 |
| `/api/dashboard` | 역할별 대시보드 요약 (이벤트/계정 통계, 공지) |
| `/api/superadmin` | 매장·계정 목록, 가입 승인/반려, 임시 비밀번호 발급 |
| `/api/upload` | 이미지 업로드 (Supabase Storage) |
| `/api/public` | 인증 없는 읽기 전용 API — 디스플레이 앱 전용 (공개 이벤트 목록/상세/통계/번호) |

### Socket.io 이벤트 (`@kuji/types`)

| 방향 | 이벤트 | 설명 |
|---|---|---|
| C → S | `event:join` / `event:leave` | 이벤트 룸 입장/퇴장 |
| C → S | `admin:join` | 매장 룸 입장 (본인 storeId 또는 superadmin만) |
| S → C | `number:drawn` | 번호 추첨/취소 결과 브로드캐스트 |
| S → C | `event:updated` / `event:closed` | 이벤트 상태 변경 |
| S → C | `display:config-updated` | 디스플레이 레이아웃 변경 |

## 프로젝트 구조

```
kuji_system/
├── apps/
│   ├── backend/     # Fastify + Prisma + Socket.io API 서버
│   │   ├── prisma/  # 스키마, 마이그레이션, 시드
│   │   └── src/
│   │       ├── routes/    # REST 라우트 (도메인별)
│   │       ├── socket/    # Socket.io 핸들러
│   │       └── plugins/   # auth, prisma, redis 플러그인
│   ├── admin/       # Next.js 16 어드민 웹
│   │   └── src/app/ # (auth) 로그인/가입, (dashboard) 이벤트/경품/디스플레이/슈퍼어드민
│   └── display/     # Vite + React 매장 디스플레이 SPA
│       └── src/      # 로그인, 이벤트 목록, 실시간 디스플레이 페이지
├── packages/
│   └── types/       # 백엔드·프론트 공유 도메인 타입 (@kuji/types)
├── nginx/           # 리버스 프록시 설정
├── certbot/         # Let's Encrypt 인증서
├── docker-compose.yml
└── turbo.json
```

## 실행 방법

```bash
# 의존성 설치
pnpm install

# 환경변수 설정 (.env.example 참고)
cp .env.example .env
cp apps/backend/.env.example apps/backend/.env

# DB 마이그레이션
pnpm --filter @kuji/backend db:migrate

# 전체 개발 서버 실행 (backend:4000, admin:3000, display:5173)
pnpm dev
```

## 배포

`docker-compose.yml` 기준 4개 컨테이너(redis, backend, admin, display)를 빌드/기동하며, 각 서비스는 `/health`(backend), `wget` 응답(admin/display) 기반 헬스체크 후 순차 기동됩니다. DB는 Supabase(PostgreSQL) 호스팅을 사용하고, Nginx가 도메인별로 admin/display/backend API를 라우팅하며 Certbot으로 인증서를 자동 갱신합니다.
