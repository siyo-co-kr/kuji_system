'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { connectSocket, disconnectSocket, getSocket } from '@/lib/socket'
import { useAuthStore } from '@/stores/auth'
import { getErrorMessage } from '@/lib/api'
import { toast } from 'sonner'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { ImageUpload } from '@/components/ui/image-upload'
import { formatPrice, formatDate } from '@/lib/utils'
import {
  ArrowLeft, Plus, Trash2, Pencil, ChevronRight,
  Trophy, Hash, Loader2, ImageIcon, Shuffle, Gift, Monitor, BookOpen, Settings
} from 'lucide-react'
import type { Event, Prize, EventStats } from '@kuji/types'

const STATUS_LABEL = { draft: '준비중', active: '진행중', closed: '종료' } as const
const STATUS_VARIANT = { draft: 'default', active: 'success', closed: 'warning' } as const

interface EventDetail extends Omit<Event, 'bonusEnabled' | 'bonusThreshold' | 'isVisible' | 'mode'> {
  thumbnailUrl?: string | null
  bonusEnabled?: boolean
  bonusThreshold?: number
  isVisible?: boolean
  mode: 'online' | 'offline'
  maxNumber?: number | null
  prizes: (Prize & { prizeNumbers: { kujiNumber: { id: string; number: number; isDrawn: boolean } }[] })[]
}

interface KujiNumberSimple { id: string; number: number; isDrawn: boolean; isPrize: boolean }

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { account } = useAuthStore()
  const [event, setEvent] = useState<EventDetail | null>(null)
  const [stats, setStats] = useState<EventStats | null>(null)
  const [numbers, setNumbers] = useState<KujiNumberSimple[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddPrize, setShowAddPrize] = useState(false)
  type PrizeWithNumbers = Prize & { prizeNumbers: { kujiNumber: { id: string; number: number; isDrawn: boolean } }[] }
  const [editingPrize, setEditingPrize] = useState<PrizeWithNumbers | null>(null)
  const [showEditEvent, setShowEditEvent] = useState(false)
  const [statusLoading, setStatusLoading] = useState(false)
  const [visibilityLoading, setVisibilityLoading] = useState(false)
  const [drawingId, setDrawingId] = useState<string | null>(null)

  // 소켓 핸들러 내 스테일 클로저 방지용 ref
  const numbersRef = useRef(numbers)
  const eventRef = useRef(event)
  useEffect(() => { numbersRef.current = numbers }, [numbers])
  useEffect(() => { eventRef.current = event }, [event])

  const fetchAll = useCallback(async () => {
    const [evRes, statsRes, numRes] = await Promise.all([
      api.get(`/events/${id}`),
      api.get(`/events/${id}/stats`),
      api.get(`/events/${id}/numbers`),
    ])
    setEvent(evRes.data)
    setStats(statsRes.data)
    setNumbers(numRes.data)
    setLoading(false)
  }, [id])

  useEffect(() => { fetchAll() }, [fetchAll])

  // ── 실시간 소켓 연결 ────────────────────────────────────────
  useEffect(() => {
    if (!id || !account?.store.id) return
    const socket = connectSocket()
    socket.emit('admin:join', account.store.id)
    socket.emit('event:join', id)

    // 번호가 추첨됐을 때 (수동 추첨 또는 결제 승인)
    socket.on('number:drawn', ({ numbers: drawnNumbers }) => {
      const drawnIds = new Set((drawnNumbers as { id: string }[]).map((n) => n.id))

      // 번호 그리드 업데이트
      setNumbers((prev) => prev.map((n) => drawnIds.has(n.id) ? { ...n, isDrawn: true } : n))

      // ref로 최신 상태를 읽어 스테일 클로저 방지
      const currentNumbers = numbersRef.current
      const currentEvent = eventRef.current
      const assignedIds = new Set(
        currentEvent?.prizes.flatMap((p) => p.prizeNumbers.map((pn) => pn.kujiNumber.id)) ?? []
      )
      const prizeDrawnCount = currentNumbers.filter(
        (n) => drawnIds.has(n.id) && assignedIds.has(n.id) && !n.isDrawn
      ).length

      // 통계 업데이트
      setStats((prev) => prev ? {
        ...prev,
        remainingCount:      Math.max(0, prev.remainingCount - drawnNumbers.length),
        remainingPrizeCount: Math.max(0, prev.remainingPrizeCount - prizeDrawnCount),
      } : prev)

      // 경품 현황 업데이트 (prizeNumbers 안의 isDrawn 반영)
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
    })

    socket.on('event:updated', () => { fetchAll() })

    return () => {
      const s = getSocket()
      s.off('number:drawn')
      s.off('event:updated')
      s.emit('event:leave', id)
      disconnectSocket()
    }
  }, [id, account, fetchAll])

  const toggleVisibility = async () => {
    if (!event) return
    setVisibilityLoading(true)
    try {
      await api.patch(`/events/${id}/visibility`, { isVisible: !event.isVisible })
      await fetchAll()
    } finally {
      setVisibilityLoading(false)
    }
  }

  const changeStatus = async (status: 'draft' | 'active' | 'closed') => {
    if (event?.status === status) return
    setStatusLoading(true)
    try {
      await api.patch(`/events/${id}/status`, { status })
      await fetchAll()
    } finally {
      setStatusLoading(false)
    }
  }

  const deletePrize = async (prizeId: string) => {
    if (!confirm('경품을 삭제하시겠습니까?')) return
    await api.delete(`/prizes/${prizeId}`)
    await fetchAll()
  }

  // ── 번호 수동 추첨 ──────────────────────────────────────────
  const drawNumber = async (numberId: string) => {
    if (!event || event.status !== 'active') return
    if (drawingId) return // 중복 방지
    setDrawingId(numberId)
    try {
      await api.patch(`/events/${id}/numbers/${numberId}/draw`)
      // 소켓 이벤트로 UI 업데이트됨
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, '추첨 처리에 실패했습니다.'))
    } finally {
      setDrawingId(null)
    }
  }

  const [batchDrawInput, setBatchDrawInput] = useState('')
  const [batchDrawLoading, setBatchDrawLoading] = useState(false)

  const handleBatchDraw = async () => {
    const nums = batchDrawInput
      .split(',')
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n) && n > 0)
    if (nums.length === 0) {
      toast.error('유효한 번호를 입력해주세요.')
      return
    }
    setBatchDrawLoading(true)
    try {
      const res = await api.patch(`/events/${id}/numbers/batch-draw`, { numbers: nums })
      const { drawn, skipped } = res.data as { drawn: number; skipped: number }
      toast.success(`${drawn}개 비활성화 완료${skipped > 0 ? ` (${skipped}개 스킵)` : ''}`)
      setBatchDrawInput('')
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, '비활성화에 실패했습니다.'))
    } finally {
      setBatchDrawLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="animate-spin text-indigo-600" size={32} />
      </div>
    )
  }

  if (!event) return <div className="p-8 text-gray-500">이벤트를 찾을 수 없습니다.</div>

  const drawnNumbers = numbers.filter((n) => n.isDrawn)
  const remainingNumbers = numbers.filter((n) => !n.isDrawn)
  const assignedNumberIds = new Set(
    event.prizes.flatMap((p) => p.prizeNumbers.map((pn) => pn.kujiNumber.id))
  )
  const isOfflineMode = event.mode === 'offline'
  const availableForPrize = remainingNumbers.filter((n) => {
    if (assignedNumberIds.has(n.id)) return false
    if (isOfflineMode) return n.isPrize  // 오프라인: 사전 지정 경품 번호만
    return true
  })

  return (
    <div className="p-8 max-w-5xl">
      {/* 상단 네비 */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mb-6 transition-colors"
      >
        <ArrowLeft size={16} />
        이벤트 목록
      </button>

      {/* 이벤트 헤더 */}
      <div className="flex items-start justify-between mb-6 gap-4">
        {event.thumbnailUrl && (
          <div className="flex-shrink-0 w-20 h-20 rounded-xl overflow-hidden border border-gray-200 shadow-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={event.thumbnailUrl} alt={event.title} className="w-full h-full object-cover" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <Badge variant={STATUS_VARIANT[event.status]}>{STATUS_LABEL[event.status]}</Badge>
            {event.bonusEnabled && (
              <span className="inline-flex items-center gap-1 text-sm bg-amber-100 text-amber-700 px-2.5 py-0.5 rounded-full font-semibold">
                <Gift size={13} />
                {event.bonusThreshold}+1 이벤트
              </span>
            )}
            <h1 className="text-2xl font-bold text-gray-900">{event.title}</h1>
          </div>
          {event.description && <p className="text-sm text-gray-500">{event.description}</p>}
          <p className="text-sm text-gray-500 mt-1">
            {formatPrice(event.pricePerUnit)} / 장 · 총 {event.totalCount.toLocaleString()}장
            <span className="ml-2 text-gray-400 text-xs">생성 {formatDate(event.createdAt)}</span>
          </p>
        </div>

        {/* 우측 버튼 영역 */}
        <div className="flex flex-col gap-2 flex-shrink-0 items-end">
          {/* 이벤트 수정 */}
          <Button variant="secondary" size="sm" onClick={() => setShowEditEvent(true)} className="gap-1.5">
            <Settings size={14} /> 이벤트 수정
          </Button>

          {/* 디스플레이 토글 */}
          <Button
            variant={event.isVisible ? 'secondary' : 'ghost'}
            size="sm"
            onClick={toggleVisibility}
            loading={visibilityLoading}
            className={event.isVisible ? 'border-blue-300 text-blue-700 bg-blue-50' : 'text-gray-500'}
          >
            <Monitor size={15} className="mr-1.5" />
            {event.isVisible ? '디스플레이 ON' : '디스플레이 OFF'}
          </Button>

          {/* 상태 변경 — 3개 버튼 항상 표시 */}
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {(['draft', 'active', 'closed'] as const).map((s) => (
              <button
                key={s}
                disabled={statusLoading}
                onClick={() => changeStatus(s)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                  event.status === s
                    ? s === 'active' ? 'bg-green-600 text-white'
                    : s === 'closed' ? 'bg-orange-500 text-white'
                    : 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                {STATUS_LABEL[s]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 통계 카드 4개 */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard label="전체 번호" value={stats.totalCount.toLocaleString()} unit="장" />
          <StatCard label="남은 번호" value={stats.remainingCount.toLocaleString()} unit="장"
            highlight={stats.remainingCount < stats.totalCount * 0.2} />
          <StatCard label="전체 경품" value={stats.totalPrizeCount.toLocaleString()} unit="개" />
          <StatCard label="남은 경품" value={stats.remainingPrizeCount.toLocaleString()} unit="개"
            highlight={stats.remainingPrizeCount === 0} />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 경품 목록 */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Trophy size={16} className="text-amber-500" />
                경품 목록
              </CardTitle>
              {event.status !== 'closed' && (
                <Button size="sm" variant="secondary" onClick={() => setShowAddPrize(true)}>
                  <Plus size={14} className="mr-1" />
                  경품 추가
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {event.prizes.length === 0 ? (
              <div className="py-10 text-center text-sm text-gray-400">
                등록된 경품이 없습니다
              </div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {event.prizes.map((prize) => {
                  const drawn = prize.prizeNumbers.filter((pn) => pn.kujiNumber.isDrawn).length
                  const total = prize.prizeNumbers.length
                  const remaining = total - drawn
                  return (
                    <li key={prize.id} className="flex items-center gap-3 px-6 py-3">
                      <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {prize.images?.[0] ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={prize.images[0].imageUrl} alt={prize.name}
                            className="w-full h-full object-cover" />
                        ) : (
                          <ImageIcon size={18} className="text-gray-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-gray-900 truncate">{prize.name}</p>
                        {prize.description && (
                          <p className="text-xs text-gray-400 truncate">{prize.description}</p>
                        )}
                        <p className="text-xs text-gray-500 mt-0.5">
                          번호: {prize.prizeNumbers.map((pn) => pn.kujiNumber.number).sort((a, b) => a - b).join(', ')}
                        </p>
                      </div>
                      {/* 남은 수량 / 전체 수량 */}
                      <Badge variant={remaining === 0 ? 'warning' : 'success'}>
                        {remaining}/{total}
                      </Badge>
                      {/* 수정 버튼 */}
                      <button
                        onClick={() => setEditingPrize(prize as PrizeWithNumbers)}
                        className="text-gray-400 hover:text-indigo-500 transition-colors"
                        title="경품 수정"
                      >
                        <Pencil size={14} />
                      </button>
                      {event.status !== 'active' && (
                        <button onClick={() => deletePrize(prize.id)}
                          className="text-gray-400 hover:text-red-500 transition-colors">
                          <Trash2 size={15} />
                        </button>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* 번호 현황 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Hash size={16} className="text-indigo-500" />
              번호 현황
              {event.status === 'active' && (
                <span className="text-xs font-normal text-gray-400 ml-1">(클릭으로 추첨/취소)</span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1.5 max-h-72 overflow-y-auto">
              {numbers.map((n) => {
                const isPrize  = assignedNumberIds.has(n.id)
                const isDrawing = drawingId === n.id
                const canToggle = event.status === 'active'

                return (
                  <button
                    key={n.id}
                    type="button"
                    disabled={!canToggle || !!drawingId}
                    onClick={() => canToggle && drawNumber(n.id)}
                    title={canToggle ? (n.isDrawn ? '클릭하여 추첨 취소' : '클릭하여 추첨') : undefined}
                    className={`w-9 h-9 flex items-center justify-center rounded-lg text-xs font-semibold transition-all
                      ${isDrawing
                        ? 'animate-pulse bg-indigo-400 text-white'
                        : n.isDrawn
                        ? canToggle
                          ? 'bg-gray-200 text-gray-400 line-through hover:bg-red-100 hover:text-red-500 hover:no-underline cursor-pointer'
                          : 'bg-gray-200 text-gray-400 line-through cursor-default'
                        : isPrize
                        ? 'bg-amber-100 text-amber-700 border border-amber-300 hover:bg-amber-200 cursor-pointer'
                        : canToggle
                        ? 'bg-indigo-50 text-indigo-700 hover:bg-indigo-200 cursor-pointer'
                        : 'bg-indigo-50 text-indigo-700 cursor-default'
                      }`}
                  >
                    {n.number}
                  </button>
                )
              })}
            </div>
            <div className="flex gap-4 mt-3 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-indigo-50 border border-indigo-200 inline-block" />
                일반 ({availableForPrize.length})
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-amber-100 border border-amber-300 inline-block" />
                경품 ({stats?.remainingPrizeCount ?? 0})
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-gray-200 inline-block" />
                뽑힘 ({drawnNumbers.length})
              </span>
            </div>
            {event.status === 'active' && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <p className="text-xs font-medium text-gray-600 mb-1.5">번호 일괄 비활성화</p>
                <div className="flex gap-2">
                  <Input
                    placeholder="예: 1,7,11,30"
                    value={batchDrawInput}
                    onChange={(e) => setBatchDrawInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleBatchDraw()}
                    className="text-sm"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={handleBatchDraw}
                    loading={batchDrawLoading}
                    className="flex-shrink-0"
                  >
                    비활성화
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 경품 추가 모달 */}
      <AddPrizeModal
        open={showAddPrize}
        onClose={() => setShowAddPrize(false)}
        eventId={id}
        availableNumbers={availableForPrize}
        onAdded={() => { setShowAddPrize(false); fetchAll() }}
      />

      {/* 경품 수정 모달 */}
      {editingPrize && (
        <EditPrizeModal
          prize={editingPrize}
          allNumbers={numbers}
          assignedNumberIds={assignedNumberIds}
          isOfflineMode={isOfflineMode}
          onClose={() => setEditingPrize(null)}
          onSaved={() => { setEditingPrize(null); fetchAll() }}
        />
      )}

      {/* 이벤트 정보 수정 모달 */}
      {showEditEvent && event && (
        <EditEventModal
          event={event}
          onClose={() => setShowEditEvent(false)}
          onSaved={() => { setShowEditEvent(false); fetchAll() }}
        />
      )}
    </div>
  )
}

function StatCard({ label, value, unit, highlight }: {
  label: string; value: string; unit: string; highlight?: boolean
}) {
  return (
    <Card>
      <CardContent className="py-4">
        <p className="text-xs text-gray-500 mb-1">{label}</p>
        <p className={`text-2xl font-bold ${highlight ? 'text-red-500' : 'text-gray-900'}`}>
          {value}
          <span className="text-sm font-normal text-gray-500 ml-1">{unit}</span>
        </p>
      </CardContent>
    </Card>
  )
}

// ── 경품 수정 모달 ─────────────────────────────────────────────
function EditPrizeModal({
  prize, allNumbers, assignedNumberIds, isOfflineMode, onClose, onSaved,
}: {
  prize: Prize & { prizeNumbers: { kujiNumber: { id: string; number: number; isDrawn: boolean } }[] }
  allNumbers: KujiNumberSimple[]
  assignedNumberIds: Set<string>
  isOfflineMode: boolean
  onClose: () => void
  onSaved: () => void
}) {
  // 이 경품에 현재 배정된 번호 ID
  const initialNumberIds = prize.prizeNumbers.map((pn) => pn.kujiNumber.id)

  const [name, setName] = useState(prize.name)
  const [description, setDescription] = useState(prize.description ?? '')
  const [imageUrl, setImageUrl] = useState(prize.images?.[0]?.imageUrl ?? '')
  const [selectedIds, setSelectedIds] = useState<string[]>(initialNumberIds)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // 선택 가능 번호 = 이 경품의 번호 + 아직 미배정 번호 (다른 경품 번호 제외)
  // 오프라인 모드: isPrize = true (사전 지정)인 번호만 허용
  const otherPrizeIds = new Set([...assignedNumberIds].filter((id) => !initialNumberIds.includes(id)))
  const availableNumbers = allNumbers.filter((n) => {
    if (otherPrizeIds.has(n.id)) return false
    if (isOfflineMode && !n.isPrize) return false
    return true
  })

  const toggleId = (id: string) =>
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) { setError('경품명을 입력해주세요.'); return }
    if (selectedIds.length === 0) { setError('번호를 1개 이상 선택해주세요.'); return }
    setLoading(true)
    try {
      await api.patch(`/prizes/${prize.id}`, {
        name,
        description: description || null,
        imageUrl:    imageUrl || null,
        numberIds:   selectedIds,
      })
      onSaved()
    } catch {
      setError('수정에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open onClose={onClose} title="경품 수정" className="max-w-lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* 이미지 + 기본 정보 */}
        <div className="flex gap-4 items-start">
          <ImageUpload label="이미지" value={imageUrl} onChange={setImageUrl} />
          <div className="flex-1 space-y-3">
            <Input label="경품명 *" value={name}
              onChange={(e) => setName(e.target.value)} required />
            <Input label="설명 (선택)" value={description} placeholder="경품 설명"
              onChange={(e) => setDescription(e.target.value)} />
          </div>
        </div>

        {/* 번호 선택 */}
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">
            당첨 번호
            <span className="ml-1 text-gray-400 font-normal text-xs">
              ({selectedIds.length}개 선택 / 선택 가능 {availableNumbers.length}개)
            </span>
          </p>
          {availableNumbers.length === 0 ? (
            <p className="text-sm text-gray-400 py-2">배정 가능한 번호가 없습니다</p>
          ) : (
            <div className="flex flex-wrap gap-1.5 max-h-44 overflow-y-auto p-1 border border-gray-100 rounded-lg bg-gray-50">
              {availableNumbers.map((n) => {
                const isSelected = selectedIds.includes(n.id)
                const isCurrentPrize = initialNumberIds.includes(n.id)
                return (
                  <button key={n.id} type="button" onClick={() => toggleId(n.id)}
                    title={isCurrentPrize ? '현재 배정된 번호' : '추가 가능'}
                    className={`w-9 h-9 rounded-lg text-xs font-semibold transition-colors ${
                      isSelected
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : isCurrentPrize
                        ? 'bg-amber-100 text-amber-700 border border-amber-300 hover:bg-indigo-50'
                        : 'bg-white text-gray-700 hover:bg-indigo-50 border border-gray-200'
                    }`}>
                    {n.number}
                  </button>
                )
              })}
            </div>
          )}
          <div className="flex gap-4 mt-1.5 text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-amber-100 border border-amber-300 inline-block" />
              현재 배정됨
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-indigo-600 inline-block" />
              선택됨
            </span>
          </div>
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
        <div className="flex gap-2 pt-1">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>취소</Button>
          <Button type="submit" className="flex-1" loading={loading}>저장</Button>
        </div>
      </form>
    </Modal>
  )
}

interface CatalogItem { id: string; name: string; description?: string | null; imageUrl?: string | null; category?: { id: string; name: string } | null }
interface CatalogCategory { id: string; name: string }

// ── 경품 추가 모달 ─────────────────────────────────────────────
function AddPrizeModal({
  open, onClose, eventId, availableNumbers, onAdded
}: {
  open: boolean
  onClose: () => void
  eventId: string
  availableNumbers: KujiNumberSimple[]
  onAdded: () => void
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [selectedNumbers, setSelectedNumbers] = useState<string[]>([])
  const [randomCount, setRandomCount] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  // 카탈로그 패널
  const [showCatalog, setShowCatalog] = useState(false)
  const [catalog, setCatalog] = useState<CatalogItem[]>([])
  const [categories, setCategories] = useState<CatalogCategory[]>([])
  const [catalogLoading, setCatalogLoading] = useState(false)
  const [filterCategoryId, setFilterCategoryId] = useState<string>('')
  // 카탈로그 등록 서브 폼
  const [showNewForm, setShowNewForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newCatId, setNewCatId] = useState('')
  const [newLoading, setNewLoading] = useState(false)

  const handleClose = () => {
    setName(''); setDescription(''); setImageUrl('')
    setSelectedNumbers([]); setRandomCount(''); setError('')
    setShowCatalog(false); setShowNewForm(false)
    onClose()
  }

  const openCatalog = async () => {
    setShowCatalog(true)
    setCatalogLoading(true)
    try {
      const [catRes, itemRes] = await Promise.all([
        api.get('/prize-catalog/categories'),
        api.get('/prize-catalog'),
      ])
      setCategories(catRes.data)
      setCatalog(itemRes.data)
    } finally {
      setCatalogLoading(false)
    }
  }

  const filterCatalog = async (catId: string) => {
    setFilterCategoryId(catId)
    setCatalogLoading(true)
    try {
      const res = await api.get(`/prize-catalog${catId ? `?categoryId=${catId}` : ''}`)
      setCatalog(res.data)
    } finally {
      setCatalogLoading(false)
    }
  }

  const importFromCatalog = (item: CatalogItem) => {
    setName(item.name)
    setDescription(item.description ?? '')
    setImageUrl(item.imageUrl ?? '')
    setShowCatalog(false)
    setShowNewForm(false)
  }

  const saveToCatalog = async () => {
    if (!newName.trim()) return
    setNewLoading(true)
    try {
      await api.post('/prize-catalog', {
        name: newName, description: newDesc || null,
        categoryId: newCatId || null,
      })
      setNewName(''); setNewDesc(''); setNewCatId('')
      setShowNewForm(false)
      // 목록 새로고침
      const res = await api.get(`/prize-catalog${filterCategoryId ? `?categoryId=${filterCategoryId}` : ''}`)
      setCatalog(res.data)
    } finally {
      setNewLoading(false)
    }
  }

  const toggleNumber = (numberId: string) => {
    setSelectedNumbers((prev) =>
      prev.includes(numberId) ? prev.filter((n) => n !== numberId) : [...prev, numberId]
    )
  }

  const randomAssign = () => {
    const n = Number(randomCount)
    if (!n || n < 1 || n > availableNumbers.length) {
      setError(`1 ~ ${availableNumbers.length} 사이의 숫자를 입력하세요.`)
      return
    }
    setError('')
    const shuffled = [...availableNumbers].sort(() => Math.random() - 0.5)
    setSelectedNumbers(shuffled.slice(0, n).map((num) => num.id))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || selectedNumbers.length === 0) {
      setError('경품명과 번호를 1개 이상 선택해주세요.')
      return
    }
    setLoading(true)
    try {
      const res = await api.post('/prizes', {
        eventId, name, description,
        quantity: selectedNumbers.length,
        numberIds: selectedNumbers,
      })
      if (imageUrl) {
        await api.post(`/prizes/${res.data.id}/images`, { imageUrl, order: 0 })
      }
      onAdded()
      handleClose()
    } catch {
      setError('경품 추가에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title="경품 추가" className="max-w-lg">
      {/* 카탈로그 패널 */}
      {showCatalog && (
        <div className="mb-4 border border-indigo-200 rounded-xl bg-indigo-50/40 p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-indigo-700 flex items-center gap-1.5">
              <BookOpen size={14} /> 경품 카탈로그
            </p>
            <div className="flex items-center gap-2">
              <button onClick={() => setShowNewForm((v) => !v)}
                className="text-xs text-indigo-600 hover:text-indigo-800 border border-indigo-300 rounded px-2 py-0.5">
                + 카탈로그 등록
              </button>
              <button onClick={() => { setShowCatalog(false); setShowNewForm(false) }}
                className="text-gray-400 hover:text-gray-600 text-sm">✕</button>
            </div>
          </div>

          {/* 카탈로그 등록 서브 폼 */}
          {showNewForm && (
            <div className="mb-2 p-2.5 bg-white rounded-lg border border-indigo-100 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <input value={newName} onChange={(e) => setNewName(e.target.value)}
                  placeholder="경품명 *" className="text-xs border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-400" />
                <select value={newCatId} onChange={(e) => setNewCatId(e.target.value)}
                  className="text-xs border border-gray-300 rounded px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400">
                  <option value="">카테고리 없음</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <input value={newDesc} onChange={(e) => setNewDesc(e.target.value)}
                placeholder="설명 (선택)" className="w-full text-xs border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-400" />
              <button type="button" onClick={saveToCatalog} disabled={!newName || newLoading}
                className="w-full text-xs bg-indigo-600 text-white rounded py-1.5 disabled:opacity-50 hover:bg-indigo-700">
                {newLoading ? '저장 중...' : '카탈로그에 저장'}
              </button>
            </div>
          )}

          {/* 카테고리 필터 */}
          {categories.length > 0 && (
            <div className="flex gap-1 mb-2 flex-wrap">
              <button onClick={() => filterCatalog('')}
                className={`text-xs px-2 py-0.5 rounded-full transition-colors ${
                  !filterCategoryId ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-indigo-50'
                }`}>전체</button>
              {categories.map((c) => (
                <button key={c.id} onClick={() => filterCatalog(c.id)}
                  className={`text-xs px-2 py-0.5 rounded-full transition-colors ${
                    filterCategoryId === c.id ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-indigo-50'
                  }`}>{c.name}</button>
              ))}
            </div>
          )}

          {catalogLoading ? (
            <div className="text-center py-3"><Loader2 size={18} className="animate-spin text-indigo-400 mx-auto" /></div>
          ) : catalog.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-2">등록된 경품이 없습니다</p>
          ) : (
            <div className="flex flex-col gap-1 max-h-40 overflow-y-auto">
              {catalog.map((item) => (
                <button key={item.id} type="button" onClick={() => importFromCatalog(item)}
                  className="flex items-center gap-2 text-left px-2 py-1.5 rounded-lg hover:bg-white hover:shadow-sm transition-all text-sm">
                  <div className="w-7 h-7 rounded bg-gray-200 overflow-hidden flex-shrink-0 flex items-center justify-center">
                    {item.imageUrl
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                      : <Gift size={12} className="text-gray-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-800 truncate text-xs">{item.name}</p>
                    {item.description && <p className="text-xs text-gray-400 truncate">{item.description}</p>}
                  </div>
                  <ChevronRight size={12} className="text-gray-400 flex-shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex gap-4 items-start">
          <ImageUpload label="이미지 (선택)" value={imageUrl} onChange={setImageUrl} />
          <div className="flex-1 space-y-3">
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Input name="name" label="경품명 *" placeholder="예: A상 — 피규어"
                  value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <Button type="button" variant="secondary" size="sm" onClick={openCatalog}
                className="flex-shrink-0 gap-1 mb-0.5" title="카탈로그에서 불러오기">
                <BookOpen size={13} /> 카탈로그
              </Button>
            </div>
            <Input name="description" label="설명 (선택)" placeholder="경품 설명"
              value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
        </div>

        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">
            당첨 번호 선택 *
            <span className="ml-1 text-gray-400 font-normal text-xs">
              (전체 {availableNumbers.length}개 중 {selectedNumbers.length}개 선택됨)
            </span>
          </p>
          <div className="flex gap-2 mb-2">
            <Input type="number" placeholder={`개수 (최대 ${availableNumbers.length})`}
              value={randomCount} onChange={(e) => setRandomCount(e.target.value)}
              min={1} max={availableNumbers.length} className="w-40" />
            <Button type="button" variant="secondary" size="sm"
              onClick={randomAssign} disabled={!randomCount} className="gap-1.5 flex-shrink-0">
              <Shuffle size={14} /> 랜덤 배치
            </Button>
            {selectedNumbers.length > 0 && (
              <Button type="button" variant="secondary" size="sm"
                onClick={() => setSelectedNumbers([])} className="text-gray-500">
                초기화
              </Button>
            )}
          </div>
          {availableNumbers.length === 0 ? (
            <p className="text-sm text-gray-400 py-2">배정 가능한 번호가 없습니다</p>
          ) : (
            <div className="flex flex-wrap gap-1.5 max-h-44 overflow-y-auto p-1 border border-gray-100 rounded-lg bg-gray-50">
              {availableNumbers.map((n) => (
                <button key={n.id} type="button" onClick={() => toggleNumber(n.id)}
                  className={`w-9 h-9 rounded-lg text-xs font-semibold transition-colors
                    ${selectedNumbers.includes(n.id)
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-white text-gray-700 hover:bg-indigo-50 border border-gray-200'}`}>
                  {n.number}
                </button>
              ))}
            </div>
          )}
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
        <div className="flex gap-2 pt-2">
          <Button type="button" variant="secondary" className="flex-1" onClick={handleClose}>취소</Button>
          <Button type="submit" className="flex-1" loading={loading}>추가</Button>
        </div>
      </form>
    </Modal>
  )
}

// ── 이벤트 정보 수정 모달 ─────────────────────────────────────

function EditEventModal({
  event, onClose, onSaved,
}: {
  event: EventDetail
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState({
    title:          event.title,
    description:    event.description ?? '',
    thumbnailUrl:   event.thumbnailUrl ?? '',
    pricePerUnit:   String(event.pricePerUnit),
    bonusEnabled:   event.bonusEnabled ?? false,
    bonusThreshold: String(event.bonusThreshold ?? 10),
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!form.title.trim()) { setError('이벤트명을 입력해주세요.'); return }
    setLoading(true)
    try {
      await api.patch(`/events/${event.id}`, {
        title:          form.title,
        description:    form.description || null,
        thumbnailUrl:   form.thumbnailUrl || null,
        pricePerUnit:   Number(form.pricePerUnit),
        bonusEnabled:   form.bonusEnabled,
        bonusThreshold: Number(form.bonusThreshold),
      })
      onSaved()
    } catch {
      setError('수정에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open onClose={onClose} title="이벤트 수정" className="max-w-md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="이벤트명 *" name="title" value={form.title}
          onChange={handleChange} required />
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">설명</label>
          <textarea name="description" rows={2} value={form.description}
            onChange={handleChange} placeholder="이벤트 설명"
            className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
        <Input label="장당 가격 (원)" name="pricePerUnit" type="number"
          min={0} value={form.pricePerUnit} onChange={handleChange} />
        <ImageUpload label="썸네일 이미지" value={form.thumbnailUrl}
          onChange={(url) => setForm((f) => ({ ...f, thumbnailUrl: url }))} />

        {/* 보너스 설정 */}
        <div className={`rounded-xl border px-4 py-3 transition-colors ${
          form.bonusEnabled ? 'border-indigo-300 bg-indigo-50/50' : 'border-gray-200 bg-gray-50/50'
        }`}>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={form.bonusEnabled}
              onChange={(e) => setForm((f) => ({ ...f, bonusEnabled: e.target.checked }))}
              className="w-4 h-4 rounded border-gray-300 text-indigo-600" />
            <div>
              <p className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
                <Gift size={13} className="text-amber-500" />
                {form.bonusThreshold}+1 보너스
              </p>
              <p className="text-xs text-gray-500">N장 구매 시 1장 무료</p>
            </div>
          </label>
          {form.bonusEnabled && (
            <div className="mt-2 pl-7">
              <Input label="기준 수량 (N)" name="bonusThreshold" type="number"
                min={2} max={100} value={form.bonusThreshold} onChange={handleChange} />
            </div>
          )}
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
        <div className="flex gap-2 pt-1">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>취소</Button>
          <Button type="submit" className="flex-1" loading={loading}>저장</Button>
        </div>
      </form>
    </Modal>
  )
}
