'use client'
import { useEffect, useState, useCallback } from 'react'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import { Button } from '@/components/ui/button'
import { Loader2, Monitor, Save, Layout, Tv } from 'lucide-react'
import type { Event } from '@kuji/types'

const SLOT_OPTIONS = [2, 3, 4, 6] as const
type ViewMode = 'multi' | 'single'

function getGridClass(slots: number) {
  switch (slots) {
    case 2: return 'grid-cols-2'
    case 3: return 'grid-cols-3'
    case 4: return 'grid-cols-2'
    case 6: return 'grid-cols-3'
    default: return 'grid-cols-2'
  }
}

/** 디스플레이 앱 베이스 URL */
function getDisplayBaseUrl() {
  if (typeof window === 'undefined') return ''
  const host = window.location.hostname
  return `http://${host}:5173`
}

export default function DisplaySettingsPage() {
  const { account } = useAuthStore()
  const [viewMode, setViewMode] = useState<ViewMode>('multi')
  const [slots, setSlots] = useState<number>(2)
  const [slotEvents, setSlotEvents] = useState<(string | null)[]>([null, null])
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const fetchData = useCallback(async () => {
    if (!account?.store.id) return
    const [configRes, eventsRes] = await Promise.all([
      api.get('/display-config'),
      api.get(`/events?storeId=${account.store.id}`),
    ])
    const config = configRes.data
    const validSlots = SLOT_OPTIONS.includes(config.slots) ? config.slots : 2
    setViewMode(config.viewMode ?? 'multi')
    setSlots(validSlots)
    const mapped = Array.from({ length: validSlots }, (_, i) =>
      config.slotData.find((s: { slotIndex: number; eventId: string | null }) => s.slotIndex === i)?.eventId ?? null
    )
    setSlotEvents(mapped)
    setEvents(eventsRes.data as Event[])
    setLoading(false)
  }, [account])

  useEffect(() => { fetchData() }, [fetchData])

  const handleSlotsChange = (count: number) => {
    setSlots(count)
    setSlotEvents((prev) => {
      const next = [...prev]
      while (next.length < count) next.push(null)
      return next.slice(0, count)
    })
  }

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode)
    if (mode === 'single') {
      // 싱글 모드는 슬롯 수를 이벤트 수 개념으로 사용
    }
  }

  const handleEventChange = (slotIndex: number, eventId: string) => {
    setSlotEvents((prev) => {
      const next = [...prev]
      next[slotIndex] = eventId || null
      return next
    })
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await api.patch('/display-config', {
        slots,
        viewMode,
        slotEvents: slotEvents.map((eventId, slotIndex) => ({ slotIndex, eventId })),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="animate-spin text-indigo-600" size={32} />
      </div>
    )
  }

  const displayBase = getDisplayBaseUrl()
  const eventMap = new Map(events.map((e) => [e.id, e]))

  return (
    <div className="p-8 max-w-4xl">
      {/* 헤더 */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Monitor size={22} className="text-indigo-600" />
            디스플레이 설정
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            저장 즉시 디스플레이 앱에 실시간 반영됩니다.
          </p>
        </div>
        <Button onClick={handleSave} loading={saving} className="gap-1.5">
          <Save size={15} />
          {saved ? '저장됨 ✓' : '저장 및 반영'}
        </Button>
      </div>

      {/* 보기 모드 선택 */}
      <div className="mb-8">
        <p className="text-sm font-semibold text-gray-700 mb-3">보기 모드</p>
        <div className="grid grid-cols-2 gap-4 max-w-xl">
          {/* 멀티뷰 */}
          <button onClick={() => handleViewModeChange('multi')}
            className={`flex flex-col gap-3 p-4 rounded-2xl border-2 text-left transition-all ${
              viewMode === 'multi'
                ? 'border-indigo-500 bg-indigo-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}>
            <div className="flex items-center gap-2">
              <Layout size={20} className={viewMode === 'multi' ? 'text-indigo-600' : 'text-gray-500'} />
              <span className="font-semibold text-sm">멀티뷰</span>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">
              1개 기기에서 여러 이벤트를 분할 화면으로 표시합니다.
              각 칸에 썸네일과 게이지 현황이 표시됩니다.
            </p>
            {/* 미니 미리보기 */}
            <div className="grid grid-cols-3 gap-1">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-5 bg-gray-200 rounded" />
              ))}
            </div>
          </button>

          {/* 싱글뷰 */}
          <button onClick={() => handleViewModeChange('single')}
            className={`flex flex-col gap-3 p-4 rounded-2xl border-2 text-left transition-all ${
              viewMode === 'single'
                ? 'border-indigo-500 bg-indigo-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}>
            <div className="flex items-center gap-2">
              <Tv size={20} className={viewMode === 'single' ? 'text-indigo-600' : 'text-gray-500'} />
              <span className="font-semibold text-sm">싱글뷰</span>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">
              기기 1대당 이벤트 1개를 표시합니다.
              좌측 썸네일·경품·게이지, 우측 번호 그리드 레이아웃입니다.
            </p>
            {/* 미니 미리보기 */}
            <div className="flex gap-1">
              <div className="w-1/3 h-10 bg-gray-200 rounded" />
              <div className="flex-1 h-10 bg-gray-200 rounded" />
            </div>
          </button>
        </div>
      </div>

      {/* ── 멀티뷰 설정 ── */}
      {viewMode === 'multi' && (
        <>
          <div className="mb-7">
            <p className="text-sm font-semibold text-gray-700 mb-3">화면 분할 수</p>
            <div className="flex gap-2">
              {SLOT_OPTIONS.map((n) => (
                <button key={n} onClick={() => handleSlotsChange(n)}
                  className={`w-14 h-12 rounded-xl font-bold text-lg transition-all ${
                    slots === n
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                      : 'bg-gray-100 text-gray-600 hover:bg-indigo-50 hover:text-indigo-600'
                  }`}>
                  {n}
                </button>
              ))}
              <span className="self-center text-sm text-gray-400 ml-1">분할</span>
            </div>
          </div>

          <div className="mb-6">
            <p className="text-sm font-semibold text-gray-700 mb-3">이벤트 배치</p>
            <div className={`grid ${getGridClass(slots)} gap-3`}>
              {Array.from({ length: slots }, (_, i) => (
                <div key={i} className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl p-4">
                  <p className="text-xs font-medium text-gray-400 mb-2">슬롯 {i + 1}</p>
                  <select value={slotEvents[i] ?? ''}
                    onChange={(e) => handleEventChange(i, e.target.value)}
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="">이벤트 없음</option>
                    {events.map((ev) => (
                      <option key={ev.id} value={ev.id}>
                        {ev.status === 'active' ? '▶ ' : '○ '}{ev.title}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs text-blue-600">
            <p className="font-semibold text-sm text-blue-700 mb-1">💡 멀티뷰 접속 URL</p>
            <code className="bg-blue-100 px-2 py-1 rounded">{displayBase}</code>
            <p className="mt-1">1개의 기기에서 위 주소로 접속하면 분할 화면이 표시됩니다.</p>
          </div>
        </>
      )}

      {/* ── 싱글뷰 설정 ── */}
      {viewMode === 'single' && (
        <>
          <div className="mb-6">
            <p className="text-sm font-semibold text-gray-700 mb-1">기기 수 / 이벤트 수</p>
            <p className="text-xs text-gray-500 mb-3">
              각 기기가 표시할 이벤트를 아래에서 지정하세요. 기기별 접속 URL이 자동 생성됩니다.
            </p>
            <div className="flex gap-2 mb-4">
              {SLOT_OPTIONS.map((n) => (
                <button key={n} onClick={() => handleSlotsChange(n)}
                  className={`w-14 h-12 rounded-xl font-bold text-lg transition-all ${
                    slots === n
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                      : 'bg-gray-100 text-gray-600 hover:bg-indigo-50 hover:text-indigo-600'
                  }`}>
                  {n}
                </button>
              ))}
              <span className="self-center text-sm text-gray-400 ml-1">대</span>
            </div>

            <div className="space-y-3">
              {Array.from({ length: slots }, (_, i) => {
                const ev = slotEvents[i] ? eventMap.get(slotEvents[i]!) : null
                return (
                  <div key={i} className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-7 h-7 bg-indigo-100 rounded-lg flex items-center justify-center text-xs font-bold text-indigo-600">
                        {i + 1}
                      </div>
                      <p className="text-sm font-medium text-gray-700">기기 {i + 1}</p>
                      <code className="ml-auto text-xs bg-white border border-gray-200 px-2 py-1 rounded text-gray-500">
                        {displayBase}/?slot={i}
                      </code>
                    </div>
                    <select value={slotEvents[i] ?? ''}
                      onChange={(e) => handleEventChange(i, e.target.value)}
                      className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                      <option value="">이벤트 없음</option>
                      {events.map((ev) => (
                        <option key={ev.id} value={ev.id}>
                          {ev.status === 'active' ? '▶ ' : '○ '}{ev.title}
                        </option>
                      ))}
                    </select>
                    {ev && (
                      <p className="text-xs mt-1.5 text-indigo-600">
                        {ev.status === 'active' ? '🟢 진행중' : '⚪ 준비중'} — {ev.title}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-700">
            <p className="font-semibold text-sm text-amber-800 mb-1">📺 싱글뷰 사용법</p>
            <ul className="space-y-1">
              <li>• 각 기기에서 해당 <strong>기기 URL</strong>로 접속하면 지정된 이벤트가 전체화면으로 표시됩니다</li>
              <li>• 좌측: 썸네일 · 경품 정보 · 게이지 현황</li>
              <li>• 우측: 번호 그리드 현황</li>
              <li>• 이벤트가 진행중(▶) 상태일 때만 실시간 데이터가 표시됩니다</li>
            </ul>
          </div>
        </>
      )}
    </div>
  )
}
