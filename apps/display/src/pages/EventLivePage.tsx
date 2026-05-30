import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { connectSocket, disconnectSocket, getSocket } from '../lib/socket'
import EventHeader from '../components/EventHeader'
import NumberGrid from '../components/NumberGrid'
import PrizeBoard from '../components/PrizeBoard'
import type { EventStats } from '@kuji/types'

export interface PublicNumber {
  id: string
  number: number
  isDrawn: boolean
  isPrize: boolean
}

export interface PrizeImage { id: string; imageUrl: string; order: number }
export interface PublicPrize {
  id: string
  name: string
  description?: string
  images: PrizeImage[]
  prizeNumbers: { kujiNumber: { id: string; number: number; isDrawn: boolean } }[]
}

export interface PublicEventDetail {
  id: string
  title: string
  description?: string
  thumbnailUrl?: string | null
  totalCount: number
  pricePerUnit: number
  bonusEnabled: boolean
  bonusThreshold: number
  isVisible: boolean
  status: 'draft' | 'active' | 'closed'
  startedAt?: string
  endedAt?: string
  store?: { id: string; name: string }
  prizes: PublicPrize[]
}

export default function EventLivePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [event, setEvent] = useState<PublicEventDetail | null>(null)
  const [stats, setStats] = useState<EventStats | null>(null)
  const [numbers, setNumbers] = useState<PublicNumber[]>([])
  const [recentlyDrawn, setRecentlyDrawn] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  const fetchAll = useCallback(async () => {
    if (!id) return
    try {
      const [evRes, statsRes, numRes] = await Promise.all([
        api.get(`/events/${id}`),
        api.get(`/events/${id}/stats`),
        api.get(`/events/${id}/numbers`),
      ])
      setEvent(evRes.data)
      setStats(statsRes.data)
      // /events/:id/numbers 는 isPrize 를 반환하지 않으므로
      // prizes 데이터에서 매핑
      const prizeNumberIds = new Set(
        (evRes.data.prizes as PublicPrize[]).flatMap((p) =>
          p.prizeNumbers.map((pn) => pn.kujiNumber.id)
        )
      )
      setNumbers(
        (numRes.data as { id: string; number: number; isDrawn: boolean }[]).map((n) => ({
          ...n,
          isPrize: prizeNumberIds.has(n.id),
        }))
      )
    } catch {
      navigate('/')
    } finally {
      setLoading(false)
    }
  }, [id, navigate])

  useEffect(() => { fetchAll() }, [fetchAll])

  useEffect(() => {
    if (!id) return
    const socket = connectSocket()
    socket.emit('event:join', id)

    // 결제 확인 → 번호 + 경품 in-place 업데이트
    socket.on('payment:confirmed', ({ numbers: drawnNumbers }) => {
      const drawnIds = new Set(drawnNumbers.map((n: { id: string }) => n.id))

      // 번호 그리드 업데이트
      setNumbers((prev) => prev.map((n) => (drawnIds.has(n.id) ? { ...n, isDrawn: true } : n)))

      // 통계 업데이트
      setStats((prev) => prev
        ? { ...prev, remainingCount: Math.max(0, prev.remainingCount - drawnNumbers.length) }
        : prev
      )

      // 경품 현황 업데이트 (PrizeBoard의 isDrawn 반영)
      setEvent((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          prizes: prev.prizes.map((prize) => ({
            ...prize,
            prizeNumbers: prize.prizeNumbers.map((pn) =>
              drawnIds.has(pn.kujiNumber.id)
                ? { ...pn, kujiNumber: { ...pn.kujiNumber, isDrawn: true } }
                : pn
            ),
          })),
        }
      })

      // 최근 추첨 애니메이션 (4초)
      setRecentlyDrawn(drawnIds)
      setTimeout(() => setRecentlyDrawn(new Set()), 4000)
    })

    // 이벤트 상태 변경 → 전체 갱신
    socket.on('event:updated', () => { fetchAll() })

    return () => {
      const s = getSocket()
      s.emit('event:leave', id)
      s.off('payment:confirmed')
      s.off('event:updated')
      disconnectSocket()
    }
  }, [id, fetchAll])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!event || !stats) return null

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      <div className="px-6 pt-4">
        <button
          onClick={() => navigate('/')}
          className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
        >
          ← 이벤트 목록
        </button>
      </div>

      <EventHeader event={event} stats={stats} />

      <div className="flex-1 flex flex-col lg:flex-row gap-4 px-6 pb-6 min-h-0">
        <div className="flex-1 bg-gray-900 rounded-2xl border border-gray-800 p-4 overflow-auto">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">번호 현황</h2>
          <NumberGrid numbers={numbers} recentlyDrawn={recentlyDrawn} />
        </div>
        <div className="lg:w-80 bg-gray-900 rounded-2xl border border-gray-800 p-4 overflow-auto">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">경품 현황</h2>
          <PrizeBoard prizes={event.prizes} />
        </div>
      </div>
    </div>
  )
}
