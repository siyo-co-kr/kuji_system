'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Ticket, KeyRound } from 'lucide-react'

export default function ChangePasswordPage() {
  const router = useRouter()
  const { token, account, setAccount } = useAuthStore()
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // 비로그인 시 로그인 페이지로
  useEffect(() => {
    if (!token) router.replace('/login')
  }, [token, router])

  // 이미 비밀번호 변경이 완료됐으면 대시보드로
  useEffect(() => {
    if (account && !account.mustChangePassword) {
      router.replace('/events')
    }
  }, [account, router])

  if (!token || !account?.mustChangePassword) return null

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (form.newPassword.length < 8) {
      setError('새 비밀번호는 8자 이상이어야 합니다.')
      return
    }
    if (form.newPassword !== form.confirmPassword) {
      setError('새 비밀번호가 일치하지 않습니다.')
      return
    }
    if (form.currentPassword === form.newPassword) {
      setError('새 비밀번호는 현재 비밀번호와 달라야 합니다.')
      return
    }

    setLoading(true)
    try {
      await api.post('/auth/change-password', {
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      })

      // 스토어에서 mustChangePassword 플래그 해제
      setAccount({ ...account, mustChangePassword: false })
      router.replace('/')
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        '비밀번호 변경에 실패했습니다.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        {/* 로고 */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-indigo-600 rounded-2xl mb-4">
            <Ticket className="text-white" size={28} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">비밀번호 변경</h1>
          <p className="mt-1 text-sm text-gray-500">
            임시 비밀번호로 로그인하셨습니다.<br />
            새 비밀번호를 설정해 주세요.
          </p>
        </div>

        <div className="bg-white rounded-xl border border-amber-200 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4 p-3 bg-amber-50 rounded-lg">
            <KeyRound size={16} className="text-amber-600 flex-shrink-0" />
            <p className="text-sm text-amber-700">
              보안을 위해 지금 바로 새 비밀번호를 설정해야 합니다.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              name="currentPassword"
              type="password"
              label="임시 비밀번호 (현재)"
              placeholder="발급받은 임시 비밀번호 입력"
              value={form.currentPassword}
              onChange={handleChange}
              required
              autoFocus
            />
            <Input
              name="newPassword"
              type="password"
              label="새 비밀번호"
              placeholder="8자 이상"
              value={form.newPassword}
              onChange={handleChange}
              required
            />
            <Input
              name="confirmPassword"
              type="password"
              label="새 비밀번호 확인"
              placeholder="새 비밀번호 재입력"
              value={form.confirmPassword}
              onChange={handleChange}
              required
            />
            {error && (
              <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
            )}
            <Button type="submit" className="w-full" size="lg" loading={loading}>
              비밀번호 변경
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
