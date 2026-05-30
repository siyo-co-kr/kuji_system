import { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { connectSocket, getSocket } from '../lib/socket'
import { useAuthStore } from '../stores/auth'
import EventSlot from '../components/EventSlot'

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

/** CSS grid columns 클래스 */
function getGridCols(slots: number) {
  switch (slots) {
    case 2: return 'grid-cols-2'
    case 3: return 'grid-cols-3'
    case 4: return 'grid-cols-2'
    case 6: return 'grid-cols-3'
    default: return 'grid-cols-2'
  }
}

/** 1행인지 2행인지 */
function isOneRow(slots: number) { return slots === 2 || slots === 3 }

export default function DisplayPage() {
  const navigate = useNavigate()
  const { account, logout } = useAuthStore()
  const [slotCount, setSlotCount] = useState(2)
  const [displayMode, setDisplayMode] = useState<'grid' | 'gauge'>('grid')
  const [slotData, setSlotData] = useState<SlotData[]>([])
  const [loading, setLoading] = useState(true)
  const joinedRooms = useRef<Set<string>>(new Set())

  const fetchConfig = useCallback(async () => {
    try {
      const res = await api.get('/display-config')
      setSlotCount(res.data.slots)
      setDisplayMode(res.data.displayMode ?? 'grid')
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

    socket.on('display:config-updated', () => { fetchConfig() })

    socket.on('payment:confirmed', ({ eventId, numbers: drawn }) => {
      if (!eventId) return
      const drawnIds = new Set((drawn as { id: string }[]).map((n) => n.id))
      setSlotData((prev) => prev.map((slot) => {
        if (slot.eventId !== eventId) return slot
        return {
          ...slot,
          numbers: slot.numbers.map((n) => drawnIds.has(n.id) ? { ...n, isDrawn: true } : n),
          stats: slot.stats
            ? { ...slot.stats, remainingCount: Math.max(0, slot.stats.remainingCount - drawn.length) }
            : null,
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

    socket.on('event:updated', () => { fetchConfig() })

    return () => {
      socket.off('display:config-updated')
      socket.off('payment:confirmed')
      socket.off('event:updated')
      joinedRooms.current.forEach((eid) => socket.emit('event:leave', eid))
    }
  }, [account, fetchConfig])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // 진행중 이벤트가 있는 슬롯만 표시 판단
  const visibleSlots = slotData.filter((s) => s.event?.status === 'active')
  const hasActive = visibleSlots.length > 0

  const oneRow = isOneRow(slotCount)

  return (
    <div className="h-screen bg-gray-950 text-white flex flex-col overflow-hidden">
      {/* 상단 바 — 매장명만 표시 */}
      <header className="flex-shrink-0 flex items-center justify-between px-6 h-12 border-b border-gray-800">
        <span className="text-base font-bold text-gray-100">{account?.store.name}</span>
        <button onClick={() => { logout(); navigate('/login', { replace: true }) }}
          className="text-xs text-gray-600 hover:text-gray-400 transition-colors">
          로그아웃
        </button>
      </header>

      {/* 메인 그리드 */}
      <main className="flex-1 min-h-0 p-3">
        {!hasActive ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-700">
            <p className="text-5xl mb-4">📺</p>
            <p>표시할 진행중 이벤트가 없습니다</p>
          </div>
        ) : (
          <div className={`grid ${getGridCols(slotCount)} gap-3 h-full`}
               style={{ gridTemplateRows: oneRow ? '1fr' : '1fr 1fr' }}>
            {slotData.map((slot) => (
              <EventSlot
                key={slot.slotIndex}
                slot={slot}
                displayMode={displayMode}
                oneRow={oneRow}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
