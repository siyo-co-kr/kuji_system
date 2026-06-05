import type { Metadata } from 'next'
import { Toaster } from 'sonner'
import './globals.css'

export const metadata: Metadata = {
  title: '쿠지 어드민',
  description: '자체 쿠지 이벤트 관리 시스템',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className="h-full">
      <body className="h-full">
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  )
}
