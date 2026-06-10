'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { ImageUpload } from '@/components/ui/image-upload'
import { formatPrice, formatDate } from '@/lib/utils'
import { Plus, ChevronRight, Loader2, ImageIcon, Trash2, Trash, Gift, Monitor } from 'lucide-react'
import type { Event } from '@kuji/types'

const STATUS_LABEL = { draft: '준비중', active: '진행중', closed: '종료' } as const
const STATUS_VARIANT = { draft: 'default', active: 'success', closed: 'warning' } as const

type StatusFilter = 'all' | 'draft' | 'active' | 'closed'

type EventWithThumb = Event & { thumbnailUrl?: string | null; bonusEnabled?: boolean; bonusThreshold?: number }

export default function EventsPage() {
  const { account } = useAuthStore()
  const [events, setEvents] = useState<EventWithThumb[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [filter, setFilter] = useState<StatusFilter>('all')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [bulkDeleting, setBulkDeleting] = useState(false)

  const fetchEvents = async () => {
    if (!account?.store.id) return
    try {
      const res = await api.get(`/events?storeId=${account.store.id}`)
      setEvents(res.data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchEvents() }, [account])

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm('이벤트를 삭제하시겠습니까?\n결제 내역은 보존됩니다.')) return
    setDeletingId(id)
    try {
      await api.delete(`/events/${id}`)
      setEvents((prev) => prev.filter((ev) => ev.id !== id))
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? '삭제에 실패했습니다.'
      alert(msg)
    } finally {
      setDeletingId(null)
    }
  }

  const handleBulkDelete = async () => {
    const closedIds = events.filter((e) => e.status === 'closed').map((e) => e.id)
    if (closedIds.length === 0) return
    if (!confirm(`종료된 이벤트 ${closedIds.length}개를 모두 삭제하시겠습니까?\n결제 내역은 보존됩니다.`)) return
    setBulkDeleting(true)
    try {
      await api.post('/events/bulk-delete', { eventIds: closedIds })
      setEvents((prev) => prev.filter((e) => e.status !== 'closed'))
    } catch {
      alert('일괄 삭제에 실패했습니다.')
    } finally {
      setBulkDeleting(false)
    }
  }

  const filtered = filter === 'all' ? events : events.filter((e) => e.status === filter)

  const counts = {
    all:    events.length,
    draft:  events.filter((e) => e.status === 'draft').length,
    active: events.filter((e) => e.status === 'active').length,
    closed: events.filter((e) => e.status === 'closed').length,
  }

  return (
    <div className="p-8">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">이벤트 관리</h1>
          <p className="mt-1 text-sm text-gray-500">쿠지 이벤트를 생성하고 관리합니다</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus size={16} className="mr-2" />
          이벤트 생성
        </Button>
      </div>

      {/* 필터 탭 + 종료 탭 일괄 삭제 */}
      <div className="flex items-center gap-3 mb-5">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {([
            { key: 'all',    label: `전체 (${counts.all})`       },
            { key: 'active', label: `진행중 (${counts.active})`   },
            { key: 'draft',  label: `준비중 (${counts.draft})`    },
            { key: 'closed', label: `종료 (${counts.closed})`     },
          ] as const).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                filter === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {/* 종료 탭에서만 일괄 삭제 버튼 표시 */}
        {filter === 'closed' && counts.closed > 0 && (
          <Button
            size="sm"
            variant="danger"
            onClick={handleBulkDelete}
            loading={bulkDeleting}
            className="gap-1.5"
          >
            <Trash size={14} />
            종료 이벤트 일괄 삭제
          </Button>
        )}
      </div>

      {/* 이벤트 목록 */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-indigo-600" size={32} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-gray-400 text-sm">
            {filter === 'all' ? '등록된 이벤트가 없습니다' : `${STATUS_LABEL[filter]} 이벤트가 없습니다`}
          </p>
          {filter === 'all' && (
            <Button className="mt-4" onClick={() => setShowCreate(true)}>
              첫 이벤트 만들기
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((event) => {
            const canDelete = event.status !== 'active'
            return (
              <div key={event.id} className="relative group">
                <Link href={`/events/${event.id}`}>
                  <Card className="hover:border-indigo-200 hover:shadow-md transition-all cursor-pointer">
                    <CardContent className="flex items-center gap-4 py-4">
                      {/* 썸네일 */}
                      <div className="w-12 h-12 rounded-lg border border-gray-100 flex-shrink-0 overflow-hidden bg-gray-50 flex items-center justify-center">
                        {event.thumbnailUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={event.thumbnailUrl} alt={event.title} className="w-full h-full object-cover" />
                        ) : (
                          <ImageIcon size={18} className="text-gray-300" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <Badge variant={STATUS_VARIANT[event.status]}>{STATUS_LABEL[event.status]}</Badge>
                          {event.bonusEnabled && (
                            <span className="inline-flex items-center gap-0.5 text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-semibold">
                              <Gift size={10} />
                              {event.bonusThreshold}+1
                            </span>
                          )}
                          {event.isVisible && (
                            <span className="inline-flex items-center gap-0.5 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-semibold">
                              <Monitor size={10} />
                              디스플레이
                            </span>
                          )}
                          <h3 className="font-semibold text-gray-900 truncate">{event.title}</h3>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          <span>총 {event.totalCount.toLocaleString()}장</span>
                          <span>{formatPrice(event.pricePerUnit)} / 장</span>
                          <span>생성 {formatDate(event.createdAt)}</span>
                        </div>
                      </div>
                      <ChevronRight size={18} className="text-gray-400 flex-shrink-0" />
                    </CardContent>
                  </Card>
                </Link>
                {/* 삭제 버튼 (진행중 제외) — hover 시 표시 */}
                {canDelete && (
                  <button
                    onClick={(e) => handleDelete(e, event.id)}
                    disabled={deletingId === event.id}
                    className="absolute right-12 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-500 hover:text-red-700"
                    title="이벤트 삭제"
                  >
                    {deletingId === event.id
                      ? <Loader2 size={15} className="animate-spin" />
                      : <Trash2 size={15} />}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* 이벤트 생성 모달 */}
      <CreateEventModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={() => { setShowCreate(false); fetchEvents() }}
      />
    </div>
  )
}

/** "51-60,80,90" 형식의 문자열을 숫자 배열로 파싱 */
function parsePrizeNumbers(input: string): number[] {
  const result = new Set<number>()
  const parts = input.split(',').map((p) => p.trim()).filter(Boolean)
  for (const part of parts) {
    if (part.includes('-')) {
      const [s, e] = part.split('-').map(Number)
      if (!isNaN(s) && !isNaN(e) && s <= e) {
        for (let n = s; n <= e; n++) result.add(n)
      }
    } else {
      const n = Number(part)
      if (!isNaN(n) && n > 0) result.add(n)
    }
  }
  return [...result].sort((a, b) => a - b)
}

function CreateEventModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [mode, setMode] = useState<'online' | 'offline'>('online')
  const [form, setForm] = useState({
    title: '', description: '', totalCount: '', pricePerUnit: '',
    thumbnailUrl: '', bonusEnabled: false, bonusThreshold: '10',
    isVisible: false,
    // 오프라인 전용
    maxNumber: '', prizeNumbers: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleClose = () => {
    setMode('online')
    setForm({ title: '', description: '', totalCount: '', pricePerUnit: '', thumbnailUrl: '', bonusEnabled: false, bonusThreshold: '10', isVisible: false, maxNumber: '', prizeNumbers: '' })
    setError('')
    onClose()
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const totalCount = Number(form.totalCount)
    const pricePerUnit = Number(form.pricePerUnit)
    const bonusThreshold = Number(form.bonusThreshold)
    if (!form.title || totalCount < 1 || pricePerUnit < 0) {
      setError('올바른 값을 입력해주세요.')
      return
    }
    if (form.bonusEnabled && (bonusThreshold < 2 || bonusThreshold > 100)) {
      setError('보너스 기준 수량은 2~100 사이로 입력해주세요.')
      return
    }

    let maxNumber: number | undefined
    let prizeNumbers: number[] = []

    if (mode === 'offline') {
      maxNumber = Number(form.maxNumber)
      if (!maxNumber || maxNumber < 1) { setError('오프라인 모드는 최대 번호를 입력해주세요.'); return }
      if (maxNumber > totalCount) { setError('최대 번호는 전체 번호 수보다 클 수 없습니다.'); return }
      prizeNumbers = parsePrizeNumbers(form.prizeNumbers)
      const overLimit = prizeNumbers.find((n) => n > maxNumber!)
      if (overLimit) { setError(`경품 번호 ${overLimit}이 최대 번호(${maxNumber})를 초과합니다.`); return }
    }

    setLoading(true)
    try {
      await api.post('/events', {
        title: form.title,
        description: form.description || undefined,
        thumbnailUrl: form.thumbnailUrl || undefined,
        totalCount, pricePerUnit,
        bonusEnabled: form.bonusEnabled,
        bonusThreshold: form.bonusEnabled ? bonusThreshold : 10,
        isVisible: form.isVisible,
        mode,
        ...(mode === 'offline' ? { maxNumber, prizeNumbers } : {}),
      })
      onCreated()
      handleClose()
    } catch {
      setError('이벤트 생성에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title="새 이벤트 생성" className="max-w-md">
      <form onSubmit={handleSubmit} className="space-y-4">

        {/* ── 모드 선택 ── */}
        <div className="grid grid-cols-2 gap-2">
          {(['online', 'offline'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`py-2.5 rounded-xl text-sm font-semibold border-2 transition-all ${
                mode === m
                  ? m === 'online'
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                    : 'border-orange-400 bg-orange-50 text-orange-700'
                  : 'border-gray-200 text-gray-500 hover:border-gray-300'
              }`}
            >
              {m === 'online' ? '🌐 온라인 모드' : '📦 오프라인 모드'}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-400 -mt-2">
          {mode === 'online'
            ? '번호가 1부터 순차적으로 생성됩니다.'
            : '최대 번호를 기준으로 번호가 순환 생성됩니다. 경품 번호는 1회만 등장합니다.'}
        </p>

        <Input name="title" label="이벤트명 *" placeholder="예: 2026 여름 쿠지"
          value={form.title} onChange={handleChange} required />
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">설명 (선택)</label>
          <textarea name="description" rows={2} placeholder="이벤트 설명을 입력하세요"
            value={form.description} onChange={handleChange}
            className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input name="totalCount" type="number" label="전체 번호 수 *" placeholder="예: 300"
            min={1} max={100000} value={form.totalCount} onChange={handleChange} required />
          <Input name="pricePerUnit" type="number" label="장당 가격 (원) *" placeholder="예: 5000"
            min={0} value={form.pricePerUnit} onChange={handleChange} required />
        </div>

        {/* ── 오프라인 전용 필드 ── */}
        {mode === 'offline' && (
          <div className="rounded-xl border-2 border-orange-200 bg-orange-50/50 p-4 space-y-3">
            <p className="text-xs font-semibold text-orange-700 mb-1">오프라인 모드 설정</p>
            <Input name="maxNumber" type="number" label="최대 번호 *"
              placeholder="예: 110"
              min={1} value={form.maxNumber} onChange={handleChange} />
            <div>
              <Input name="prizeNumbers" label="경품 번호 (선택)"
                placeholder="예: 51-60 또는 51,52,53"
                value={form.prizeNumbers} onChange={handleChange} />
              <p className="text-xs text-orange-600 mt-1">
                경품 번호는 전체 시퀀스에서 1회만 등장합니다. 비워두면 모든 번호가 순환합니다.
              </p>
            </div>
            {form.maxNumber && form.totalCount && (
              <p className="text-xs text-gray-500">
                생성 예시: 1~{form.maxNumber} → 반복 (경품 번호 제외) → 총 {form.totalCount}장
              </p>
            )}
          </div>
        )}

        {/* ── 10+1 보너스 설정 ── */}
        <div className={`rounded-xl border p-4 transition-colors ${
          form.bonusEnabled ? 'border-indigo-300 bg-indigo-50/50' : 'border-gray-200 bg-gray-50/50'
        }`}>
          <label className="flex items-start gap-3 cursor-pointer">
            <div className="flex-shrink-0 mt-0.5">
              <input
                type="checkbox"
                checked={form.bonusEnabled}
                onChange={(e) => setForm((f) => ({ ...f, bonusEnabled: e.target.checked }))}
                className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                10+1 보너스 이벤트
                {form.bonusEnabled && (
                  <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">
                    활성화됨
                  </span>
                )}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                N장 구매 시 1장을 무료로 추가 지급합니다
              </p>
            </div>
          </label>

          {form.bonusEnabled && (
            <div className="mt-3 pl-7">
              <Input
                name="bonusThreshold"
                type="number"
                label="보너스 기준 수량 (N)"
                placeholder="10"
                min={2}
                max={100}
                value={form.bonusThreshold}
                onChange={handleChange}
              />
              <p className="text-xs text-indigo-600 mt-1.5">
                현재 설정: {form.bonusThreshold || '10'}장 구매 시 1장 무료
              </p>
            </div>
          )}
        </div>

        <ImageUpload label="썸네일 이미지 (선택)" value={form.thumbnailUrl}
          onChange={(url) => setForm((f) => ({ ...f, thumbnailUrl: url }))} />

        {/* ── 디스플레이 노출 설정 ── */}
        <div className={`flex items-center justify-between rounded-xl border px-4 py-3 transition-colors ${
          form.isVisible ? 'border-blue-300 bg-blue-50/50' : 'border-gray-200 bg-gray-50/50'
        }`}>
          <div>
            <p className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
              <Monitor size={14} className={form.isVisible ? 'text-blue-600' : 'text-gray-400'} />
              디스플레이 앱에 표시
            </p>
            <p className="text-xs text-gray-500 mt-0.5">활성화 시 매장 디스플레이 화면에 노출됩니다</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={form.isVisible}
            onClick={() => setForm((f) => ({ ...f, isVisible: !f.isVisible }))}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${
              form.isVisible ? 'bg-blue-600' : 'bg-gray-200'
            }`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
              form.isVisible ? 'translate-x-6' : 'translate-x-1'
            }`} />
          </button>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-2 pt-2">
          <Button type="button" variant="secondary" className="flex-1" onClick={handleClose}>취소</Button>
          <Button type="submit" className="flex-1" loading={loading}>생성</Button>
        </div>
      </form>
    </Modal>
  )
}
