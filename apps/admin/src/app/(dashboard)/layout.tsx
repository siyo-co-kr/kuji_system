'use client'
import { Sidebar } from '@/components/layout/sidebar'
import { AuthGuard } from '@/components/auth/auth-guard'
import { ErrorBoundary } from '@/components/error-boundary'
import { useAuthStore } from '@/stores/auth'
import { AlertTriangle } from 'lucide-react'

function UnapprovedBanner() {
  return (
    <div className="bg-amber-50 border-b border-amber-200 px-6 py-3 flex items-center gap-3">
      <AlertTriangle size={18} className="text-amber-500 flex-shrink-0" />
      <div>
        <span className="font-semibold text-amber-800 text-sm">미승인 계정</span>
        <span className="text-amber-700 text-sm ml-2">
          슈퍼 어드민의 승인이 완료되기 전까지 기능이 제한됩니다.
        </span>
      </div>
    </div>
  )
}

function DashboardContent({ children }: { children: React.ReactNode }) {
  const { account } = useAuthStore()
  const isApproved = account?.isApproved ?? true

  return (
    <div className="flex h-full flex-col">
      {!isApproved && <UnapprovedBanner />}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className={`flex-1 overflow-auto ${!isApproved ? 'pointer-events-none opacity-60 select-none' : ''}`}>
          {children}
        </main>
      </div>
    </div>
  )
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <ErrorBoundary>
        <DashboardContent>{children}</DashboardContent>
      </ErrorBoundary>
    </AuthGuard>
  )
}
