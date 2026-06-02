import { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../lib/api'
import { connectSocket, getSocket } from '../lib/socket'
import { useAuthStore } from '../stores/auth'
import MultiView from '../components/MultiView'
import SingleView from '../components/SingleView'

export interface SlotNumber { id: string; number: number; isDrawn: boolean; isPrize: boolean }
export interface SlotPrize {
  id: string; name: string; description?: string | null
  images: { id: string; imageUrl: string; order: number }[]
  prizeNumbers: { kujiNumber: { id: string; number: number; isDrawn: boolean } }[]
}
export interface SlotEvent {
  id: string; title: string; description?: string | null
  thumbnailUrl?: string | null; status: string
  totalCount: number; pricePerUnit: number
  bonusEnabled: boolean; bonusThreshold: number
  prizes: SlotPrize[]
}
export interface SlotStats {
  totalCount: number; remainingCount: number
  totalPrizeCount: number; remainingPrizeCount: number
}
export interface SlotData {
  slotIndex: number; eventId: string | null
  event: SlotEvent | null; stats: SlotStats | null
  numbers: SlotNumber[]
}

export default function DisplayPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { account, logout } = useAuthStore()

  const [viewMode, setViewMode] = useState<'multi' | 'single'>('multi')
  const [slotCount, setSlotCount] = useState(2)
  const [slotData, setSlotData] = useState<SlotData[]>([])
  const [loading, setLoading] = useState(true)
  const joinedRooms = useRef<Set<string>>(new Set())

  // URL의 ?slot=N 파라미터 (싱글뷰에서 기기별 지정)
  const slotParam = searchParams.get('slot')
  const slotIndex = slotParam !== null ? parseInt(slotParam, 10) : null

  const fetchConfig = useCallback(async () => {
    try {
      const res = await api.get('/display-config')
      setViewMode(res.data.viewMode ?? 'multi')
      setSlotCount(res.data.slots)
      setSlotData(res.data.slotData)

      const socket = getSocket()
      joinedRooms.current.forEach((eid) => socket.emit('event:leave', eid))
      joinedRooms.current.clear()

      ;(res.data.slotData as SlotData[]).forEach((slot) => {
        if (slot.eventId && slot.event?.status === 'active') {
          socket.emit('event:join', slot.eventId)
          joinedRooms.current.add(slot.eventId)
        }
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchConfig() }, [fetchConfig])

  useEffect(() => {
    if (!account?.store.id) return
    const socket = connectSocket()
    socket.emit('admin:join', account.store.id)

    socket.on('display:config-updated', () => fetchConfig())

    socket.on('number:drawn', ({ eventId, numbers: drawn }) => {
      if (!eventId) return
      const drawnIds = new Set((drawn as { id: string }[]).map((n) => n.id))
      setSlotData((prev) => prev.map((slot) => {
        if (slot.eventId !== eventId) return slot

        // 추첨된 번호 중 경품 번호 수 계산 → remainingPrizeCount 감소
        const prizeDrawnCount = slot.numbers.filter(
          (n) => drawnIds.has(n.id) && n.isPrize && !n.isDrawn
        ).length

        return {
          ...slot,
          numbers: slot.numbers.map((n) => drawnIds.has(n.id) ? { ...n, isDrawn: true } : n),
          stats: slot.stats ? {
            ...slot.stats,
            remainingCount:      Math.max(0, slot.stats.remainingCount - drawn.length),
            remainingPrizeCount: Math.max(0, slot.stats.remainingPrizeCount - prizeDrawnCount),
          } : null,
          event: slot.event ? {
            ...slot.event,
            prizes: slot.event.prizes.map((p) => ({
              ...p,
              prizeNumbers: p.prizeNumbers.map((pn) =>
                drawnIds.has(pn.kujiNumber.id)
                  ? { ...pn, kujiNumber: { ...pn.kujiNumber, isDrawn: true } }
                  : pn
              ),
            })),
          } : null,
        }
      }))
    })

    socket.on('event:updated', () => fetchConfig())

    return () => {
      socket.off('display:config-updated')
      socket.off('number:drawn')
      socket.off('event:updated')
      joinedRooms.current.forEach((eid) => socket.emit('event:leave', eid))
    }
  }, [account, fetchConfig])

  const handleLogout = () => { logout(); navigate('/login', { replace: true }) }

  if (loading) {
    return (
      <div className="h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // 싱글뷰: ?slot=N 파라미터가 있거나 viewMode === 'single'
  const isSingle = viewMode === 'single' || slotIndex !== null
  const targetSlot = isSingle
    ? slotData.find((s) => s.slotIndex === (slotIndex ?? 0)) ?? null
    : null

  return (
    <div className="h-screen bg-gray-950 text-white flex flex-col overflow-hidden">
      {/* 상단 바 */}
      <header className="flex-shrink-0 flex items-center justify-between px-6 h-12 border-b border-gray-800">
        <span className="text-base font-bold text-gray-100">{account?.store.name}</span>
        <button onClick={handleLogout}
          className="text-xs text-gray-600 hover:text-gray-400 transition-colors">
          로그아웃
        </button>
      </header>

      {/* 메인 콘텐츠 */}
      <main className="flex-1 min-h-0">
        {isSingle ? (
          <SingleView slot={targetSlot} />
        ) : (
          <MultiView slotCount={slotCount} slotData={slotData} />
        )}
      </main>
    </div>
  )
}
