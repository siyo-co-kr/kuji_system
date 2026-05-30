'use client'
import { useEffect, useState, useCallback } from 'react'
import { api } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { formatPrice, formatDate } from '@/lib/utils'
import {
  Store, CalendarDays, Loader2, Search,
  ChevronLeft, ChevronRight, X,
  MapPin, Phone, User, Calendar,
} from 'lucide-react'

const STATUS_LABEL = { draft: '준비중', active: '진행중', closed: '종료' } as const
const STATUS_VARIANT = { draft: 'default', active: 'success', closed: 'warning' } as const

interface StoreAccount {
  id: string; email: string; role: string
  isApproved: boolean; mustChangePassword: boolean; createdAt: string
}
interface StoreEvent {
  id: string; title: string; status: 'draft' | 'active' | 'closed'
  totalCount: number; pricePerUnit: number; createdAt: string
  _count: { kujiNumbers: number }
}
interface StoreItem {
  id: string; name: string; address?: string | null; phone?: string | null
  createdAt: string
  _count: { events: number }
  accounts: StoreAccount[]
  events: StoreEvent[]
}
interface Pagination {
  total: number; page: number; limit: number; totalPages: number
}

export default function SuperAdminStoresPage() {
  const [stores, setStores] = useState<StoreItem[]>([])
  const [pagination, setPagination] = useState<Pagination>({ total: 0, page: 1, limit: 20, totalPages: 1 })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [selected, setSelected] = useState<StoreItem | null>(null)

  const fetchStores = useCallback(async (page = 1, q = search) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' })
      if (q) params.set('search', q)
      const res = await api.get(`/superadmin/stores?${params}`)
      setStores(res.data.data)
      setPagination(res.data.pagination)
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => { fetchStores(1, '') }, [])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setSearch(searchInput)
    fetchStores(1, searchInput)
  }

  const handlePage = (p: number) => {
    fetchStores(p, search)
  }

  return (
    <div className="flex h-full">
      {/* 메인 패널 */}
      <div className={`flex-1 p-8 overflow-auto transition-all ${selected ? 'pr-4' : ''}`}>
        {/* 헤더 */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">전체 매장 현황</h1>
          <p className="mt-1 text-sm text-gray-500">
            총 {pagination.total}개 매장
          </p>
        </div>

        {/* 검색 */}
        <form onSubmit={handleSearch} className="flex gap-2 mb-5">
          <div className="relative flex-1 max-w-sm">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="매장명, 주소, 전화번호 검색"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <Button type="submit" size="sm">검색</Button>
          {search && (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => { setSearchInput(''); setSearch(''); fetchStores(1, '') }}
            >
              <X size={14} />
            </Button>
          )}
        </form>

        {/* 목록 */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="animate-spin text-indigo-600" size={32} />
          </div>
        ) : stores.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-20">
            {search ? `"${search}" 검색 결과가 없습니다.` : '등록된 매장이 없습니다.'}
          </p>
        ) : (
          <>
            <div className="space-y-2">
              {stores.map((store) => {
                const activeEvents = store.events.filter((e) => e.status === 'active')
                const isSelected = selected?.id === store.id

                return (
                  <Card
                    key={store.id}
                    className={`cursor-pointer transition-all hover:border-indigo-200 hover:shadow-sm ${
                      isSelected ? 'border-indigo-400 bg-indigo-50/30' : ''
                    }`}
                    onClick={() => setSelected(isSelected ? null : store)}
                  >
                    <CardContent className="flex items-center gap-4 py-3.5">
                      <div className="w-9 h-9 bg-indigo-50 rounded-xl flex items-center justify-center flex-shrink-0">
                        <Store size={18} className="text-indigo-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-900 text-sm">{store.name}</span>
                          {activeEvents.length > 0 && (
                            <Badge variant="success">진행중 {activeEvents.length}</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5 flex-wrap">
                          <span className="flex items-center gap-1">
                            <CalendarDays size={11} />
                            이벤트 {store._count.events}개
                          </span>
                          <span className="flex items-center gap-1">
                            <User size={11} />
                            {store.accounts[0]?.email ?? '-'}
                          </span>
                          {store.address && (
                            <span className="flex items-center gap-1">
                              <MapPin size={11} />
                              {store.address}
                            </span>
                          )}
                        </div>
                      </div>
                      <ChevronRight size={16} className={`text-gray-400 flex-shrink-0 transition-transform ${isSelected ? 'rotate-90 text-indigo-500' : ''}`} />
                    </CardContent>
                  </Card>
                )
              })}
            </div>

            {/* 페이지네이션 */}
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-6">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={pagination.page <= 1}
                  onClick={() => handlePage(pagination.page - 1)}
                >
                  <ChevronLeft size={15} />
                </Button>
                <div className="flex gap-1">
                  {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
                    .filter((p) => Math.abs(p - pagination.page) <= 2)
                    .map((p) => (
                      <button
                        key={p}
                        onClick={() => handlePage(p)}
                        className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                          p === pagination.page
                            ? 'bg-indigo-600 text-white'
                            : 'text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => handlePage(pagination.page + 1)}
                >
                  <ChevronRight size={15} />
                </Button>
                <span className="text-xs text-gray-400 ml-1">
                  {pagination.page} / {pagination.totalPages} 페이지
                </span>
              </div>
            )}
          </>
        )}
      </div>

      {/* 상세 사이드 패널 */}
      {selected && (
        <StoreDetailPanel
          store={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}

function StoreDetailPanel({ store, onClose }: { store: StoreItem; onClose: () => void }) {
  const adminAccount = store.accounts[0]

  return (
    <div className="w-80 flex-shrink-0 border-l border-gray-200 bg-white overflow-y-auto">
      {/* 패널 헤더 */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 sticky top-0 bg-white z-10">
        <h2 className="font-semibold text-gray-900 text-sm truncate">{store.name}</h2>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-700 transition-colors ml-2 flex-shrink-0">
          <X size={18} />
        </button>
      </div>

      <div className="p-5 space-y-5">
        {/* 매장 정보 */}
        <section>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">매장 정보</p>
          <div className="space-y-2.5">
            <InfoRow icon={<Store size={14} />} label="매장명" value={store.name} />
            <InfoRow icon={<MapPin size={14} />} label="주소" value={store.address ?? '미입력'} empty={!store.address} />
            <InfoRow icon={<Phone size={14} />} label="전화번호" value={store.phone ?? '미입력'} empty={!store.phone} />
            <InfoRow icon={<Calendar size={14} />} label="가입일" value={formatDate(store.createdAt)} />
          </div>
        </section>

        {/* 가입자(계정) 정보 */}
        {adminAccount && (
          <section>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">가입자</p>
            <div className="space-y-2.5">
              <InfoRow icon={<User size={14} />} label="이메일" value={adminAccount.email} />
              <div className="flex items-start gap-3">
                <span className="text-gray-400 flex-shrink-0 mt-0.5"><User size={14} /></span>
                <div className="flex-1">
                  <p className="text-xs text-gray-500 mb-1">상태</p>
                  <div className="flex gap-1.5 flex-wrap">
                    <Badge variant={adminAccount.isApproved ? 'success' : 'warning'}>
                      {adminAccount.isApproved ? '승인됨' : '승인 대기'}
                    </Badge>
                    {adminAccount.mustChangePassword && (
                      <Badge variant="default">비밀번호 변경 필요</Badge>
                    )}
                  </div>
                </div>
              </div>
              <InfoRow icon={<Calendar size={14} />} label="계정 생성일" value={formatDate(adminAccount.createdAt)} />
            </div>
          </section>
        )}

        {/* 이벤트 목록 */}
        <section>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            이벤트 ({store._count.events}개)
          </p>
          {store.events.length === 0 ? (
            <p className="text-xs text-gray-400">등록된 이벤트 없음</p>
          ) : (
            <div className="space-y-2">
              {store.events.map((ev) => (
                <div key={ev.id} className="p-2.5 rounded-lg bg-gray-50 border border-gray-100">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant={STATUS_VARIANT[ev.status]} className="text-xs">
                      {STATUS_LABEL[ev.status]}
                    </Badge>
                    <span className="text-xs font-medium text-gray-800 truncate">{ev.title}</span>
                  </div>
                  <p className="text-xs text-gray-500">
                    남은 번호 {ev._count.kujiNumbers} / {ev.totalCount}장 · {formatPrice(ev.pricePerUnit)}/장
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">{formatDate(ev.createdAt)}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function InfoRow({
  icon, label, value, empty,
}: {
  icon: React.ReactNode; label: string; value: string; empty?: boolean
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-gray-400 flex-shrink-0 mt-0.5">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-500">{label}</p>
        <p className={`text-sm font-medium truncate ${empty ? 'text-gray-300 italic' : 'text-gray-800'}`}>
          {value}
        </p>
      </div>
    </div>
  )
}
