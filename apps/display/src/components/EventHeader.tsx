import type { EventStats } from '@kuji/types'
import type { PublicEventDetail } from '../pages/EventLivePage'

const STATUS_LABEL: Record<string, string> = { draft: '준비중', active: '진행중', closed: '종료' }
const STATUS_COLOR: Record<string, string> = { draft: 'bg-gray-600', active: 'bg-green-500', closed: 'bg-gray-600' }

interface Props {
  event: PublicEventDetail
  stats: EventStats
}

export default function EventHeader({ event, stats }: Props) {
  const progress = Math.round(((stats.totalCount - stats.remainingCount) / stats.totalCount) * 100)

  return (
    <div className="px-6 py-4 border-b border-gray-800">
      <div className="flex items-start gap-4">
        {/* 썸네일 */}
        {event.thumbnailUrl && (
          <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 border border-gray-700">
            <img src={event.thumbnailUrl} alt={event.title} className="w-full h-full object-cover" />
          </div>
        )}

        <div className="flex-1 min-w-0">
          {/* 상태 + 뱃지 */}
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full text-white ${STATUS_COLOR[event.status]}`}>
              {event.status === 'active' && <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
              {STATUS_LABEL[event.status]}
            </span>
            {event.bonusEnabled && (
              <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full font-bold">
                {event.bonusThreshold}+1
              </span>
            )}
            {event.store && <span className="text-xs text-gray-500">{event.store.name}</span>}
          </div>

          <h1 className="text-xl font-bold text-white truncate">{event.title}</h1>
          {event.description && (
            <p className="text-sm text-gray-400 mt-0.5 line-clamp-1">{event.description}</p>
          )}
        </div>

        {/* 통계 패널 */}
        <div className="flex gap-6 flex-shrink-0">
          <StatBox label="남은 번호" value={stats.remainingCount} total={stats.totalCount} accent />
          <StatBox label="남은 경품" value={stats.remainingPrizeCount} total={stats.totalPrizeCount} />
        </div>
      </div>

      {/* 진행 바 */}
      <div className="mt-4">
        <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
          <span>추첨 진행률</span>
          <span>{progress}%</span>
        </div>
        <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-indigo-600 to-indigo-400 rounded-full transition-all duration-700"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  )
}

function StatBox({
  label, value, total, accent,
}: {
  label: string; value: number; total: number; accent?: boolean
}) {
  return (
    <div className="text-center">
      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
      <p className={`text-2xl font-bold tabular-nums ${accent ? 'text-indigo-400' : 'text-white'}`}>
        {value.toLocaleString()}
      </p>
      <p className="text-xs text-gray-600">/ {total.toLocaleString()}</p>
    </div>
  )
}
