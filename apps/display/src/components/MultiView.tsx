import { useState } from 'react'
import type { SlotData } from '../pages/DisplayPage'
import PrizeModal from './PrizeModal'
import GaugeDisplay from './GaugeDisplay'

function getGridCols(slots: number) {
  switch (slots) {
    case 2: return 'grid-cols-2'
    case 3: return 'grid-cols-3'
    case 4: return 'grid-cols-2'
    case 6: return 'grid-cols-3'
    default: return 'grid-cols-2'
  }
}

function isOneRow(slots: number) { return slots === 2 || slots === 3 }

interface Props { slotCount: number; slotData: SlotData[] }

export default function MultiView({ slotCount, slotData }: Props) {
  const oneRow = isOneRow(slotCount)
  const hasActive = slotData.some((s) => s.event?.status === 'active')

  if (!hasActive) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-gray-700">
        <p className="text-5xl mb-4">📺</p>
        <p>표시할 진행중 이벤트가 없습니다</p>
        <p className="text-sm mt-1">어드민 → 디스플레이 설정에서 이벤트를 배치하세요</p>
      </div>
    )
  }

  return (
    <div className="h-full p-3">
      <div
        className={`grid ${getGridCols(slotCount)} gap-3 h-full`}
        style={{ gridTemplateRows: oneRow ? '1fr' : '1fr 1fr' }}
      >
        {slotData.map((slot) => (
          <MultiSlot key={slot.slotIndex} slot={slot} />
        ))}
      </div>
    </div>
  )
}

// ── 멀티뷰 개별 슬롯 (썸네일 + 게이지) ────────────────────────

function MultiSlot({ slot }: { slot: SlotData }) {
  const [showPrizes, setShowPrizes] = useState(false)

  if (!slot.event || slot.event.status !== 'active' || !slot.stats) {
    return (
      <div className="bg-gray-900/50 rounded-2xl border border-gray-800 flex items-center justify-center">
        <p className="text-gray-700 text-sm">이벤트 없음</p>
      </div>
    )
  }

  const { event, stats } = slot
  const winProb = stats.remainingCount > 0
    ? stats.remainingPrizeCount / stats.remainingCount * 100
    : 0

  return (
    <>
      <div className="bg-gray-900 rounded-2xl border border-gray-800 flex flex-col overflow-hidden min-h-0">
        {/* 썸네일 + 이벤트명 */}
        <div className="flex gap-3 p-3 flex-shrink-0">
          {/* 썸네일 1:1.5 */}
          <div className="flex-shrink-0 w-14 sm:w-16">
            <div className="w-full aspect-[2/3] rounded-xl overflow-hidden bg-gray-800">
              {event.thumbnailUrl ? (
                <img src={event.thumbnailUrl} alt={event.title}
                  className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-2xl">🎲</div>
              )}
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="inline-block w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-xs text-gray-400">진행중</span>
              {event.bonusEnabled && (
                <span className="text-xs bg-amber-500/20 text-amber-400 px-1.5 rounded-full">
                  {event.bonusThreshold}+1
                </span>
              )}
            </div>
            <h2 className="font-bold text-white text-sm leading-tight line-clamp-2">{event.title}</h2>
            <p className="text-xs text-amber-400 font-semibold mt-1">
              당첨 확률 {winProb.toFixed(1)}%
            </p>
          </div>
        </div>

        {/* 게이지 현황 */}
        <div className="flex-1 min-h-0 overflow-hidden px-3">
          <GaugeDisplay stats={stats} winProbability={winProb} compact />
        </div>

        {/* 경품 확인 버튼 */}
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
