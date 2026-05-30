'use client'
import { useRef, useState } from 'react'
import { api } from '@/lib/api'
import { ImageIcon, Upload, X, Loader2 } from 'lucide-react'

interface ImageUploadProps {
  label?: string
  value?: string        // 현재 이미지 URL
  onChange: (url: string) => void
  className?: string
}

export function ImageUpload({ label, value, onChange, className }: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  const handleFile = async (file: File) => {
    setError('')
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await api.post('/upload/image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      onChange(res.data.url)
    } catch {
      setError('이미지 업로드에 실패했습니다.')
    } finally {
      setUploading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    // 같은 파일 재선택 허용
    e.target.value = ''
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file && file.type.startsWith('image/')) handleFile(file)
  }

  return (
    <div className={className}>
      {label && <p className="text-sm font-medium text-gray-700 mb-1.5">{label}</p>}

      {value ? (
        <div className="relative inline-block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt="uploaded"
            className="w-32 h-32 object-cover rounded-lg border border-gray-200"
          />
          <button
            type="button"
            onClick={() => onChange('')}
            className="absolute -top-2 -right-2 bg-white border border-gray-300 rounded-full p-0.5 shadow-sm hover:bg-red-50 hover:border-red-400 transition-colors"
          >
            <X size={12} className="text-gray-500" />
          </button>
        </div>
      ) : (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => !uploading && inputRef.current?.click()}
          className="w-32 h-32 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center gap-1 cursor-pointer hover:border-indigo-400 hover:bg-indigo-50 transition-colors"
        >
          {uploading ? (
            <Loader2 size={20} className="animate-spin text-indigo-500" />
          ) : (
            <>
              <ImageIcon size={20} className="text-gray-400" />
              <Upload size={12} className="text-gray-400" />
              <span className="text-xs text-gray-400 text-center leading-tight px-1">
                클릭 또는<br />드래그
              </span>
            </>
          )}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={handleChange}
      />
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  )
}
