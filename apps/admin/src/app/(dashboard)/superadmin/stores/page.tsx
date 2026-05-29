'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatPrice } from '@/lib/utils'
import { Store, CalendarDays, Loader2, ChevronDown, ChevronUp } from 'lucide-react'

const STATUS_LABEL = { draft: '준비중', active: '진행중', closed: '종료' } as const
const STATUS_VARIANT = { draft: 'default', active: 'success', closed: 'warning' } as const

interface StoreWithEvents {
  id: string
  name: string
  address?: string
  phone?: string
  createdAt: string
  _count: { events: number }
  accounts: { id: string; email: string; role: string; isApproved: boolean }[]
  events: {
    id: string
    title: string
    status: 'draft' | 'active' | 'closed'
    totalCount: number
    pricePerUnit: number
    _count: { kujiNumbers: number }
  }[]
}

export default function SuperAdminStoresPage() {
  const [stores, setStores] = useState<StoreWithEvents[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  useEffect(() => {
    api.get('/superadmin/stores')
      .then((r) => setStores(r.data))
      .finally(() => setLoading(false))
  }, [])

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="animate-spin text-indigo-600" size={32} />
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">전체 매장 현황</h1>
        <p className="mt-1 text-sm text-gray-500">
          총 {stores.length}개 매장 · 이벤트 {stores.reduce((s, st) => s + st._count.events, 0)}개
        </p>
      </div>

      {stores.length === 0 ? (
        <p className="text-gray-400 text-sm text-center py-20">등록된 매장이 없습니다.</p>
      ) : (
        <div className="space-y-4">
          {stores.map((store) => {
            const isOpen = expanded.has(store.id)
            const activeEvents = store.events.filter((e) => e.status === 'active')

            return (
              <Card key={store.id}>
                {/* 매장 헤더 — 클릭으로 펼치기/접기 */}
                <button
                  className="w-full text-left"
                  onClick={() => toggle(store.id)}
                >
                  <CardContent className="flex items-center gap-4 py-4">
                    <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Store size={20} className="text-indigo-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900">{store.name}</span>
                        {activeEvents.length > 0 && (
                          <Badge variant="success">진행중 {activeEvents.length}</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-gray-500 mt-0.5">
                        <span className="flex items-center gap-1">
                          <CalendarDays size={11} />
                          이벤트 {store._count.events}개
                        </span>
                        <span>계정 {store.accounts.length}개</span>
                        {store.address && <span>{store.address}</span>}
                      </div>
                    </div>
                    {isOpen
                      ? <ChevronUp size={18} className="text-gray-400 flex-shrink-0" />
                      : <ChevronDown size={18} className="text-gray-400 flex-shrink-0" />
                    }
                  </CardContent>
                </button>

                {/* 펼쳐진 상세 */}
                {isOpen && (
                  <div className="border-t border-gray-100 px-6 py-4 space-y-4">
                    {/* 이벤트 목록 */}
                    {store.events.length === 0 ? (
                      <p className="text-sm text-gray-400">등록된 이벤트 없음</p>
                    ) : (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase mb-2">이벤트</p>
                        <div className="space-y-2">
                          {store.events.map((ev) => (
                            <div key={ev.id} className="flex items-center gap-3 text-sm">
                              <Badge variant={STATUS_VARIANT[ev.status]}>
                                {STATUS_LABEL[ev.status]}
                              </Badge>
                              <span className="flex-1 text-gray-800 truncate">{ev.title}</span>
                              <span className="text-gray-500 text-xs">
                                남은 번호 {ev._count.kujiNumbers} / {ev.totalCount}장
                              </span>
                              <span className="text-gray-500 text-xs">
                                {formatPrice(ev.pricePerUnit)}/장
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 계정 목록 */}
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase mb-2">계정</p>
                      <div className="space-y-1.5">
                        {store.accounts.map((acc) => (
                          <div key={acc.id} className="flex items-center gap-2 text-sm">
                            <Badge variant={acc.isApproved ? 'success' : 'warning'}>
                              {acc.isApproved ? '승인됨' : '대기중'}
                            </Badge>
                            <span className="text-gray-700">{acc.email}</span>
                            <span className="text-xs text-gray-400">
                              {acc.role === 'superadmin' ? '슈퍼관리자' : '관리자'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
