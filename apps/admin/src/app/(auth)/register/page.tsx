'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Ticket, CheckCircle2 } from 'lucide-react'

type Step = 1 | 2

export default function RegisterPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  // Step 1 — 계정 정보
  const [form1, setForm1] = useState({
    email: '', name: '', phone: '', password: '', passwordConfirm: '',
  })

  // Step 2 — 매장 정보
  const [form2, setForm2] = useState({ storeName: '', storeAddress: '' })

  const change1 = (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm1((f) => ({ ...f, [e.target.name]: e.target.value }))
  const change2 = (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm2((f) => ({ ...f, [e.target.name]: e.target.value }))

  // 1단계 유효성 검사
  const validateStep1 = () => {
    if (!form1.email || !form1.name || !form1.phone || !form1.password || !form1.passwordConfirm) {
      setError('모든 항목을 입력해주세요.')
      return false
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form1.email)) {
      setError('올바른 이메일 형식이 아닙니다.')
      return false
    }
    if (form1.password.length < 8) {
      setError('비밀번호는 8자 이상이어야 합니다.')
      return false
    }
    if (form1.password !== form1.passwordConfirm) {
      setError('비밀번호가 일치하지 않습니다.')
      return false
    }
    return true
  }

  const handleStep1 = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (validateStep1()) setStep(2)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!form2.storeName || !form2.storeAddress) {
      setError('매장명과 주소를 입력해주세요.')
      return
    }
    setLoading(true)
    try {
      await api.post('/auth/register', { ...form1, ...form2 })
      setDone(true)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
        ?? '회원가입에 실패했습니다.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-sm text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
            <CheckCircle2 className="text-green-600" size={32} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">가입 완료!</h1>
          <p className="text-gray-500 text-sm mb-6">
            슈퍼 어드민의 승인 후 서비스를 이용할 수 있습니다.<br />
            승인 완료 시 등록하신 이메일로 안내해 드립니다.
          </p>
          <Button className="w-full" onClick={() => router.replace('/login')}>
            로그인 화면으로
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        {/* 로고 */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-indigo-600 rounded-2xl mb-4">
            <Ticket className="text-white" size={28} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">회원가입</h1>
          <p className="mt-1 text-sm text-gray-500">쿠지 어드민 계정을 생성합니다</p>
        </div>

        {/* 단계 표시 */}
        <div className="flex items-center gap-2 mb-6">
          <StepDot n={1} active={step === 1} done={step > 1} label="계정 정보" />
          <div className="flex-1 h-px bg-gray-200" />
          <StepDot n={2} active={step === 2} done={false} label="매장 정보" />
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          {/* Step 1 */}
          {step === 1 && (
            <form onSubmit={handleStep1} className="space-y-4">
              <Input id="email" name="email" type="email" label="이메일 *"
                placeholder="admin@example.com" value={form1.email}
                onChange={change1} required autoFocus />
              <Input id="name" name="name" label="이름 *"
                placeholder="홍길동" value={form1.name}
                onChange={change1} required />
              <Input id="phone" name="phone" label="전화번호 *"
                placeholder="010-1234-5678" value={form1.phone}
                onChange={change1} required />
              <Input id="password" name="password" type="password" label="비밀번호 * (8자 이상)"
                placeholder="••••••••" value={form1.password}
                onChange={change1} required />
              <Input id="passwordConfirm" name="passwordConfirm" type="password" label="비밀번호 확인 *"
                placeholder="••••••••" value={form1.passwordConfirm}
                onChange={change1} required />
              {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
              <Button type="submit" className="w-full" size="lg">
                다음 →
              </Button>
            </form>
          )}

          {/* Step 2 */}
          {step === 2 && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input id="storeName" name="storeName" label="매장명 *"
                placeholder="예: 홍길동 피규어샵" value={form2.storeName}
                onChange={change2} required autoFocus />
              <Input id="storeAddress" name="storeAddress" label="매장 주소 *"
                placeholder="서울시 마포구 ..." value={form2.storeAddress}
                onChange={change2} required />
              {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
              <div className="flex gap-2">
                <Button type="button" variant="secondary" className="flex-1"
                  onClick={() => { setStep(1); setError('') }}>
                  ← 이전
                </Button>
                <Button type="submit" className="flex-1" size="lg" loading={loading}>
                  가입 신청
                </Button>
              </div>
            </form>
          )}
        </div>

        <p className="text-center text-sm text-gray-500 mt-4">
          이미 계정이 있으신가요?{' '}
          <Link href="/login" className="text-indigo-600 hover:underline font-medium">
            로그인
          </Link>
        </p>
      </div>
    </div>
  )
}

function StepDot({ n, active, done, label }: {
  n: number; active: boolean; done: boolean; label: string
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
        done    ? 'bg-green-500 text-white' :
        active  ? 'bg-indigo-600 text-white' :
                  'bg-gray-100 text-gray-400'
      }`}>
        {done ? '✓' : n}
      </div>
      <span className={`text-xs ${active ? 'text-indigo-600 font-medium' : 'text-gray-400'}`}>
        {label}
      </span>
    </div>
  )
}
