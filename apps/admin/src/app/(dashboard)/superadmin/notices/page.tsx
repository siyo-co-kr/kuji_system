'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { formatDate } from '@/lib/utils'
import { Plus, Pencil, Trash2, Loader2, Megaphone, Pin } from 'lucide-react'

interface Notice {
  id: string; title: string; content: string; isPinned: boolean
  createdAt: string; updatedAt: string
}

export default function NoticesPage() {
  const [notices, setNotices] = useState<Notice[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Notice | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  const fetchNotices = async () => {
    const res = await api.get('/notices?limit=50')
    setNotices(res.data)
    setLoading(false)
  }

  useEffect(() => { fetchNotices() }, [])

  const handleDelete = async (id: string) => {
    if (!confirm('공지사항을 삭제하시겠습니까?')) return
    await api.delete(`/notices/${id}`)
    setNotices((prev) => prev.filter((n) => n.id !== id))
  }

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">공지사항 관리</h1>
          <p className="mt-1 text-sm text-gray-500">전체 어드민에게 공지할 내용을 관리합니다</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus size={16} className="mr-1.5" />
          공지 등록
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-indigo-600" size={32} />
        </div>
      ) : notices.length === 0 ? (
        <div className="text-center py-20">
          <Megaphone className="mx-auto mb-3 text-gray-300" size={40} />
          <p className="text-gray-400 text-sm">등록된 공지사항이 없습니다</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notices.map((notice) => (
            <Card key={notice.id}>
              <CardContent className="py-4">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {notice.isPinned && (
                        <Badge variant="info" className="flex items-center gap-1">
                          <Pin size={10} /> 고정
                        </Badge>
                      )}
                      <p className="font-semibold text-gray-900 text-sm">{notice.title}</p>
                    </div>
                    <p className="text-sm text-gray-600 whitespace-pre-line line-clamp-2">{notice.content}</p>
                    <p className="text-xs text-gray-400 mt-2">{formatDate(notice.createdAt)}</p>
                  </div>
                  <div className="flex gap-1.5 flex-shrink-0">
                    <Button size="sm" variant="secondary" onClick={() => setEditing(notice)}>
                      <Pencil size={13} />
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => handleDelete(notice.id)}>
                      <Trash2 size={13} />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 생성 모달 */}
      <NoticeFormModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSaved={() => { setShowCreate(false); fetchNotices() }}
      />

      {/* 수정 모달 */}
      {editing && (
        <NoticeFormModal
          open={!!editing}
          notice={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); fetchNotices() }}
        />
      )}
    </div>
  )
}

function NoticeFormModal({
  open, notice, onClose, onSaved,
}: {
  open: boolean
  notice?: Notice
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = !!notice
  const [form, setForm] = useState({
    title: notice?.title ?? '',
    content: notice?.content ?? '',
    isPinned: notice?.isPinned ?? false,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!form.title.trim() || !form.content.trim()) {
      setError('제목과 내용을 입력해주세요.')
      return
    }
    setLoading(true)
    try {
      if (isEdit) {
        await api.patch(`/notices/${notice!.id}`, form)
      } else {
        await api.post('/notices', form)
      }
      onSaved()
    } catch {
      setError('저장에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? '공지 수정' : '공지 등록'} className="max-w-lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="제목 *"
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          placeholder="공지 제목"
          required
        />
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">내용 *</label>
          <textarea
            rows={6}
            value={form.content}
            onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
            placeholder="공지 내용을 입력하세요"
            className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            required
          />
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={form.isPinned}
            onChange={(e) => setForm((f) => ({ ...f, isPinned: e.target.checked }))}
            className="rounded border-gray-300 text-indigo-600"
          />
          <span className="text-sm text-gray-700 flex items-center gap-1">
            <Pin size={13} className="text-indigo-500" /> 상단 고정
          </span>
        </label>
        {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
        <div className="flex gap-2 pt-1">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>취소</Button>
          <Button type="submit" className="flex-1" loading={loading}>
            {isEdit ? '수정' : '등록'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
