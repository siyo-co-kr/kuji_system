'use client'
import { useEffect, useState, useCallback } from 'react'
import { api } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { ImageUpload } from '@/components/ui/image-upload'
import { formatDate } from '@/lib/utils'
import {
  Plus, Pencil, Trash2, Loader2, Gift,
  FolderOpen, ChevronRight, X, Tag,
} from 'lucide-react'

interface Category {
  id: string; name: string; createdAt: string
  _count: { prizes: number }
}

interface CatalogItem {
  id: string; name: string; description?: string | null
  imageUrl?: string | null; categoryId?: string | null
  category?: { id: string; name: string } | null
  createdAt: string
}

export default function PrizeCatalogPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [items, setItems] = useState<CatalogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)

  const [showCategoryForm, setShowCategoryForm] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [showItemForm, setShowItemForm] = useState(false)
  const [editingItem, setEditingItem] = useState<CatalogItem | null>(null)

  const fetchAll = useCallback(async () => {
    const [catRes, itemRes] = await Promise.all([
      api.get('/prize-catalog/categories'),
      api.get(`/prize-catalog${selectedCategoryId ? `?categoryId=${selectedCategoryId}` : ''}`),
    ])
    setCategories(catRes.data)
    setItems(itemRes.data)
    setLoading(false)
  }, [selectedCategoryId])

  useEffect(() => { fetchAll() }, [fetchAll])

  const deleteCategory = async (id: string) => {
    if (!confirm('카테고리를 삭제하시겠습니까?\n소속 경품의 카테고리가 해제됩니다.')) return
    await api.delete(`/prize-catalog/categories/${id}`)
    if (selectedCategoryId === id) setSelectedCategoryId(null)
    fetchAll()
  }

  const deleteItem = async (id: string) => {
    if (!confirm('경품을 삭제하시겠습니까?')) return
    await api.delete(`/prize-catalog/${id}`)
    fetchAll()
  }

  return (
    <div className="p-8 flex gap-6 h-full">
      {/* 왼쪽: 카테고리 패널 */}
      <div className="w-56 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-gray-700">카테고리</p>
          <button onClick={() => { setEditingCategory(null); setShowCategoryForm(true) }}
            className="text-indigo-600 hover:text-indigo-700 transition-colors">
            <Plus size={16} />
          </button>
        </div>

        <div className="space-y-1">
          {/* 전체 */}
          <button
            onClick={() => setSelectedCategoryId(null)}
            className={`w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
              selectedCategoryId === null ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <FolderOpen size={15} />
            <span className="flex-1">전체</span>
            <span className="text-xs text-gray-400">{items.length}</span>
          </button>

          {categories.map((cat) => (
            <div key={cat.id} className={`group flex items-center gap-1 px-3 py-2 rounded-lg transition-colors ${
              selectedCategoryId === cat.id ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-100'
            }`}>
              <button className="flex items-center gap-2 flex-1 text-sm text-left"
                onClick={() => setSelectedCategoryId(cat.id)}>
                <Tag size={14} />
                <span className="flex-1 truncate">{cat.name}</span>
                <span className="text-xs text-gray-400">{cat._count.prizes}</span>
              </button>
              <button onClick={() => { setEditingCategory(cat); setShowCategoryForm(true) }}
                className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-indigo-500 transition-all">
                <Pencil size={12} />
              </button>
              <button onClick={() => deleteCategory(cat.id)}
                className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-all">
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* 오른쪽: 경품 목록 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">경품 카탈로그</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {selectedCategoryId
                ? categories.find(c => c.id === selectedCategoryId)?.name
                : '전체'}{' '}
              · {items.length}개
            </p>
          </div>
          <Button onClick={() => { setEditingItem(null); setShowItemForm(true) }}>
            <Plus size={16} className="mr-1.5" />
            경품 등록
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="animate-spin text-indigo-600" size={32} />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-20">
            <Gift className="mx-auto mb-3 text-gray-300" size={40} />
            <p className="text-gray-400 text-sm">등록된 경품이 없습니다</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((item) => (
              <Card key={item.id} className="group hover:border-indigo-200 transition-all">
                <CardContent className="p-0">
                  {/* 이미지 */}
                  <div className="aspect-video bg-gray-100 rounded-t-xl overflow-hidden flex items-center justify-center">
                    {item.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                    ) : (
                      <Gift size={32} className="text-gray-300" />
                    )}
                  </div>

                  <div className="p-3">
                    {item.category && (
                      <Badge variant="default" className="mb-1.5 text-xs">
                        {item.category.name}
                      </Badge>
                    )}
                    <p className="font-semibold text-gray-900 text-sm truncate">{item.name}</p>
                    {item.description && (
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{item.description}</p>
                    )}
                    <div className="flex items-center justify-between mt-3">
                      <p className="text-xs text-gray-400">{formatDate(item.createdAt)}</p>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => { setEditingItem(item); setShowItemForm(true) }}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 transition-colors">
                          <Pencil size={13} />
                        </button>
                        <button onClick={() => deleteItem(item.id)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* 카테고리 폼 모달 */}
      <CategoryFormModal
        open={showCategoryForm}
        category={editingCategory}
        onClose={() => { setShowCategoryForm(false); setEditingCategory(null) }}
        onSaved={() => { setShowCategoryForm(false); setEditingCategory(null); fetchAll() }}
      />

      {/* 경품 등록/수정 모달 */}
      <ItemFormModal
        open={showItemForm}
        item={editingItem}
        categories={categories}
        defaultCategoryId={selectedCategoryId}
        onClose={() => { setShowItemForm(false); setEditingItem(null) }}
        onSaved={() => { setShowItemForm(false); setEditingItem(null); fetchAll() }}
      />
    </div>
  )
}

// ── 카테고리 폼 ──────────────────────────────────────────────

function CategoryFormModal({ open, category, onClose, onSaved }: {
  open: boolean; category: Category | null
  onClose: () => void; onSaved: () => void
}) {
  const [name, setName] = useState(category?.name ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { setName(category?.name ?? ''); setError('') }, [category, open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) { setError('카테고리명을 입력해주세요.'); return }
    setLoading(true)
    try {
      if (category) await api.patch(`/prize-catalog/categories/${category.id}`, { name })
      else await api.post('/prize-catalog/categories', { name })
      onSaved()
    } catch { setError('저장에 실패했습니다.') }
    finally { setLoading(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title={category ? '카테고리 수정' : '카테고리 추가'} className="max-w-xs">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="카테고리명 *" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-2">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>취소</Button>
          <Button type="submit" className="flex-1" loading={loading}>저장</Button>
        </div>
      </form>
    </Modal>
  )
}

// ── 경품 등록/수정 폼 ─────────────────────────────────────────

function ItemFormModal({ open, item, categories, defaultCategoryId, onClose, onSaved }: {
  open: boolean; item: CatalogItem | null
  categories: Category[]; defaultCategoryId: string | null
  onClose: () => void; onSaved: () => void
}) {
  const [form, setForm] = useState({
    name: item?.name ?? '',
    description: item?.description ?? '',
    imageUrl: item?.imageUrl ?? '',
    categoryId: item?.categoryId ?? defaultCategoryId ?? '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setForm({
      name: item?.name ?? '',
      description: item?.description ?? '',
      imageUrl: item?.imageUrl ?? '',
      categoryId: item?.categoryId ?? defaultCategoryId ?? '',
    })
    setError('')
  }, [item, open, defaultCategoryId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) { setError('경품명을 입력해주세요.'); return }
    setLoading(true)
    try {
      const payload = {
        name: form.name,
        description: form.description || null,
        imageUrl: form.imageUrl || null,
        categoryId: form.categoryId || null,
      }
      if (item) await api.patch(`/prize-catalog/${item.id}`, payload)
      else await api.post('/prize-catalog', payload)
      onSaved()
    } catch { setError('저장에 실패했습니다.') }
    finally { setLoading(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title={item ? '경품 수정' : '경품 등록'} className="max-w-md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex gap-4 items-start">
          <ImageUpload label="이미지" value={form.imageUrl} onChange={(url) => setForm(f => ({ ...f, imageUrl: url }))} />
          <div className="flex-1 space-y-3">
            <Input label="경품명 *" value={form.name}
              onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} required />
            <Input label="설명" value={form.description} placeholder="경품 설명"
              onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
        </div>

        {/* 카테고리 선택 */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">카테고리</label>
          <select
            value={form.categoryId}
            onChange={(e) => setForm(f => ({ ...f, categoryId: e.target.value }))}
            className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
          >
            <option value="">카테고리 없음</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-2 pt-1">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>취소</Button>
          <Button type="submit" className="flex-1" loading={loading}>저장</Button>
        </div>
      </form>
    </Modal>
  )
}
