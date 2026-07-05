# 쿠지 시스템 스타일 가이드

프로젝트를 새로 만들 때 `admin`과 `display` 두 앱의 기존 스타일(디자인 시스템)을 그대로 재현하기 위한 참고 문서입니다.
로직/기능이 아니라 **스타일(색상, 컴포넌트, 레이아웃 패턴)**만 정리했습니다.

---

## 1. 공통 스택

- Tailwind CSS v4 (`@import "tailwindcss"` 방식, `tailwind.config.js` 없이 CSS 기반 설정)
- `clsx` + `tailwind-merge` 를 합친 `cn()` 헬퍼로 조건부 클래스 병합
  ```ts
  // lib/utils.ts
  import { clsx, type ClassValue } from 'clsx'
  import { twMerge } from 'tailwind-merge'

  export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
  }
  ```
- 아이콘: `lucide-react`
- 폰트: Pretendard (fallback: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif)
- 기본 톤: **admin = 라이트 테마**, **display = 다크 테마**로 두 앱이 완전히 대비되는 색 체계를 사용

---

## 2. Admin (관리자 웹) — 라이트 테마

### 2.1 기술 스택
- Next.js 16 (App Router), React 19
- Tailwind v4 + `shadcn`(style: `base-nova`, baseColor: `neutral`, cssVariables: true)
- `tw-animate-css` (애니메이션 유틸)
- `@base-ui/react` (Select 등 헤드리스 프리미티브 기반 컴포넌트)
- `zustand` (auth 등 상태), `sonner` (토스트), `axios`

### 2.2 globals.css
```css
@import "tailwindcss";
@import "tw-animate-css";
@import "shadcn/tailwind.css";

:root {
  --background: #f9fafb;
  --foreground: #111827;
}

body {
  background: var(--background);
  color: var(--foreground);
  font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

* { box-sizing: border-box; }
```

### 2.3 색상 팔레트
| 용도 | 클래스 |
|---|---|
| 페이지 배경 | `bg-gray-50` |
| 카드/패널 배경 | `bg-white` |
| 기본 텍스트 | `text-gray-900` |
| 보조 텍스트 | `text-gray-500` / `text-gray-400` |
| 테두리 | `border-gray-200` |
| Primary 액센트 | `indigo-600` (hover: `indigo-700`), 링/포커스: `ring-indigo-500` |
| 성공 | `green-500/600`, 배지 `bg-green-100 text-green-700` |
| 경고 | `amber-500/600`, 배지 `bg-amber-50` / `bg-yellow-100 text-yellow-700` |
| 위험 | `red-600`, 배지 `bg-red-100 text-red-700`, 에러 텍스트 `text-red-600 bg-red-50` |
| 정보 | `bg-blue-100 text-blue-700` |

기본 톤은 gray + indigo 두 축. 상태(성공/경고/위험/정보)만 green/amber/red/blue를 보조로 사용.

### 2.4 공용 UI 컴포넌트 (`components/ui/`)

**Button** — variant(`primary` indigo / `secondary` white+border / `danger` red / `ghost` transparent) × size(`sm` `md` `lg`). 공통: `rounded-lg`, `focus:ring-2 focus:ring-offset-2`, `disabled:opacity-50`. loading 시 인라인 SVG 스피너 표시.

**Card** — `Card` / `CardHeader` / `CardTitle` / `CardContent` 로 분리. 기본: `bg-white rounded-xl border border-gray-200 shadow-sm`. Header는 하단 border 구분선, Title은 `text-base font-semibold`.

**Badge** — `rounded-full text-xs font-medium px-2.5 py-0.5`. variant별 파스텔 배경(`*-100`) + 진한 텍스트(`*-700`) 조합.

**Input** — label + input + error 메시지를 세로로 쌓은 구조(`flex flex-col gap-1`). `rounded-lg border border-gray-300`, focus 시 `ring-2 ring-indigo-500`, 에러 시 `border-red-400 ring-red-500`.

**Select** — `@base-ui/react/select` 기반 headless 컴포넌트. 트리거는 `rounded-lg border`, 팝업은 `rounded-lg shadow-md ring-1 ring-foreground/10` + fade/zoom 애니메이션(data-open/data-closed).

**Table** — 기본 HTML 시맨틱 유지, `text-sm`, row hover `hover:bg-muted/50`, border는 row 하단(`border-b`)만.

**Modal** — 오버레이(`bg-black/50`) + 중앙 정렬 패널(`bg-white rounded-xl shadow-xl`). Esc 키로 닫기, 열릴 때 `onOpenChange` 콜백(데이터 초기 로드용) 지원. 헤더는 제목 + X 닫기 버튼.

### 2.5 레이아웃

**Sidebar** (`w-60`, `bg-white border-r border-gray-200`)
- 상단: 로고 영역(`Ticket` 아이콘 + "쿠지 어드민", 매장명 서브텍스트), 하단 border 구분
- 중단: nav 링크 목록. active 상태는 `bg-indigo-50 text-indigo-700`, 비활성은 `text-gray-600 hover:bg-gray-100`
- role 기반(superadmin vs admin) 메뉴 분기, superadmin 섹션은 상단에 `ShieldCheck` 아이콘 + uppercase 라벨(`text-indigo-400`) 구분선
- 하단: 계정 정보 + 매장정보수정/비밀번호변경/로그아웃 버튼 (동일 스타일: `rounded-lg text-gray-600 hover:bg-gray-100`)

**Dashboard layout**: 미승인 계정 배너(`bg-amber-50 border-amber-200`, `AlertTriangle` 아이콘) → `flex h-full`로 Sidebar + `main`(`flex-1 overflow-auto`) 배치. 미승인 시 컨텐츠에 `opacity-60 pointer-events-none`.

**로그인 페이지**: 중앙 정렬 카드형 (`min-h-screen flex items-center justify-center bg-gray-50`), 상단 로고 뱃지(`w-14 h-14 bg-indigo-600 rounded-2xl`), 폼 카드(`bg-white rounded-xl border shadow-sm p-6`).

**대시보드 콘텐츠**: `p-8 max-w-4xl space-y-8`. 섹션 제목은 `text-sm font-semibold text-gray-500 uppercase tracking-wider` + lucide 아이콘. 통계 카드는 그리드(`grid grid-cols-3/4 gap-4`)로 큰 숫자(`text-3xl font-bold`) + 라벨.

### 2.6 반복 패턴
- 아이콘 배지: `inline-flex items-center justify-center w-10 h-10 rounded-xl bg-{color}-50` + 안에 색상 아이콘
- 숫자는 `tabular-nums` 로 자릿수 정렬
- 로딩: `Loader2` (lucide) + `animate-spin text-indigo-600`
- 에러 메시지 박스: `text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2`

---

## 3. Display (매장 송출용 화면) — 다크 테마

### 3.1 기술 스택
- Vite + React 19, `@tailwindcss/vite` 플러그인 (config 파일 없이 Tailwind v4)
- `react-router-dom`, `zustand`, `axios`, `socket.io-client` (실시간 추첨 반영)

### 3.2 index.css
```css
@import "tailwindcss";

@layer utilities {
  .scrollbar-hide {
    scrollbar-width: none;
    -ms-overflow-style: none;
  }
  .scrollbar-hide::-webkit-scrollbar { display: none; }
}
```

### 3.3 색상 팔레트
| 용도 | 클래스 |
|---|---|
| 전체 배경 | `bg-gray-950` (최상위) / `bg-gray-900` (섹션) |
| 카드/박스 배경 | `bg-gray-800` (완료 상태는 `bg-gray-800/50 opacity-60`) |
| 기본 텍스트 | `text-white` |
| 보조 텍스트 | `text-gray-400` / `text-gray-500` / `text-gray-600` |
| 테두리 | `border-gray-800` / `border-gray-700` |
| Primary 액센트 | `indigo-400`~`indigo-700` (게이지 그라디언트: `from-indigo-700 to-indigo-400` 또는 `from-indigo-600 to-indigo-400`) |
| 진행중 상태 | `bg-green-500` + `animate-pulse` 점 |
| 경품/강조 번호 | `amber-500` 계열 (`bg-amber-500/20 text-amber-400 border-amber-500/50`) |
| 방금 추첨된 번호 | `bg-yellow-400 text-gray-900` + `scale-125 ring-2 ring-yellow-300 shadow-lg shadow-yellow-400/40` |
| 이미 추첨된 번호 | `bg-gray-800 text-gray-600 line-through` |
| 일반 번호 | `bg-indigo-500/10 text-indigo-300 border-indigo-500/20` |

라이트 테마의 gray-50/indigo-600 축과 대응되게, 다크 테마는 **gray-950/900/800 배경 + indigo-400 포인트 + amber/yellow(경품·강조)** 축을 사용.

### 3.4 컴포넌트 패턴

**진행률 게이지** (`GaugeDisplay`, `EventHeader`) — 얇은 바(`h-2` ~ `h-4`, `bg-gray-800 rounded-full overflow-hidden`) 안에 `bg-gradient-to-r from-indigo-700 to-indigo-400`가 `width: %` 로 채워지며 `transition-all duration-700`.

**통계 박스** — `bg-gray-800 rounded-xl` 안에 라벨(`text-xs text-gray-500`) + 큰 숫자(`text-xl~2xl font-bold tabular-nums`, 강조색은 `text-indigo-400`/`text-green-400`).

**번호 그리드** (`NumberGrid`) — 정사각형 칩(`w-10~11 h-10~11 rounded-lg font-bold`), 상태별 4단계 색(위 팔레트 표 참고), 상태 전환에 `transition-all duration-300`.

**경품 보드** (`PrizeBoard`) — 카드(`rounded-xl border border-gray-700 bg-gray-800 p-3`) + 썸네일(`w-12 h-12 rounded-lg`, 없으면 🎁 이모지) + 당첨 카운터 배지(진행중 `bg-green-500/20 text-green-400`, 일부 당첨 `bg-yellow-500/20 text-yellow-400`, 완료 `bg-gray-700 text-gray-500`) + 번호 목록(`font-mono` 칩).

**이벤트 헤더** — 썸네일 + 상태 배지(`draft`/`active`/`closed` → gray/green/gray, active는 pulse 점) + 보너스 배지(amber) + 제목/설명 + 우측 통계 패널 + 하단 진행바.

### 3.5 반복 패턴
- 숫자는 항상 `tabular-nums`
- 완료/비활성 상태는 공통적으로 `opacity-60` 또는 `line-through` + `text-gray-500`
- 강조가 필요한 순간(방금 당첨 등)에만 `scale-*`, `ring-*`, `shadow-*` 를 조합해 튐 효과

---

## 4. 새 프로젝트 적용 가이드

1. Tailwind v4를 CSS-only 설정으로 세팅(`@import "tailwindcss"`), config 파일 불필요.
2. `cn()` 헬퍼(clsx + tailwind-merge)를 공통 유틸로 먼저 만든다.
3. admin: `globals.css`에 `--background: #f9fafb`, `--foreground: #111827` 변수 정의 + Pretendard 폰트 지정. shadcn `base-nova` 스타일 재사용 여부는 새 프로젝트에서 shadcn을 다시 설치할지에 따라 결정.
4. display: 다크 배경(`bg-gray-950`)을 루트에 고정하고, 위 3.3 팔레트대로 상태별 색을 그대로 재사용.
5. 두 앱 모두 `lucide-react` 아이콘, `tabular-nums` 숫자 정렬, `rounded-lg`/`rounded-xl` 모서리, `transition-colors`/`transition-all duration-300~700` 트랜지션 관례를 유지.
