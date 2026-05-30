import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuthStore } from '../stores/auth'
import type { Event } from '@kuji/types'

type EventWithCount = Event & {
  _count: { kujiNumbers: number }
}

export default function EventListPage() {
  const navigate = useNavigate()
  const { account, logout } = useAuthStore()
  const [events, setEvents] = useState<EventWithCount[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState(new Date())

  const fetchEvents = async () => {
    if (!account?.store.id) return
    try {
      const res = await api.get(`/events?storeId=${account.store.id}`)
      // 진행중(active) 이벤트만 표시
      setEvents((res.data as EventWithCount[]).filter((e) => e.status === 'active'))
      setLastUpdated(new Date())
    } catch {
      // 401은 api 인터셉터에서 처리
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchEvents()
    const timer = setInterval(fetchEvents, 30_000)
    return () => clearInterval(timer)
  }, [account])

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* 헤더 */}
      <header className="border-b border-gray-800 px-8 py-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div>
            <h1 className="text-xl font-bold">쿠지 디스플레이</h1>
            <p className="text-sm text-gray-400">{account?.store.name}</p>
          </div>
          <div className="flex items-center gap-4">
            <p className="text-xs text-gray-500">
              {lastUpdated.toLocaleTimeString('ko-KR')} 기준
            </p>
            <button
              onClick={handleLogout}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              로그아웃
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-8 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-32">
            <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-32 text-gray-500">
            <p className="text-5xl mb-4">🎲</p>
            <p className="text-lg">현재 진행 중인 이벤트가 없습니다</p>
            <p className="text-sm mt-2 text-gray-600">어드민에서 이벤트를 시작하면 여기에 표시됩니다</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {events.map((event) => (
              <button
                key={event.id}
                onClick={() => navigate(`/events/${event.id}`)}
                className="text-left bg-gray-900 rounded-2xl overflow-hidden border border-gray-800 hover:border-indigo-500 hover:shadow-lg hover:shadow-indigo-500/10 transition-all duration-200 active:scale-95"
              >
                {/* 썸네일 */}
                <div className="aspect-video bg-gray-800 overflow-hidden">
                  {event.thumbnailUrl ? (
                    <img src={event.thumbnailUrl} alt={event.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-6xl">🎲</div>
                  )}
                </div>

                <div className="p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full bg-green-500 text-white">
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                      진행중
                    </span>
                    {event.bonusEnabled && (
                      <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full font-bold">
                        {event.bonusThreshold}+1
                      </span>
                    )}
                  </div>

                  <h2 className="font-bold text-lg text-white leading-tight">{event.title}</h2>
                  {event.description && (
                    <p className="text-sm text-gray-400 mt-1 line-clamp-2">{event.description}</p>
                  )}

                  <div className="mt-4 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-500">남은 번호</p>
                      <p className="text-2xl font-bold text-indigo-400">
                        {event._count.kujiNumbers}
                        <span className="text-sm text-gray-500 font-normal ml-1">/ {event.totalCount}</span>
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500">장당 가격</p>
                      <p className="text-sm font-semibold text-gray-300">
                        {event.pricePerUnit.toLocaleString()}원
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                      style={{ width: `${Math.round((1 - event._count.kujiNumbers / event.totalCount) * 100)}%` }}
                    />
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
