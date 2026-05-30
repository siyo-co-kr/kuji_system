'use client'
import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import { X } from 'lucide-react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  className?: string
  /** 모달이 열릴 때 호출 (데이터 초기 로드 등) */
  onOpenChange?: () => void
}

export function Modal({ open, onClose, title, children, className, onOpenChange }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const prevOpen = useRef(false)

  useEffect(() => {
    if (!open) { prevOpen.current = false; return }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // open이 false → true로 바뀔 때 onOpenChange 호출
  useEffect(() => {
    if (open && !prevOpen.current) {
      prevOpen.current = true
      onOpenChange?.()
    }
  }, [open, onOpenChange])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        ref={overlayRef}
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />
      <div className={cn(
        'relative bg-white rounded-xl shadow-xl w-full max-h-[90vh] overflow-y-auto',
        'mx-4',
        className
      )}>
        {title && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        )}
        <div className="px-6 py-4">{children}</div>
      </div>
    </div>
  )
}
