import { useEffect, useState, useCallback, useRef } from 'react'
import { api } from '../lib/api'
import { connectSocket, getSocket } from '../lib/socket'
import type { SlotPrize, SlotNumber, SlotStats } from '../pages/DisplayPage'
import PrizeModal from './PrizeModal'
import GaugeDisplay from './GaugeDisplay'

/** 목록용 간략 이벤트 */
interface EventSummary {
  id: string; title: string; status: string
  bonusEnabled: boolean; bonusThreshold: number
}
/** 상세 조회 시 prizes + prizeNumbers 포함 */
interface ActiveEventDetail {
  id: string; title: string; thumbnailUrl?: string | null; status: string
  bonusEnabled: boolean; bonusThreshold: number; totalCount: number
  prizes: SlotPrize[]
}

interface Props { storeId: string }

export default function SingleView({ storeId }: Props) {
  const [eventSummaries, setEventSummaries] = useState<EventSummary[]>([])  // 헤더 탭용
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedEvent, setSelectedEvent] = useState<ActiveEventDetail | null>(null)  // 상세 (prizes 포함)
  const [stats, setStats] = useState<SlotStats | null>(null)
  const [numbers, setNumbers] = useState<SlotNumber[]>([])
  const [loadingEvents, setLoadingEvents] = useState(true)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [showPrizes, setShowPrizes] = useState(false)
  const joinedRoom = useRef<string | null>(null)

  // 진행중 이벤트 목록 (헤더 탭용 — 간략 정보)
  const fetchEvents = useCallback(async () => {
    try {
      const res = await api.get(`/events?storeId=${storeId}`)
      const active = (res.data as EventSummary[]).filter((e) => e.status === 'active')
      setEventSummaries(active)
      if (active.length > 0 && !selectedId) setSelectedId(active[0].id)
    } finally {
      setLoadingEvents(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId])

  useEffect(() => { fetchEvents() }, [storeId])

  // 선택된 이벤트 상세 (prizes + prizeNumbers 포함) + 통계 + 번호
  const fetchDetail = useCallback(async (eventId: string) => {
    setLoadingDetail(true)
    try {
      const [evRes, statsRes, numRes] = await Promise.all([
        api.get(`/events/${eventId}`),          // prizes + prizeNumbers 포함
        api.get(`/events/${eventId}/stats`),
        api.get(`/events/${eventId}/numbers`),
      ])
      setSelectedEvent(evRes.data)
      setStats(statsRes.data)
      setNumbers(numRes.data)
    } finally {
      setLoadingDetail(false)
    }
  }, [])

  useEffect(() => {
    if (!selectedId) return
    fetchDetail(selectedId)

    // 이전 룸 나가기
    const socket = getSocket()
    if (joinedRoom.current && joinedRoom.current !== selectedId) {
      socket.emit('event:leave', joinedRoom.current)
    }
    socket.emit('event:join', selectedId)
    joinedRoom.current = selectedId

    return () => {
      socket.emit('event:leave', selectedId)
      joinedRoom.current = null
    }
  }, [selectedId, fetchDetail])

  // 실시간 소켓
  useEffect(() => {
    const socket = connectSocket()

    socket.on('number:drawn', ({ eventId, numbers: drawn }) => {
      if (eventId !== selectedId) return
      const drawnIds = new Set((drawn as { id: string }[]).map((n) => n.id))
      const prizeDrawn = numbers.filter((n) => drawnIds.has(n.id) && n.isPrize && !n.isDrawn).length
      setNumbers((prev) => prev.map((n) => drawnIds.has(n.id) ? { ...n, isDrawn: true } : n))
      setStats((prev) => prev ? {
        ...prev,
        remainingCount:      Math.max(0, prev.remainingCount - drawn.length),
        remainingPrizeCount: Math.max(0, prev.remainingPrizeCount - prizeDrawn),
      } : prev)
      // 상세 이벤트의 prizes prizeNumbers 업데이트
      setSelectedEvent((prev) => {
        if (!prev || prev.id !== eventId) return prev
        return {
          ...prev,
          prizes: prev.prizes.map((p) => ({
            ...p,
            prizeNumbers: p.prizeNumbers.map((pn) =>
              drawnIds.has(pn.kujiNumber.id) ? { ...pn, kujiNumber: { ...pn.kujiNumber, isDrawn: true } } : pn
            ),
          })),
        }
      })
    })

    socket.on('event:updated', () => {
      fetchEvents()
      if (selectedId) fetchDetail(selectedId)
    })

    return () => {
      socket.off('number:drawn')
      socket.off('event:updated')
    }
  }, [selectedId, numbers, fetchEvents, fetchDetail])

  if (loadingEvents) {
    return (
      <div className="h-full flex items-center justify-center text-gray-700">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (eventSummaries.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-gray-700">
        <p className="text-5xl mb-4">📺</p>
        <p>진행중인 이벤트가 없습니다</p>
      </div>
    )
  }

  const winProb = stats && stats.remainingCount > 0
    ? stats.remainingPrizeCount / stats.remainingCount * 100
    : 0
  const drawnCount = stats ? stats.totalCount - stats.remainingCount : 0
  const progress = stats && stats.totalCount > 0 ? drawnCount / stats.totalCount * 100 : 0

  return (
    <>
      {/* 이벤트 선택 헤더 (중앙) */}
      <div className="flex-shrink-0 flex items-center justify-center gap-2 px-6 py-2 border-b border-gray-800 bg-gray-900/50 overflow-x-auto scrollbar-hide">
        {eventSummaries.map((ev) => (
          <button
            key={ev.id}
            onClick={() => setSelectedId(ev.id)}
            className={`flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all ${
              selectedId === ev.id
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/30'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse flex-shrink-0" />
            {ev.title}
            {ev.bonusEnabled && (
              <span className="text-xs bg-amber-500/20 text-amber-400 px-1.5 rounded-full">
                {ev.bonusThreshold}+1
              </span>
            )}
          </button>
        ))}
      </div>

      {/* 메인 콘텐츠 */}
      {selectedEvent && !loadingDetail && stats ? (
        <div className="flex-1 min-h-0 flex gap-0">
          {/* ── 좌측: 썸네일 + 경품 + 게이지 ── */}
          <div className="w-[30%] flex-shrink-0 border-r border-gray-800 flex flex-col overflow-hidden">
            <div className="flex-shrink-0 p-4">
              <div className="w-full aspect-[2/3] rounded-2xl overflow-hidden bg-gray-800 flex items-center justify-center max-h-64">
                {selectedEvent.thumbnailUrl
                  ? <img src={selectedEvent.thumbnailUrl} alt={selectedEvent.title} className="w-full h-full object-cover" />
                  : <div className="text-6xl">🎲</div>}
              </div>
            </div>

            <div className="px-4 flex-shrink-0">
              <h2 className="font-bold text-white text-base leading-tight">{selectedEvent.title}</h2>
            </div>

            <div className="flex-1 min-h-0 overflow-hidden px-4 py-2">
              <GaugeDisplay stats={stats} winProbability={winProb} compact={false} />
            </div>

            {/* 경품 카드 (가로 스크롤) */}
            {selectedEvent.prizes.length > 0 && (
              <div className="flex-shrink-0 px-4 pb-3 border-t border-gray-800 pt-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">경품</p>
                <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
                  {selectedEvent.prizes.map((prize) => {
                    const total = prize.prizeNumbers.length
                    const remaining = total - prize.prizeNumbers.filter((pn) => pn.kujiNumber.isDrawn).length
                    const exhausted = remaining === 0
                    return (
                      <div key={prize.id} className={`flex-shrink-0 w-24 rounded-xl overflow-hidden border ${exhausted ? 'border-gray-700 opacity-50' : 'border-gray-700'}`}>
                        <div className="aspect-square bg-gray-800 flex items-center justify-center overflow-hidden">
                          {prize.images[0]
                            ? <img src={prize.images[0].imageUrl} alt={prize.name} className={`w-full h-full object-cover ${exhausted ? 'grayscale' : ''}`} />
                            : <span className="text-3xl">{exhausted ? '🩶' : '🎁'}</span>}
                        </div>
                        <div className="bg-gray-900 p-2">
                          <p className={`text-xs font-semibold truncate ${exhausted ? 'text-gray-600 line-through' : 'text-white'}`}>{prize.name}</p>
                          <p className={`text-xs font-bold ${exhausted ? 'text-gray-600' : 'text-amber-400'}`}>{remaining}/{total}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
                <button onClick={() => setShowPrizes(true)}
                  className="w-full mt-2 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold hover:bg-amber-500/20 transition-colors">
                  🎁 경품 전체 보기
                </button>
              </div>
            )}
          </div>

          {/* ── 우측: 번호 그리드 ── */}
          <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
            <div className="flex-shrink-0 px-5 py-3 border-b border-gray-800 flex items-center gap-6">
              <StatBox label="남은 번호" value={stats.remainingCount} total={stats.totalCount} color="text-indigo-400" />
              <StatBox label="당첨 확률" value={parseFloat(winProb.toFixed(1))} unit="%" color="text-amber-400" />
              <StatBox label="남은 경품" value={stats.remainingPrizeCount} total={stats.totalPrizeCount} color="text-green-400" />
              <div className="flex-1">
                <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-500 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
                </div>
                <p className="text-xs text-gray-600 text-right mt-0.5">{progress.toFixed(0)}% 추첨됨</p>
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-auto scrollbar-hide p-4">
              <div className="flex flex-wrap gap-2 content-start">
                {numbers.map((n) => (
                  <div key={n.id} className={`flex items-center justify-center rounded-xl font-bold w-11 h-11 sm:w-12 sm:h-12 text-sm flex-shrink-0 transition-all duration-300 ${
                    n.isDrawn ? 'bg-gray-800 text-gray-600 line-through' :
                    n.isPrize ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' :
                                'bg-indigo-500/15 text-indigo-300 border border-indigo-500/20'
                  }`}>
                    {n.number}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {showPrizes && selectedEvent && (
        <PrizeModal eventTitle={selectedEvent.title} prizes={selectedEvent.prizes} onClose={() => setShowPrizes(false)} />
      )}
    </>
  )
}

function StatBox({ label, value, total, unit, color }: { label: string; value: number; total?: number; unit?: string; color: string }) {
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-2xl font-bold tabular-nums ${color}`}>
        {value}{unit ?? ''}
        {total !== undefined && <span className="text-sm text-gray-600 font-normal">/{total}</span>}
      </p>
    </div>
  )
}
