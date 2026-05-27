# 자체쿠지 시스템

이치방쿠지(一番くじ) 방식을 참고한 **자체 쿠지(복권) 운영 시스템**.  
1~N번 번호가 적힌 종이를 사용하여 소규모 굿즈샵·동인샵·팝업스토어에서 자체적으로 쿠지 이벤트를 운영할 수 있도록 지원한다.

---

## 서비스 구성

| 앱 | 설명 |
|----|------|
| **어드민 웹** | 매장 운영자가 쿠지 이벤트를 관리하는 웹페이지 |
| **태블릿 앱** | 매장 내 태블릿에서 손님이 직접 뽑기를 진행하는 앱 |

---

## 프로젝트 구조

```
kuji-system/
  ├── apps/
  │   ├── admin/        ← Next.js 어드민 웹
  │   ├── mobile/       ← React Native 태블릿 앱
  │   └── backend/      ← Fastify 백엔드
  └── packages/
      ├── types/        ← 공유 타입 (DB 스키마, API 타입)
      ├── ui/           ← 공유 컴포넌트
      └── config/       ← ESLint, TS 설정 공유
```

---

## 기술 스택

### 어드민 웹 (`apps/admin`)

| 항목 | 기술 |
|------|------|
| 프레임워크 | Next.js |
| UI | Tailwind CSS + shadcn/ui |
| 상태관리 | Zustand |

### 태블릿 앱 (`apps/mobile`)

| 항목 | 기술 |
|------|------|
| 프레임워크 | React Native (Expo) |
| UI | NativeWind |
| 실시간 통신 | Socket.io client |
| 현재 배포 | APK 직접 배포 (Android 전용) |
| 추후 배포 | Expo EAS → Google Play / App Store |

> iOS 확장을 고려하여 React Native (Expo) 채택. 현재는 Android 기준으로 개발.

### 백엔드 (`apps/backend`)

| 항목 | 기술 |
|------|------|
| 런타임 | Node.js + Fastify |
| 실시간 통신 | Socket.io |
| ORM | Prisma |

### DB / 인프라

| 항목 | 기술 |
|------|------|
| DB | PostgreSQL |
| 캐시 | Redis |
| 호스팅 | Supabase |

### 결제

| 항목 | 기술 |
|------|------|
| PG사 | 토스페이먼츠 (간편결제 + 카드) |
| 카드단말기 | 매장 단말기 제조사 확인 후 결정 |

### 전체 아키텍처

```
[Next.js 어드민 웹]
        ↕ REST API + Socket.io
  [Node.js + Fastify 백엔드]
        ↕ Prisma
  [PostgreSQL + Redis]
  (Supabase 호스팅)
        ↕ Socket.io
[React Native 태블릿 앱]
Android 기준 개발 / iOS 확장 고려
```

---

## 핵심 기능

### 어드민 웹 (매장용)

- 매장 계정 로그인 (매장당 어드민 계정 1개)
- 쿠지 이벤트 생성 / 수정 / 종료
  - 이벤트명, 설명
  - 전체 번호 수(N) 설정
  - 장당 가격 설정
  - 경품 등록 (이미지 + 경품명 + 당첨 번호 배정)
- 이벤트 현황 조회
  - 남은 번호 수 / 전체 번호 수
  - 남은 당첨 수 / 전체 당첨 수
  - 경품 리스트 (이미지 + 당첨 번호 + 뽑힘 여부)
- 수동 결제 승인 (Socket.io 실시간 반영)
- 다중 이벤트 동시 운영

### 태블릿 앱 (손님용)

#### 뽑기 플로우

```
[이벤트 선택]
      ↓
[번호 선택 화면]  ← 번호는 가려진 상태
  - 직접 선택 (터치)
  - 랜덤 선택 버튼
  - 여러 장 동시 선택 가능
      ↓
[결제하기 클릭]
      ↓
   ┌──┴──┐
[앱 내 결제]     [별도 결제]
[간편결제/카드]  [계좌이체/카드]
      ↓               ↓
      ↓        [어드민 확인 요청]
      ↓               ↓
      ↓        [어드민 승인 (실시간)]
      └──┬──┘
         ↓
  [번호 공개 + 당첨 여부 연출 🎉]
```

#### 현황 조회 (손님도 확인 가능)

- 남은 번호 수 / 전체 번호 수
- 남은 당첨 수 / 전체 당첨 수
- 경품 리스트 (이미지 + 당첨 번호 표시)

---

## DB 스키마

### Store (매장)

```sql
id            UUID  PK
name          VARCHAR     매장명
address       VARCHAR     매장 주소
phone         VARCHAR     매장 연락처
created_at    TIMESTAMP
updated_at    TIMESTAMP
```

### Account (어드민 계정)

```sql
id            UUID  PK
store_id      UUID  FK → Store
email         VARCHAR     UNIQUE
password_hash VARCHAR
role          ENUM        (superadmin, admin)
created_at    TIMESTAMP
```

### Event (쿠지 이벤트)

```sql
id            UUID  PK
store_id      UUID  FK → Store
title         VARCHAR     이벤트명
description   TEXT
total_count   INTEGER     전체 번호 수
price_per     INTEGER     장당 가격 (원)
status        ENUM        (draft, active, closed)
started_at    TIMESTAMP
ended_at      TIMESTAMP
created_at    TIMESTAMP
updated_at    TIMESTAMP
```

### KujiNumber (뽑기 번호)

```sql
id            UUID  PK
event_id      UUID  FK → Event
number        INTEGER     번호 (1~N)
is_prize      BOOLEAN     당첨 여부
is_drawn      BOOLEAN     뽑힘 여부 (default: false)
drawn_at      TIMESTAMP   뽑힌 시간
created_at    TIMESTAMP
UNIQUE (event_id, number)
```

### Prize (경품)

```sql
id            UUID  PK
event_id      UUID  FK → Event
name          VARCHAR     경품명
description   TEXT
quantity      INTEGER     수량
created_at    TIMESTAMP
updated_at    TIMESTAMP
```

### PrizeImage (경품 이미지)

```sql
id            UUID  PK
prize_id      UUID  FK → Prize
image_url     VARCHAR
order         INTEGER     이미지 순서
created_at    TIMESTAMP
```

### PrizeNumber (경품-번호 연결)

```sql
id              UUID  PK
prize_id        UUID  FK → Prize
kuji_number_id  UUID  FK → KujiNumber
UNIQUE (kuji_number_id)
```

### Payment (결제)

```sql
id                UUID  PK
event_id          UUID  FK → Event
store_id          UUID  FK → Store
total_amount      INTEGER     총 결제금액
method            ENUM        (app_simple, app_card, manual)
status            ENUM        (pending, confirmed, cancelled)
pg_transaction_id VARCHAR     PG사 거래ID (앱 결제 시)
requested_at      TIMESTAMP   결제 요청 시간
confirmed_at      TIMESTAMP   결제 확인 시간
confirmed_by      UUID  FK → Account (수동 결제 시 어드민)
created_at        TIMESTAMP
```

### PaymentNumber (결제-번호 연결)

```sql
id              UUID  PK
payment_id      UUID  FK → Payment
kuji_number_id  UUID  FK → KujiNumber
UNIQUE (kuji_number_id)
```

### ERD 구조

```
Store (매장)
  └── Account (어드민 계정)
  └── Event (쿠지 이벤트)
        └── KujiNumber (뽑기 번호)
              └── PrizeNumber (경품-번호 연결)
                    └── Prize (경품)
                          └── PrizeImage (경품 이미지)
        └── Payment (결제)
              └── PaymentNumber (결제-번호 연결)
```

### Redis 활용

```
event:{event_id}:remaining_numbers   → 남은 번호 Set
event:{event_id}:status              → 이벤트 상태 캐시
payment:{payment_id}:status          → 결제 대기 상태
session:{tablet_session_id}          → 태블릿 세션
```

---

## 개발 우선순위

```
1단계: 기반 세팅
  - 모노레포 구성 (pnpm workspace)
  - Supabase 프로젝트 생성 + Prisma 스키마 마이그레이션
  - 백엔드 기본 구조 (Fastify + Prisma + Socket.io)

2단계: 어드민 웹
  - 인증 (로그인/로그아웃)
  - 이벤트 CRUD
  - 경품 등록 (이미지 업로드 포함)
  - 현황 조회 화면
  - 수동 결제 승인 화면

3단계: 태블릿 앱
  - 이벤트 목록 / 선택
  - 번호 선택 UI (가려진 상태)
  - 랜덤 선택 기능
  - 여러 장 선택
  - 결제 플로우
  - 결과 공개 연출

4단계: 결제 연동
  - 토스페이먼츠 앱 내 결제
  - 수동 결제 승인 실시간 흐름
  - 카드단말기 연동 (제조사 확인 후)

5단계: 마무리
  - Android APK 빌드 / 배포
  - 안정화 및 테스트
```

---

## 추가 설계 필요 항목

- [ ] **API 설계** — REST API 엔드포인트 목록 (어드민 / 태블릿 / 공통)
- [ ] **Socket.io 이벤트 설계** — 실시간 통신 이벤트 명세
- [ ] **인증/보안 설계** — JWT 전략, 태블릿 세션 관리, 어드민 권한
- [ ] **파일 업로드 설계** — 경품 이미지 업로드 방식 (Supabase Storage 활용 예정)
- [ ] **결제 연동 상세 설계** — 토스페이먼츠 웹훅, 수동 결제 승인 흐름 상세
- [ ] **카드단말기 연동** — 매장 단말기 제조사 확인 후 결정
- [ ] **뽑기 연출 설계** — 당첨/비당첨 애니메이션 UX 상세
