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
import { Plus, ChevronRight, Loader2, ImageIcon } from 'lucide-react'
import type { Event } from '@kuji/types'

const STATUS_LABEL = { draft: '준비중', active: '진행중', closed: '종료' } as const
const STATUS_VARIANT = { draft: 'default', active: 'success', closed: 'warning' } as const

export default function EventsPage() {
  const { account } = useAuthStore()
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)

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

  return (
    <div className="p-8">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">이벤트 관리</h1>
          <p className="mt-1 text-sm text-gray-500">쿠지 이벤트를 생성하고 관리합니다</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus size={16} className="mr-2" />
          이벤트 생성
        </Button>
      </div>

      {/* 이벤트 목록 */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-indigo-600" size={32} />
        </div>
      ) : events.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-gray-400 text-sm">등록된 이벤트가 없습니다</p>
          <Button className="mt-4" onClick={() => setShowCreate(true)}>
            첫 이벤트 만들기
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {events.map((event) => (
            <Link key={event.id} href={`/events/${event.id}`}>
              <Card className="hover:border-indigo-200 hover:shadow-md transition-all cursor-pointer">
                <CardContent className="flex items-center gap-4 py-4">
                  {/* 썸네일 */}
                  <div className="w-12 h-12 rounded-lg border border-gray-100 flex-shrink-0 overflow-hidden bg-gray-50 flex items-center justify-center">
                    {(event as Event & { thumbnailUrl?: string | null }).thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={(event as Event & { thumbnailUrl?: string | null }).thumbnailUrl!}
                        alt={event.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <ImageIcon size={18} className="text-gray-300" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant={STATUS_VARIANT[event.status]}>
                        {STATUS_LABEL[event.status]}
                      </Badge>
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
          ))}
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

function CreateEventModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  onCreated: () => void
}) {
  const [form, setForm] = useState({
    title: '',
    description: '',
    totalCount: '',
    pricePerUnit: '',
    thumbnailUrl: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleClose = () => {
    setForm({ title: '', description: '', totalCount: '', pricePerUnit: '', thumbnailUrl: '' })
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
    if (!form.title || totalCount < 1 || pricePerUnit < 0) {
      setError('올바른 값을 입력해주세요.')
      return
    }
    setLoading(true)
    try {
      await api.post('/events', {
        title: form.title,
        description: form.description || undefined,
        thumbnailUrl: form.thumbnailUrl || undefined,
        totalCount,
        pricePerUnit,
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
        <Input
          name="title"
          label="이벤트명 *"
          placeholder="예: 2026 여름 쿠지"
          value={form.title}
          onChange={handleChange}
          required
        />
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">설명 (선택)</label>
          <textarea
            name="description"
            rows={2}
            placeholder="이벤트 설명을 입력하세요"
            value={form.description}
            onChange={handleChange}
            className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input
            name="totalCount"
            type="number"
            label="전체 번호 수 *"
            placeholder="예: 100"
            min={1}
            max={10000}
            value={form.totalCount}
            onChange={handleChange}
            required
          />
          <Input
            name="pricePerUnit"
            type="number"
            label="장당 가격 (원) *"
            placeholder="예: 5000"
            min={0}
            value={form.pricePerUnit}
            onChange={handleChange}
            required
          />
        </div>
        {/* 썸네일 업로드 */}
        <ImageUpload
          label="썸네일 이미지 (선택)"
          value={form.thumbnailUrl}
          onChange={(url) => setForm((f) => ({ ...f, thumbnailUrl: url }))}
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-2 pt-2">
          <Button type="button" variant="secondary" className="flex-1" onClick={handleClose}>
            취소
          </Button>
          <Button type="submit" className="flex-1" loading={loading}>
            생성
          </Button>
        </div>
      </form>
    </Modal>
  )
}
