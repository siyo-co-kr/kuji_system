'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { formatDate } from '@/lib/utils'
import { CheckCircle2, XCircle, Loader2, Users, Plus, Mail, AlertCircle } from 'lucide-react'
import type { Account } from '@kuji/types'

interface AccountWithStore extends Account {
  mustChangePassword?: boolean
  store?: { id: string; name: string; address?: string | null; phone?: string | null }
}

export default function SuperAdminAccountsPage() {
  const [accounts, setAccounts] = useState<AccountWithStore[]>([])
  const [loading, setLoading] = useState(true)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved'>('pending')
  const [showCreate, setShowCreate] = useState(false)
  const [tempPasswords, setTempPasswords] = useState<Record<string, string>>({})

  const fetchAccounts = async () => {
    try {
      const res = await api.get('/superadmin/accounts')
      setAccounts(res.data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAccounts() }, [])

  const approve = async (id: string) => {
    setProcessingId(id)
    try {
      await api.post(`/superadmin/accounts/${id}/approve`)
      setAccounts((prev) => prev.map((a) => a.id === id ? { ...a, isApproved: true } : a))
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? '승인에 실패했습니다.'
      alert(msg)
    }
    finally { setProcessingId(null) }
  }

  const reject = async (id: string) => {
    if (!confirm('계정을 비활성화하시겠습니까?')) return
    setProcessingId(id)
    try {
      await api.post(`/superadmin/accounts/${id}/reject`)
      setAccounts((prev) => prev.map((a) => a.id === id ? { ...a, isApproved: false } : a))
    } catch { alert('비활성화에 실패했습니다.') }
    finally { setProcessingId(null) }
  }

  const sendTempPassword = async (id: string, email: string) => {
    if (!confirm(`${email} 으로 임시 비밀번호를 발송하시겠습니까?`)) return
    setProcessingId(id)
    try {
      const res = await api.post(`/superadmin/accounts/${id}/send-temp-password`)
      // 이메일 발송 실패 시를 대비해 화면에 임시 비밀번호 표시
      if (res.data.tempPassword) {
        setTempPasswords((prev) => ({ ...prev, [id]: res.data.tempPassword }))
        // mustChangePassword 로 되돌림
        setAccounts((prev) => prev.map((a) => a.id === id ? { ...a, mustChangePassword: true, isApproved: false } : a))
      }
      alert(res.data.message)
    } catch { alert('임시 비밀번호 발송에 실패했습니다.') }
    finally { setProcessingId(null) }
  }

  const filtered = accounts.filter((a) => {
    if (filter === 'pending') return !a.isApproved
    if (filter === 'approved') return a.isApproved
    return true
  })

  const pendingCount = accounts.filter((a) => !a.isApproved).length

  return (
    <div className="p-8">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">계정 관리</h1>
          <p className="mt-1 text-sm text-gray-500">
            전체 {accounts.length}개 계정
            {pendingCount > 0 && (
              <span className="ml-2 text-amber-600 font-medium">· 승인 대기 {pendingCount}개</span>
            )}
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus size={16} className="mr-1.5" />
          계정 생성
        </Button>
      </div>

      {/* 필터 탭 */}
      <div className="flex gap-1 mb-4 bg-gray-100 rounded-lg p-1 w-fit">
        {([
          { key: 'pending', label: `대기중 (${pendingCount})` },
          { key: 'approved', label: `승인됨 (${accounts.length - pendingCount})` },
          { key: 'all', label: `전체 (${accounts.length})` },
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

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-indigo-600" size={32} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <Users className="mx-auto mb-3 text-gray-300" size={40} />
          <p className="text-gray-400 text-sm">
            {filter === 'pending' ? '승인 대기 중인 계정이 없습니다' : '계정이 없습니다'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((account) => {
            const isProcessing = processingId === account.id
            const isSelf = account.role === 'superadmin'
            const needsPasswordChange = account.mustChangePassword
            // 승인 버튼: 비밀번호 변경이 완료된 경우에만 활성화
            const canApprove = !needsPasswordChange && !account.isApproved

            return (
              <Card key={account.id}>
                <CardContent className="py-4">
                  <div className="flex items-start gap-4">
                    {/* 계정 정보 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <Badge variant={account.isApproved ? 'success' : 'warning'}>
                          {account.isApproved ? '승인됨' : '승인 대기'}
                        </Badge>
                        {needsPasswordChange && (
                          <Badge variant="default">비밀번호 변경 필요</Badge>
                        )}
                        {account.role === 'superadmin' && (
                          <Badge variant="info">슈퍼관리자</Badge>
                        )}
                        <span className="font-medium text-gray-900">{account.email}</span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-gray-500 flex-wrap">
                        <span>매장: {account.store?.name ?? '-'}</span>
                        {account.store?.address && <span>주소: {account.store.address}</span>}
                        {account.store?.phone && <span>전화: {account.store.phone}</span>}
                        <span>가입: {formatDate(account.createdAt)}</span>
                      </div>
                      {/* 임시 비밀번호가 발급된 경우 표시 */}
                      {tempPasswords[account.id] && (
                        <div className="mt-2 flex items-center gap-2 text-xs bg-yellow-50 border border-yellow-200 rounded px-3 py-1.5">
                          <AlertCircle size={12} className="text-yellow-600 flex-shrink-0" />
                          <span className="text-yellow-700">임시 비밀번호:</span>
                          <code className="font-mono font-bold text-yellow-900">{tempPasswords[account.id]}</code>
                          <span className="text-yellow-500 ml-1">(이메일 발송 완료 후 삭제하세요)</span>
                        </div>
                      )}
                      {/* 승인 불가 이유 표시 */}
                      {!isSelf && needsPasswordChange && !account.isApproved && (
                        <p className="mt-1.5 text-xs text-amber-600 flex items-center gap-1">
                          <AlertCircle size={11} />
                          비밀번호 변경 완료 후 승인 버튼이 활성화됩니다
                        </p>
                      )}
                    </div>

                    {/* 버튼 영역 — 슈퍼 어드민 자신은 변경 불가 */}
                    {!isSelf && (
                      <div className="flex gap-2 flex-shrink-0 flex-wrap justify-end">
                        {/* 임시 비밀번호 재발급 */}
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => sendTempPassword(account.id, account.email)}
                          loading={isProcessing}
                          disabled={!!processingId}
                          className="gap-1"
                        >
                          <Mail size={13} />
                          임시 비밀번호 발급
                        </Button>

                        {/* 승인 / 비활성화 */}
                        {canApprove ? (
                          <Button
                            size="sm"
                            onClick={() => approve(account.id)}
                            loading={isProcessing}
                            disabled={!!processingId}
                            className="gap-1"
                          >
                            <CheckCircle2 size={14} />
                            승인
                          </Button>
                        ) : account.isApproved ? (
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => reject(account.id)}
                            disabled={!!processingId || isProcessing}
                            className="gap-1"
                          >
                            <XCircle size={14} />
                            비활성화
                          </Button>
                        ) : (
                          // 비밀번호 변경 전 — 승인 버튼 비활성화
                          <Button
                            size="sm"
                            disabled
                            className="gap-1 opacity-40"
                            title="비밀번호 변경 완료 후 활성화됩니다"
                          >
                            <CheckCircle2 size={14} />
                            승인
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* 계정 생성 모달 */}
      <CreateAccountModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={(newAccount, tempPw) => {
          setShowCreate(false)
          fetchAccounts()
          if (tempPw) {
            setTempPasswords((prev) => ({ ...prev, [newAccount.id]: tempPw }))
          }
        }}
      />
    </div>
  )
}

function CreateAccountModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  onCreated: (account: AccountWithStore, tempPw?: string) => void
}) {
  const [form, setForm] = useState({ email: '', storeName: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!form.email || !form.storeName) {
      setError('이메일과 매장명을 모두 입력해주세요.')
      return
    }
    setLoading(true)
    try {
      const res = await api.post('/superadmin/accounts', form)
      onCreated(res.data.account, res.data.tempPassword)
      setForm({ email: '', storeName: '' })
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? '계정 생성에 실패했습니다.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="어드민 계정 생성" className="max-w-sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          name="email"
          type="email"
          label="이메일 (로그인 ID) *"
          placeholder="admin@example.com"
          value={form.email}
          onChange={handleChange}
          required
          autoFocus
        />
        <Input
          name="storeName"
          label="매장명 *"
          placeholder="예: 홍길동 피규어샵"
          value={form.storeName}
          onChange={handleChange}
          required
        />
        <p className="text-xs text-gray-500">
          계정 생성 후 임시 비밀번호가 등록된 이메일로 자동 발송됩니다.<br />
          로그인 후 비밀번호 변경을 완료해야 승인이 가능합니다.
        </p>
        {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
        <div className="flex gap-2 pt-1">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
            취소
          </Button>
          <Button type="submit" className="flex-1" loading={loading}>
            생성 및 발송
          </Button>
        </div>
      </form>
    </Modal>
  )
}
