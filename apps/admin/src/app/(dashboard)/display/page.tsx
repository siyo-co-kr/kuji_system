'use client'
import { useEffect, useState, useCallback } from 'react'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import { Button } from '@/components/ui/button'
import { Loader2, Monitor, Save, Layout, Tv } from 'lucide-react'
import type { Event } from '@kuji/types'

type ViewMode = 'multi' | 'single'

export default function DisplaySettingsPage() {
  const { account } = useAuthStore()
  const [viewMode, setViewMode] = useState<ViewMode>('multi')
  const [slotEvents, setSlotEvents] = useState<(string | null)[]>([null, null, null, null])
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const fetchData = useCallback(async (signal?: AbortSignal) => {
    if (!account?.store.id) return
    const [configRes, eventsRes] = await Promise.all([
      api.get('/display-config', { signal }),
      api.get(`/events?storeId=${account.store.id}`, { signal }),
    ])
    const config = configRes.data
    setViewMode(config.viewMode ?? 'multi')

    // 멀티뷰는 항상 4슬롯
    const mapped = Array.from({ length: 4 }, (_, i) =>
      config.slotData.find((s: { slotIndex: number; eventId: string | null }) => s.slotIndex === i)?.eventId ?? null
    )
    setSlotEvents(mapped)
    setEvents(eventsRes.data as Event[])
    setLoading(false)
  }, [account])

  useEffect(() => {
    const controller = new AbortController()
    fetchData(controller.signal).catch((err) => {
      if (err?.name !== 'CanceledError' && err?.name !== 'AbortError') {
        console.error('[DisplaySettings] fetchData error:', err)
      }
    })
    return () => controller.abort()
  }, [fetchData])

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
        slots: 4,
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

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Monitor size={22} className="text-indigo-600" />
            디스플레이 설정
          </h1>
          <p className="mt-1 text-sm text-gray-500">저장 즉시 디스플레이 앱에 실시간 반영됩니다.</p>
        </div>
        <Button onClick={handleSave} loading={saving} className="gap-1.5">
          <Save size={15} />
          {saved ? '저장됨 ✓' : '저장 및 반영'}
        </Button>
      </div>

      {/* 보기 모드 선택 */}
      <div className="mb-8">
        <p className="text-sm font-semibold text-gray-700 mb-3">보기 모드</p>
        <div className="grid grid-cols-2 gap-4 max-w-lg">
          <button onClick={() => setViewMode('multi')}
            className={`flex flex-col gap-3 p-4 rounded-2xl border-2 text-left transition-all ${
              viewMode === 'multi' ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-gray-300'
            }`}>
            <div className="flex items-center gap-2">
              <Layout size={20} className={viewMode === 'multi' ? 'text-indigo-600' : 'text-gray-500'} />
              <span className="font-semibold text-sm">멀티뷰</span>
              <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">4분할</span>
            </div>
            <p className="text-xs text-gray-500">1기기에서 4개 이벤트를 2×2 화면으로 표시합니다.</p>
            <div className="grid grid-cols-2 gap-1">
              {[...Array(4)].map((_, i) => <div key={i} className="h-4 bg-gray-200 rounded" />)}
            </div>
          </button>

          <button onClick={() => setViewMode('single')}
            className={`flex flex-col gap-3 p-4 rounded-2xl border-2 text-left transition-all ${
              viewMode === 'single' ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-gray-300'
            }`}>
            <div className="flex items-center gap-2">
              <Tv size={20} className={viewMode === 'single' ? 'text-indigo-600' : 'text-gray-500'} />
              <span className="font-semibold text-sm">싱글뷰</span>
            </div>
            <p className="text-xs text-gray-500">기기에서 진행중 이벤트를 선택하여 전체화면으로 봅니다.</p>
            <div className="flex gap-1">
              <div className="w-1/3 h-8 bg-gray-200 rounded" />
              <div className="flex-1 h-8 bg-gray-200 rounded" />
            </div>
          </button>
        </div>
      </div>

      {/* 멀티뷰: 4슬롯 이벤트 배치 */}
      {viewMode === 'multi' && (
        <div className="mb-6">
          <p className="text-sm font-semibold text-gray-700 mb-3">이벤트 배치 (4분할)</p>
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }, (_, i) => (
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
      )}

      {/* 싱글뷰: 안내 */}
      {viewMode === 'single' && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700 mb-6">
          <p className="font-semibold text-amber-800 mb-1">📺 싱글뷰 사용법</p>
          <ul className="space-y-1 text-xs">
            <li>• 디스플레이 앱에 접속하면 헤더 중앙에 <strong>진행중 이벤트 목록</strong>이 표시됩니다</li>
            <li>• 이벤트를 클릭하면 해당 이벤트의 상세 현황이 전체화면으로 표시됩니다</li>
            <li>• 좌측: 썸네일 · 경품 정보 · 게이지 / 우측: 번호 그리드</li>
          </ul>
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs text-blue-600">
        <p className="font-semibold text-sm text-blue-700 mb-1">💡 디스플레이 앱 접속 URL</p>
        <code className="bg-blue-100 px-2 py-1 rounded">{typeof window !== 'undefined' ? `${window.location.hostname}:3001` : 'IP:3001'}</code>
      </div>
    </div>
  )
}
