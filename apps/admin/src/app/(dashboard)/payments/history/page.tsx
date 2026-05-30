'use client'
import { useEffect, useState, useCallback } from 'react'
import { api } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatPrice, formatDate } from '@/lib/utils'
import { Loader2, Receipt, ChevronLeft, ChevronRight } from 'lucide-react'

type PaymentStatus = 'pending' | 'confirmed' | 'cancelled'
type StatusFilter = 'all' | PaymentStatus

interface Payment {
  id: string
  totalAmount: number
  method: 'app_simple' | 'app_card' | 'manual'
  status: PaymentStatus
  requestedAt: string
  confirmedAt: string | null
  ticketCount: number
  eventTitle: string
  eventDeleted: boolean
}

interface Pagination { total: number; page: number; limit: number; totalPages: number }

const METHOD_LABEL = { app_simple: '앱 간편', app_card: '앱 카드', manual: '별도 결제' } as const
const METHOD_VARIANT = { app_simple: 'info', app_card: 'info', manual: 'default' } as const
const STATUS_LABEL = { pending: '대기중', confirmed: '확인됨', cancelled: '취소됨' } as const
const STATUS_VARIANT = { pending: 'warning', confirmed: 'success', cancelled: 'default' } as const

export default function PaymentHistoryPage() {
  const [payments, setPayments] = useState<Payment[]>([])
  const [pagination, setPagination] = useState<Pagination>({ total: 0, page: 1, limit: 30, totalPages: 1 })
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<StatusFilter>('all')

  const fetchHistory = useCallback(async (page = 1, status: StatusFilter = filter) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '30' })
      if (status !== 'all') params.set('status', status)
      const res = await api.get(`/payments/history?${params}`)
      setPayments(res.data.data)
      setPagination(res.data.pagination)
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => { fetchHistory(1, filter) }, [filter])

  const filterTabs: { key: StatusFilter; label: string }[] = [
    { key: 'all',       label: `전체 (${filter === 'all' ? pagination.total : '…'})` },
    { key: 'confirmed', label: '확인됨' },
    { key: 'pending',   label: '대기중' },
    { key: 'cancelled', label: '취소됨' },
  ]

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">결제 내역</h1>
        <p className="mt-1 text-sm text-gray-500">전체 결제 기록을 조회합니다</p>
      </div>

      {/* 필터 탭 */}
      <div className="flex gap-1 mb-5 bg-gray-100 rounded-lg p-1 w-fit">
        {filterTabs.map(({ key, label }) => (
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

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-indigo-600" size={32} />
        </div>
      ) : payments.length === 0 ? (
        <div className="text-center py-20">
          <Receipt className="mx-auto mb-3 text-gray-300" size={40} />
          <p className="text-gray-400 text-sm">결제 내역이 없습니다</p>
        </div>
      ) : (
        <>
          {/* 요약 */}
          <p className="text-xs text-gray-500 mb-3">
            총 {pagination.total.toLocaleString()}건 ·{' '}
            합계 {formatPrice(payments.filter(p => p.status === 'confirmed').reduce((s, p) => s + p.totalAmount, 0))}
            <span className="text-gray-400"> (현재 페이지 확인됨 기준)</span>
          </p>

          <div className="space-y-2">
            {payments.map((p) => (
              <Card key={p.id}>
                <CardContent className="py-3.5">
                  <div className="flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <Badge variant={STATUS_VARIANT[p.status]}>{STATUS_LABEL[p.status]}</Badge>
                        <Badge variant={METHOD_VARIANT[p.method]}>{METHOD_LABEL[p.method]}</Badge>
                        <span className="text-sm font-medium text-gray-900 truncate">
                          {p.eventTitle}
                          {p.eventDeleted && (
                            <span className="ml-1 text-xs text-gray-400">(삭제됨)</span>
                          )}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span>{formatDate(p.requestedAt)}</span>
                        <span>{p.ticketCount}장</span>
                        {p.confirmedAt && <span>확인: {formatDate(p.confirmedAt)}</span>}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-bold text-gray-900">{formatPrice(p.totalAmount)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* 페이지네이션 */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <Button
                size="sm" variant="secondary"
                disabled={pagination.page <= 1}
                onClick={() => fetchHistory(pagination.page - 1)}
              >
                <ChevronLeft size={15} />
              </Button>
              <div className="flex gap-1">
                {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
                  .filter((p) => Math.abs(p - pagination.page) <= 2)
                  .map((p) => (
                    <button
                      key={p}
                      onClick={() => fetchHistory(p)}
                      className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                        p === pagination.page ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
              </div>
              <Button
                size="sm" variant="secondary"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => fetchHistory(pagination.page + 1)}
              >
                <ChevronRight size={15} />
              </Button>
              <span className="text-xs text-gray-400 ml-1">
                {pagination.page} / {pagination.totalPages} 페이지
              </span>
            </div>
          )}
        </>
      )}
    </div>
  )
}
