'use client'
import { useEffect, useState, useCallback } from 'react'
import { api } from '@/lib/api'
import { connectSocket, disconnectSocket } from '@/lib/socket'
import { useAuthStore } from '@/stores/auth'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatPrice, formatDate } from '@/lib/utils'
import { CheckCircle2, XCircle, Clock, Wifi, Loader2, Gift } from 'lucide-react'

interface PendingPayment {
  id: string
  eventId: string
  totalAmount: number
  paidCount: number
  bonusCount: number
  method: string
  status: string
  requestedAt: string
  event: { id: string; title: string; bonusEnabled: boolean }
  paymentNumbers: {
    kujiNumber: { id: string; number: number }
    isBonus: boolean
  }[]
}

export default function PaymentsPage() {
  const { account } = useAuthStore()
  const [payments, setPayments] = useState<PendingPayment[]>([])
  const [loading, setLoading] = useState(true)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)

  const fetchPending = useCallback(async () => {
    try {
      const res = await api.get('/payments/pending')
      setPayments(res.data)
    } finally {
      setLoading(false)
    }
  }, [])

  // 소켓 연결 + 실시간 대기 결제 수신
  useEffect(() => {
    if (!account?.store.id) return

    const socket = connectSocket()

    socket.on('connect', () => setConnected(true))
    socket.on('disconnect', () => setConnected(false))

    // 어드민 스토어 방 입장
    socket.emit('admin:join', account.store.id)

    // 새 수동 결제 요청 실시간 수신
    socket.on('payment:pending', ({ payment }) => {
      setPayments((prev) => {
        if (prev.find((p) => p.id === payment.id)) return prev
        return [payment as unknown as PendingPayment, ...prev]
      })
    })

    // 결제 취소 실시간 반영
    socket.on('payment:cancelled', ({ paymentId }) => {
      setPayments((prev) => prev.filter((p) => p.id !== paymentId))
    })

    fetchPending()

    return () => {
      socket.off('payment:pending')
      socket.off('payment:cancelled')
      disconnectSocket()
    }
  }, [account, fetchPending])

  const confirm = async (paymentId: string) => {
    setProcessingId(paymentId)
    try {
      await api.post(`/payments/${paymentId}/confirm`)
      setPayments((prev) => prev.filter((p) => p.id !== paymentId))
    } catch {
      alert('결제 승인에 실패했습니다.')
    } finally {
      setProcessingId(null)
    }
  }

  const cancel = async (paymentId: string) => {
    if (!confirm('결제를 거절하시겠습니까?')) return
    setProcessingId(paymentId)
    try {
      await api.post(`/payments/${paymentId}/cancel`)
      setPayments((prev) => prev.filter((p) => p.id !== paymentId))
    } catch {
      alert('결제 거절에 실패했습니다.')
    } finally {
      setProcessingId(null)
    }
  }

  return (
    <div className="p-8">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">결제 승인</h1>
          <p className="mt-1 text-sm text-gray-500">별도 결제(계좌이체 등) 확인 후 승인해주세요</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Wifi size={16} className={connected ? 'text-green-500' : 'text-gray-400'} />
          <span className={connected ? 'text-green-600' : 'text-gray-400'}>
            {connected ? '실시간 연결됨' : '연결 중...'}
          </span>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-indigo-600" size={32} />
        </div>
      ) : payments.length === 0 ? (
        <div className="text-center py-20">
          <Clock className="mx-auto mb-3 text-gray-300" size={40} />
          <p className="text-gray-400 text-sm">대기 중인 결제가 없습니다</p>
          <p className="text-gray-300 text-xs mt-1">새 결제 요청이 오면 자동으로 표시됩니다</p>
        </div>
      ) : (
        <div className="space-y-4">
          {payments.map((payment) => {
            const isProcessing = processingId === payment.id
            const paidNumbers  = payment.paymentNumbers.filter((pn) => !pn.isBonus).map((pn) => pn.kujiNumber.number).sort((a, b) => a - b)
            const bonusNumbers = payment.paymentNumbers.filter((pn) => pn.isBonus).map((pn) => pn.kujiNumber.number).sort((a, b) => a - b)

            return (
              <Card key={payment.id}>
                <CardContent className="py-5">
                  <div className="flex items-start justify-between gap-4">
                    {/* 결제 정보 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="warning">승인 대기</Badge>
                        <span className="font-semibold text-gray-900">
                          {payment.event.title}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm text-gray-600 mb-3">
                        <div>
                          <span className="text-gray-400">결제금액</span>{' '}
                          <span className="font-semibold text-gray-900">
                            {formatPrice(payment.totalAmount)}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-400">장수</span>{' '}
                          <span className="font-semibold text-gray-900">
                            {paidNumbers.length}장
                            {bonusNumbers.length > 0 && (
                              <span className="ml-1 text-amber-600">+{bonusNumbers.length} 보너스</span>
                            )}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-400">요청시간</span>{' '}
                          {formatDate(payment.requestedAt)}
                        </div>
                        <div>
                          <span className="text-gray-400">방식</span>{' '}
                          별도 결제
                        </div>
                      </div>
                      {/* 선택된 번호 */}
                      <div className="space-y-2">
                        <div>
                          <p className="text-xs text-gray-400 mb-1">선택 번호 ({paidNumbers.length}장)</p>
                          <div className="flex flex-wrap gap-1">
                            {paidNumbers.map((num) => (
                              <span key={num} className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-semibold">
                                {num}
                              </span>
                            ))}
                          </div>
                        </div>
                        {bonusNumbers.length > 0 && (
                          <div>
                            <p className="text-xs text-amber-500 mb-1 flex items-center gap-1">
                              <Gift size={11} /> 보너스 번호 ({bonusNumbers.length}장 무료)
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {bonusNumbers.map((num) => (
                                <span key={num} className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 text-xs font-semibold">
                                  {num}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 승인/거절 버튼 */}
                    <div className="flex flex-col gap-2 flex-shrink-0">
                      <Button
                        onClick={() => confirm(payment.id)}
                        loading={isProcessing}
                        disabled={!!processingId}
                        className="gap-1.5"
                      >
                        <CheckCircle2 size={15} />
                        승인
                      </Button>
                      <Button
                        variant="danger"
                        onClick={() => cancel(payment.id)}
                        disabled={!!processingId}
                        className="gap-1.5"
                      >
                        <XCircle size={15} />
                        거절
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
