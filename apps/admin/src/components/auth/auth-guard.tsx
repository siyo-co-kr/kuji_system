'use client'
import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuthStore } from '@/stores/auth'

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { token, account } = useAuthStore()

  useEffect(() => {
    if (!token) {
      router.replace('/login')
      return
    }
    // 비밀번호 변경이 필요한 경우 해당 페이지로 강제 이동
    if (account?.mustChangePassword && pathname !== '/change-password') {
      router.replace('/change-password')
    }
  }, [token, account, pathname, router])

  if (!token) return null
  if (account?.mustChangePassword && pathname !== '/change-password') return null

  return <>{children}</>
}
