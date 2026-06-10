import { useState } from 'react'
import type { SlotData } from '../pages/DisplayPage'
import PrizeModal from './PrizeModal'
import GaugeDisplay from './GaugeDisplay'

interface Props {
  slot: SlotData
  displayMode: 'grid' | 'gauge'
  oneRow?: boolean
}

const STATUS_LABEL: Record<string, string> = { draft: '준비중', active: '진행중', closed: '종료' }
const STATUS_DOT: Record<string, string>   = { active: 'bg-green-400 animate-pulse', draft: 'bg-gray-500', closed: 'bg-gray-500' }

export default function EventSlot({ slot, displayMode }: Props) {
  const [showPrizes, setShowPrizes] = useState(false)

  // 진행중이 아니면 빈 슬롯 표시
  if (!slot.event || slot.event.status !== 'active' || !slot.stats) {
    return (
      <div className="bg-gray-900/50 rounded-2xl border border-gray-800 flex items-center justify-center">
        <p className="text-gray-700 text-sm">이벤트 없음</p>
      </div>
    )
  }

  const { event, stats, numbers } = slot

  const drawnCount = stats.totalCount - stats.remainingCount
  const progress = stats.totalCount > 0 ? drawnCount / stats.totalCount * 100 : 0

  return (
    <>
      <div className="bg-gray-900 rounded-2xl border border-gray-800 flex flex-col overflow-hidden min-h-0">
        {/* 상단: 썸네일 + 헤더 정보 */}
        <div className="flex gap-3 p-3 flex-shrink-0 border-b border-gray-800">
          {/* 썸네일 — 1:1.5 비율 (2:3) */}
          <div className="flex-shrink-0 w-14 sm:w-16">
            <div className="w-full aspect-[2/3] rounded-lg overflow-hidden bg-gray-800">
              {event.thumbnailUrl ? (
                <img src={event.thumbnailUrl} alt={event.title}
                  className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xl">🎲</div>
              )}
            </div>
          </div>

          {/* 정보 */}
          <div className="flex-1 min-w-0">
            {/* 상태 */}
            <div className="flex items-center gap-1.5 mb-1">
              <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${STATUS_DOT[event.status]}`} />
              <span className="text-xs text-gray-400">{STATUS_LABEL[event.status]}</span>
              {event.bonusEnabled && (
                <span className="text-xs bg-amber-500/20 text-amber-400 px-1.5 rounded-full">
                  {event.bonusThreshold}+1
                </span>
              )}
            </div>

            {/* 이벤트명 */}
            <h2 className="font-bold text-white text-sm leading-tight line-clamp-2">{event.title}</h2>

            {/* 통계 */}
            <div className="flex gap-3 mt-1.5">
              <div>
                <p className="text-xs text-gray-500 leading-none">남은 번호</p>
                <p className="text-base font-bold text-indigo-400 tabular-nums leading-tight">
                  {stats.remainingCount}<span className="text-xs text-gray-600">/{stats.totalCount}</span>
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 leading-none">남은 경품</p>
                <p className="text-base font-bold text-green-400 tabular-nums leading-tight">
                  {stats.remainingPrizeCount}<span className="text-xs text-gray-600">/{stats.totalPrizeCount}</span>
                </p>
              </div>
            </div>

            {/* 진행 바 */}
            <div className="mt-1.5 h-1 bg-gray-800 rounded-full overflow-hidden">
              <div className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>

        {/* 중단: 번호 그리드 or 게이지 */}
        <div className="flex-1 min-h-0 overflow-auto scrollbar-hide p-2">
          {displayMode === 'gauge' ? (
            <GaugeDisplay stats={stats} />
          ) : (
            <NumberGrid numbers={numbers} />
          )}
        </div>

        {/* 하단: 경품 확인 버튼 */}
        {event.prizes.length > 0 && (
          <div className="px-3 pb-3 flex-shrink-0">
            <button onClick={() => setShowPrizes(true)}
              className="w-full py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 font-semibold text-xs hover:bg-amber-500/20 transition-colors">
              🎁 경품 확인하기
            </button>
          </div>
        )}
      </div>

      {showPrizes && (
        <PrizeModal eventTitle={event.title} prizes={event.prizes} onClose={() => setShowPrizes(false)} />
      )}
    </>
  )
}

// ── 번호 그리드 (overflow-hidden, 자동 줄바꿈) ─────────────────
function NumberGrid({ numbers }: { numbers: SlotData['numbers'] }) {
  return (
    <div className="flex flex-wrap gap-1 content-start h-full overflow-hidden">
      {numbers.map((n) => (
        <div key={n.id}
          className={`
            flex items-center justify-center rounded text-xs font-bold
            w-7 h-7 sm:w-8 sm:h-8 flex-shrink-0
            ${n.isDrawn
              ? 'bg-gray-800 text-gray-600 line-through'
              : n.isPrize
              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
              : 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/20'
            }
          `}>
          {n.number}
        </div>
      ))}
    </div>
  )
}
