'use client'
import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuthStore } from '@/stores/auth'
import { Loader2 } from 'lucide-react'

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { token, account, _hasHydrated } = useAuthStore()

  useEffect(() => {
    // 하이드레이션 완료 전에는 판단하지 않음
    if (!_hasHydrated) return

    if (!token) {
      router.replace('/login')
      return
    }
    if (account?.mustChangePassword && pathname !== '/change-password') {
      router.replace('/change-password')
    }
  }, [token, account, pathname, router, _hasHydrated])

  // 하이드레이션 완료 전: 로딩 표시 (로그아웃 X)
  if (!_hasHydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="animate-spin text-indigo-400" size={28} />
      </div>
    )
  }

  if (!token) return null
  if (account?.mustChangePassword && pathname !== '/change-password') return null

  return <>{children}</>
}
