'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth'
import { CalendarDays, CreditCard, LogOut, Ticket, Store, Users, ShieldCheck } from 'lucide-react'

const baseNavItems = [
  { href: '/events', label: '이벤트 관리', icon: CalendarDays },
  { href: '/payments', label: '결제 승인', icon: CreditCard },
]

const superAdminNavItems = [
  { href: '/superadmin/stores', label: '전체 매장 현황', icon: Store },
  { href: '/superadmin/accounts', label: '계정 관리', icon: Users },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { account, logout } = useAuthStore()

  const isSuperAdmin = account?.role === 'superadmin'

  const handleLogout = () => {
    logout()
    router.replace('/login')
  }

  const NavLink = ({ href, label, icon: Icon }: { href: string; label: string; icon: React.ElementType }) => (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
        pathname.startsWith(href)
          ? 'bg-indigo-50 text-indigo-700'
          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
      )}
    >
      <Icon size={18} />
      {label}
    </Link>
  )

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
          <>
            <div className="pt-3 pb-1">
              <div className="flex items-center gap-1.5 px-3 mb-1">
                <ShieldCheck size={12} className="text-indigo-400" />
                <p className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">슈퍼 어드민</p>
              </div>
              {superAdminNavItems.map((item) => <NavLink key={item.href} {...item} />)}
            </div>
          </>
        )}
      </nav>

      {/* 사용자 정보 + 로그아웃 */}
      <div className="px-3 py-4 border-t border-gray-200">
        <div className="px-3 py-2 mb-1">
          <p className="text-xs font-medium text-gray-900 truncate">{account?.email}</p>
          <p className="text-xs text-gray-500 flex items-center gap-1">
            {isSuperAdmin && <ShieldCheck size={11} className="text-indigo-500" />}
            {isSuperAdmin ? '슈퍼관리자' : '관리자'}
          </p>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
        >
          <LogOut size={18} />
          로그아웃
        </button>
      </div>
    </aside>
  )
}
