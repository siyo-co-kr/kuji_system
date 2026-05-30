'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'
import { Loader2, Users, CheckCircle2, Clock, CalendarDays, Megaphone, Pin } from 'lucide-react'

interface Notice {
  id: string; title: string; content: string; isPinned: boolean; createdAt: string
}

// ── 슈퍼어드민 ──────────────────────────────────────────────

interface SuperAdminData {
  role: 'superadmin'
  accounts: { total: number; approved: number; pending: number }
  notices: Notice[]
}

function SuperAdminDashboard({ data }: { data: SuperAdminData }) {
  const cards = [
    { label: '전체 가입자', value: data.accounts.total,    icon: Users,        color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: '승인된 계정', value: data.accounts.approved, icon: CheckCircle2, color: 'text-green-600',  bg: 'bg-green-50'  },
    { label: '승인 대기',   value: data.accounts.pending,  icon: Clock,        color: 'text-amber-600',  bg: 'bg-amber-50'  },
  ]

  return (
    <div className="p-8 max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">대시보드</h1>
        <p className="mt-1 text-sm text-gray-500">전체 서비스 현황을 확인합니다</p>
      </div>
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">계정 현황</h2>
        <div className="grid grid-cols-3 gap-4">
          {cards.map(({ label, value, icon: Icon, color, bg }) => (
            <Card key={label}>
              <CardContent className="py-5">
                <div className={`inline-flex items-center justify-center w-10 h-10 rounded-xl ${bg} mb-3`}>
                  <Icon size={20} className={color} />
                </div>
                <p className="text-3xl font-bold text-gray-900">{value.toLocaleString()}</p>
                <p className="text-sm text-gray-500 mt-0.5">{label}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
      <NoticeSection notices={data.notices} />
    </div>
  )
}

// ── 어드민 ───────────────────────────────────────────────────

interface AdminData {
  role: 'admin'
  events: { total: number; active: number; draft: number; closed: number }
  notices: Notice[]
}

function AdminDashboard({ data }: { data: AdminData }) {
  const eventCards = [
    { label: '전체',   value: data.events.total,  variant: 'default'  as const },
    { label: '진행중', value: data.events.active,  variant: 'success'  as const },
    { label: '준비중', value: data.events.draft,   variant: 'default'  as const },
    { label: '종료',   value: data.events.closed,  variant: 'warning'  as const },
  ]

  return (
    <div className="p-8 max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">대시보드</h1>
        <p className="mt-1 text-sm text-gray-500">매장 운영 현황을 확인합니다</p>
      </div>
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
          <CalendarDays size={14} /> 이벤트 현황
        </h2>
        <div className="grid grid-cols-4 gap-3">
          {eventCards.map(({ label, value, variant }) => (
            <Card key={label}>
              <CardContent className="py-4 text-center">
                <p className="text-3xl font-bold text-gray-900">{value.toLocaleString()}</p>
                <div className="mt-1.5 flex justify-center">
                  <Badge variant={variant}>{label}</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
      <NoticeSection notices={data.notices} />
    </div>
  )
}

// ── 공지사항 공통 섹션 ────────────────────────────────────────

function NoticeSection({ notices }: { notices: Notice[] }) {
  if (notices.length === 0) return null

  return (
    <section>
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
        <Megaphone size={14} /> 공지사항
      </h2>
      <div className="space-y-2">
        {notices.map((n) => (
          <div key={n.id} className="bg-white rounded-xl border border-gray-200 px-5 py-4">
            <div className="flex items-start gap-2">
              {n.isPinned && <Pin size={13} className="text-indigo-500 flex-shrink-0 mt-0.5" />}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 text-sm">{n.title}</p>
                <p className="text-sm text-gray-600 mt-1 whitespace-pre-line line-clamp-3">{n.content}</p>
                <p className="text-xs text-gray-400 mt-2">{formatDate(n.createdAt)}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

// ── 페이지 진입점 ────────────────────────────────────────────

export default function DashboardPage() {
  const [data, setData] = useState<SuperAdminData | AdminData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/dashboard')
      .then((r) => setData(r.data))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="animate-spin text-indigo-600" size={32} />
      </div>
    )
  }

  if (!data) return null

  return data.role === 'superadmin'
    ? <SuperAdminDashboard data={data as SuperAdminData} />
    : <AdminDashboard data={data as AdminData} />
}
