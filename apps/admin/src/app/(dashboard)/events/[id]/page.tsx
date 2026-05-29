'use client'
import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { ImageUpload } from '@/components/ui/image-upload'
import { formatPrice, formatDate } from '@/lib/utils'
import {
  ArrowLeft, Play, StopCircle, Plus, Trash2,
  Trophy, Hash, Loader2, ImageIcon, Shuffle
} from 'lucide-react'
import type { Event, Prize, EventStats } from '@kuji/types'

const STATUS_LABEL = { draft: '준비중', active: '진행중', closed: '종료' } as const
const STATUS_VARIANT = { draft: 'default', active: 'success', closed: 'warning' } as const

interface EventDetail extends Event {
  thumbnailUrl?: string | null
  prizes: (Prize & { prizeNumbers: { kujiNumber: { id: string; number: number; isDrawn: boolean } }[] })[]
}

interface KujiNumberSimple { id: string; number: number; isDrawn: boolean }

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [event, setEvent] = useState<EventDetail | null>(null)
  const [stats, setStats] = useState<EventStats | null>(null)
  const [numbers, setNumbers] = useState<KujiNumberSimple[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddPrize, setShowAddPrize] = useState(false)
  const [statusLoading, setStatusLoading] = useState(false)

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

  const changeStatus = async (status: 'active' | 'closed') => {
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
  const availableForPrize = remainingNumbers.filter((n) => !assignedNumberIds.has(n.id))

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
        {/* 썸네일 */}
        {event.thumbnailUrl && (
          <div className="flex-shrink-0 w-20 h-20 rounded-xl overflow-hidden border border-gray-200 shadow-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={event.thumbnailUrl} alt={event.title} className="w-full h-full object-cover" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant={STATUS_VARIANT[event.status]}>{STATUS_LABEL[event.status]}</Badge>
            <h1 className="text-2xl font-bold text-gray-900">{event.title}</h1>
          </div>
          {event.description && <p className="text-sm text-gray-500">{event.description}</p>}
          <p className="text-sm text-gray-500 mt-1">
            {formatPrice(event.pricePerUnit)} / 장 · 총 {event.totalCount.toLocaleString()}장
            <span className="ml-2 text-gray-400 text-xs">생성 {formatDate(event.createdAt)}</span>
          </p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          {event.status === 'draft' && (
            <Button onClick={() => changeStatus('active')} loading={statusLoading}>
              <Play size={15} className="mr-1.5" />
              이벤트 시작
            </Button>
          )}
          {event.status === 'active' && (
            <Button variant="danger" onClick={() => changeStatus('closed')} loading={statusLoading}>
              <StopCircle size={15} className="mr-1.5" />
              이벤트 종료
            </Button>
          )}
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
                        <p className="text-xs text-gray-500">
                          번호: {prize.prizeNumbers.map((pn) => pn.kujiNumber.number).sort((a, b) => a - b).join(', ')}
                        </p>
                      </div>
                      <div className="text-right">
                        <Badge variant={drawn === total ? 'warning' : 'success'}>
                          {drawn}/{total}
                        </Badge>
                      </div>
                      {event.status !== 'active' && (
                        <button onClick={() => deletePrize(prize.id)}
                          className="text-gray-400 hover:text-red-500 transition-colors ml-1">
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
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* 번호 그리드 */}
            <div className="flex flex-wrap gap-1.5 max-h-72 overflow-y-auto">
              {numbers.map((n) => {
                const isPrize = assignedNumberIds.has(n.id)
                return (
                  <div
                    key={n.id}
                    className={`w-9 h-9 flex items-center justify-center rounded-lg text-xs font-semibold
                      ${n.isDrawn
                        ? 'bg-gray-200 text-gray-400 line-through'
                        : isPrize
                        ? 'bg-amber-100 text-amber-700 border border-amber-300'
                        : 'bg-indigo-50 text-indigo-700'
                      }`}
                  >
                    {n.number}
                  </div>
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

  // 모달 닫힐 때 초기화
  const handleClose = () => {
    setName(''); setDescription(''); setImageUrl('')
    setSelectedNumbers([]); setRandomCount(''); setError('')
    onClose()
  }

  const toggleNumber = (id: string) => {
    setSelectedNumbers((prev) =>
      prev.includes(id) ? prev.filter((n) => n !== id) : [...prev, id]
    )
  }

  /** 랜덤 배치: availableNumbers 에서 N개를 무작위로 선택 */
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
      // 1. 경품 생성
      const res = await api.post('/prizes', {
        eventId,
        name,
        description,
        quantity: selectedNumbers.length,
        numberIds: selectedNumbers,
      })
      // 2. 이미지가 있으면 추가
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
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex gap-4 items-start">
          {/* 이미지 업로드 */}
          <ImageUpload
            label="이미지 (선택)"
            value={imageUrl}
            onChange={setImageUrl}
          />
          <div className="flex-1 space-y-3">
            <Input name="name" label="경품명 *" placeholder="예: A상 — 피규어"
              value={name} onChange={(e) => setName(e.target.value)} required />
            <Input name="description" label="설명 (선택)" placeholder="경품 설명"
              value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
        </div>

        {/* 랜덤 배치 */}
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">
            당첨 번호 선택 *
            <span className="ml-1 text-gray-400 font-normal text-xs">
              (전체 {availableNumbers.length}개 중 {selectedNumbers.length}개 선택됨)
            </span>
          </p>
          <div className="flex gap-2 mb-2">
            <Input
              type="number"
              placeholder={`개수 (최대 ${availableNumbers.length})`}
              value={randomCount}
              onChange={(e) => setRandomCount(e.target.value)}
              min={1}
              max={availableNumbers.length}
              className="w-40"
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={randomAssign}
              disabled={!randomCount}
              className="gap-1.5 flex-shrink-0"
            >
              <Shuffle size={14} />
              랜덤 배치
            </Button>
            {selectedNumbers.length > 0 && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setSelectedNumbers([])}
                className="text-gray-500"
              >
                초기화
              </Button>
            )}
          </div>

          {availableNumbers.length === 0 ? (
            <p className="text-sm text-gray-400 py-2">배정 가능한 번호가 없습니다</p>
          ) : (
            <div className="flex flex-wrap gap-1.5 max-h-44 overflow-y-auto p-1 border border-gray-100 rounded-lg bg-gray-50">
              {availableNumbers.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => toggleNumber(n.id)}
                  className={`w-9 h-9 rounded-lg text-xs font-semibold transition-colors
                    ${selectedNumbers.includes(n.id)
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-white text-gray-700 hover:bg-indigo-50 border border-gray-200'}`}
                >
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
