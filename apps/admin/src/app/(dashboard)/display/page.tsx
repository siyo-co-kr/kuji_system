'use client'
import { useEffect, useState, useCallback } from 'react'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import { Button } from '@/components/ui/button'
import { Loader2, Monitor, Save, Hash, Activity } from 'lucide-react'
import type { Event } from '@kuji/types'

const SLOT_OPTIONS = [2, 3, 4, 6] as const
type DisplayMode = 'grid' | 'gauge'

function getGridClass(slots: number) {
  switch (slots) {
    case 2: return 'grid-cols-2'
    case 3: return 'grid-cols-3'
    case 4: return 'grid-cols-2'
    case 6: return 'grid-cols-3'
    default: return 'grid-cols-2'
  }
}

export default function DisplaySettingsPage() {
  const { account } = useAuthStore()
  const [slots, setSlots] = useState<number>(2)
  const [displayMode, setDisplayMode] = useState<DisplayMode>('grid')
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
    setSlots(validSlots)
    setDisplayMode(config.displayMode ?? 'grid')
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
        displayMode,
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

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Monitor size={22} className="text-indigo-600" />
            디스플레이 설정
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            화면 분할, 이벤트 배치, 표시 방식을 설정합니다. 저장 즉시 실시간 반영됩니다.
          </p>
        </div>
        <Button onClick={handleSave} loading={saving} className="gap-1.5">
          <Save size={15} />
          {saved ? '저장됨 ✓' : '저장 및 반영'}
        </Button>
      </div>

      {/* 분할 수 */}
      <div className="mb-7">
        <p className="text-sm font-semibold text-gray-700 mb-3">화면 분할</p>
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

      {/* 표시 방식 */}
      <div className="mb-7">
        <p className="text-sm font-semibold text-gray-700 mb-3">현황 표시 방식</p>
        <div className="flex gap-3">
          <button onClick={() => setDisplayMode('grid')}
            className={`flex items-center gap-2.5 px-5 py-3 rounded-xl border-2 transition-all ${
              displayMode === 'grid'
                ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                : 'border-gray-200 text-gray-600 hover:border-gray-300'
            }`}>
            <Hash size={18} />
            <div className="text-left">
              <p className="font-semibold text-sm">번호 그리드</p>
              <p className="text-xs text-gray-400 mt-0.5">개별 번호를 타일로 표시</p>
            </div>
          </button>
          <button onClick={() => setDisplayMode('gauge')}
            className={`flex items-center gap-2.5 px-5 py-3 rounded-xl border-2 transition-all ${
              displayMode === 'gauge'
                ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                : 'border-gray-200 text-gray-600 hover:border-gray-300'
            }`}>
            <Activity size={18} />
            <div className="text-left">
              <p className="font-semibold text-sm">게이지</p>
              <p className="text-xs text-gray-400 mt-0.5">진행률 게이지로 표시</p>
            </div>
          </button>
        </div>
      </div>

      {/* 이벤트 배치 */}
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
              {slotEvents[i] && (
                <p className="text-xs text-indigo-600 mt-1.5 truncate">
                  {events.find((e) => e.id === slotEvents[i])?.status === 'active' ? '🟢 진행중' : '⚪ 준비중'}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700">
        <p className="font-semibold mb-1">💡 사용 방법</p>
        <ul className="space-y-1 text-xs text-blue-600">
          <li>• 분할 수를 선택하고 각 슬롯에 표시할 이벤트를 배치합니다</li>
          <li>• <strong>저장 및 반영</strong>을 누르면 디스플레이 앱에 즉시 반영됩니다</li>
          <li>• 이벤트가 <strong>진행중</strong> 상태일 때만 실시간 데이터가 표시됩니다</li>
          <li>• 이벤트 상태가 준비중/종료로 바뀌면 디스플레이에서 자동으로 사라집니다</li>
        </ul>
      </div>
    </div>
  )
}
