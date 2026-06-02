'use client'
import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth'
import { api } from '@/lib/api'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { CalendarDays, LogOut, Ticket, Store, Users, ShieldCheck, Settings, Megaphone, LayoutDashboard, Gift, Monitor, KeyRound } from 'lucide-react'

const baseNavItems = [
  { href: '/',        label: '대시보드',      icon: LayoutDashboard },
  { href: '/events',  label: '이벤트 관리',    icon: CalendarDays },
  { href: '/prizes',  label: '경품 카탈로그',  icon: Gift },
  { href: '/display', label: '디스플레이 설정', icon: Monitor },
]

const superAdminNavItems = [
  { href: '/',                     label: '대시보드',       icon: LayoutDashboard },
  { href: '/superadmin/stores',    label: '전체 매장 현황', icon: Store },
  { href: '/superadmin/accounts',  label: '계정 관리',      icon: Users },
  { href: '/superadmin/notices',   label: '공지사항 관리',  icon: Megaphone },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { account, setAccount, logout } = useAuthStore()
  const [showProfile, setShowProfile] = useState(false)
  const [showChangePassword, setShowChangePassword] = useState(false)

  const isSuperAdmin = account?.role === 'superadmin'

  const handleLogout = () => {
    logout()
    router.replace('/login')
  }

  const NavLink = ({ href, label, icon: Icon }: { href: string; label: string; icon: React.ElementType }) => {
    // 대시보드(/)는 정확히 일치할 때만 활성화, 나머지는 startsWith
    const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href)
    return (
      <Link
        href={href}
        className={cn(
          'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
          isActive
            ? 'bg-indigo-50 text-indigo-700'
            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
        )}
      >
        <Icon size={18} />
        {label}
      </Link>
    )
  }

  return (
    <aside className="w-60 flex flex-col h-full bg-white border-r border-gray-200">
      {/* 로고 */}
      <div className="px-6 py-5 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <Ticket className="text-indigo-600" size={22} />
          <span className="text-lg font-bold text-gray-900">쿠지 어드민</span>
        </div>
        {account?.store && (
          <p className="mt-1 text-xs text-gray-500 truncate">{account.store.name}</p>
        )}
      </div>

      {/* 네비게이션 */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {/* 기본 메뉴 — 슈퍼 어드민은 이벤트/결제 메뉴 불필요 */}
        {!isSuperAdmin && baseNavItems.map((item) => <NavLink key={item.href} {...item} />)}

        {/* 슈퍼 어드민 전용 메뉴 */}
        {isSuperAdmin && (
          <div className="pt-3 pb-1">
            <div className="flex items-center gap-1.5 px-3 mb-1">
              <ShieldCheck size={12} className="text-indigo-400" />
              <p className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">슈퍼 어드민</p>
            </div>
            {superAdminNavItems.map((item) => <NavLink key={item.href} {...item} />)}
          </div>
        )}
      </nav>

      {/* 사용자 정보 + 버튼들 */}
      <div className="px-3 py-4 border-t border-gray-200">
        <div className="px-3 py-2 mb-1">
          <p className="text-xs font-medium text-gray-900 truncate">{account?.email}</p>
          <p className="text-xs text-gray-500 flex items-center gap-1">
            {isSuperAdmin && <ShieldCheck size={11} className="text-indigo-500" />}
            {isSuperAdmin ? '슈퍼관리자' : '관리자'}
          </p>
        </div>
        {/* 일반 어드민만 매장 정보 수정 버튼 표시 */}
        {!isSuperAdmin && (
          <button
            onClick={() => setShowProfile(true)}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
          >
            <Settings size={18} />
            매장 정보 수정
          </button>
        )}
        {/* 비밀번호 변경 (모든 어드민) */}
        <button
          onClick={() => setShowChangePassword(true)}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
        >
          <KeyRound size={18} />
          비밀번호 변경
        </button>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
        >
          <LogOut size={18} />
          로그아웃
        </button>
      </div>

      {/* 매장 정보 수정 모달 */}
      {!isSuperAdmin && (
        <StoreProfileModal
          open={showProfile}
          onClose={() => setShowProfile(false)}
          currentStore={account?.store}
          onSaved={(store) => {
            if (account) setAccount({ ...account, store: { ...account.store, ...store } })
            setShowProfile(false)
          }}
        />
      )}

      {/* 비밀번호 변경 모달 */}
      <ChangePasswordModal
        open={showChangePassword}
        onClose={() => setShowChangePassword(false)}
      />
    </aside>
  )
}

function StoreProfileModal({
  open, onClose, currentStore, onSaved,
}: {
  open: boolean
  onClose: () => void
  currentStore?: { id: string; name: string }
  onSaved: (store: { id: string; name: string }) => void
}) {
  const [form, setForm] = useState({ name: '', address: '', phone: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [fetchedStore, setFetchedStore] = useState<{ name: string; address?: string | null; phone?: string | null } | null>(null)

  // 모달 열릴 때 현재 매장 정보 로드
  const handleOpen = async () => {
    try {
      const res = await api.get('/stores/my')
      const s = res.data
      setFetchedStore(s)
      setForm({ name: s.name ?? '', address: s.address ?? '', phone: s.phone ?? '' })
    } catch {
      setForm({ name: currentStore?.name ?? '', address: '', phone: '' })
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!form.name.trim()) { setError('매장명은 필수입니다.'); return }
    setLoading(true)
    try {
      const res = await api.patch('/stores/my', {
        name:    form.name    || undefined,
        address: form.address || null,
        phone:   form.phone   || null,
      })
      onSaved(res.data.store)
    } catch {
      setError('저장에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="매장 정보 수정"
      className="max-w-sm"
      onOpenChange={handleOpen}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          name="name"
          label="매장명 *"
          placeholder="매장명"
          value={form.name}
          onChange={handleChange}
          required
        />
        <Input
          name="address"
          label="주소"
          placeholder="예: 서울시 마포구 ..."
          value={form.address}
          onChange={handleChange}
        />
        <Input
          name="phone"
          label="전화번호"
          placeholder="예: 010-1234-5678"
          value={form.phone}
          onChange={handleChange}
        />
        {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
        <div className="flex gap-2 pt-1">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>취소</Button>
          <Button type="submit" className="flex-1" loading={loading}>저장</Button>
        </div>
      </form>
    </Modal>
  )
}

// ── 비밀번호 변경 모달 ─────────────────────────────────────────

function ChangePasswordModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleClose = () => {
    setForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
    setError('')
    setSuccess(false)
    onClose()
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (form.newPassword.length < 8) { setError('새 비밀번호는 8자 이상이어야 합니다.'); return }
    if (form.newPassword !== form.confirmPassword) { setError('새 비밀번호가 일치하지 않습니다.'); return }
    if (form.currentPassword === form.newPassword) { setError('현재 비밀번호와 다른 비밀번호를 입력해주세요.'); return }
    setLoading(true)
    try {
      await api.post('/auth/change-password', {
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      })
      setSuccess(true)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
        ?? '비밀번호 변경에 실패했습니다.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title="비밀번호 변경" className="max-w-sm">
      {success ? (
        <div className="text-center py-4">
          <p className="text-3xl mb-3">✅</p>
          <p className="font-semibold text-gray-900 mb-1">비밀번호가 변경됐습니다</p>
          <p className="text-sm text-gray-500 mb-4">다음 로그인부터 새 비밀번호를 사용하세요.</p>
          <Button className="w-full" onClick={handleClose}>확인</Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input name="currentPassword" type="password" label="현재 비밀번호"
            value={form.currentPassword} onChange={handleChange} required autoFocus />
          <Input name="newPassword" type="password" label="변경할 비밀번호 (8자 이상)"
            value={form.newPassword} onChange={handleChange} required />
          <Input name="confirmPassword" type="password" label="변경할 비밀번호 확인"
            value={form.confirmPassword} onChange={handleChange} required />
          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
          <div className="flex gap-2 pt-1">
            <Button type="button" variant="secondary" className="flex-1" onClick={handleClose}>취소</Button>
            <Button type="submit" className="flex-1" loading={loading}>변경</Button>
          </div>
        </form>
      )}
    </Modal>
  )
}
