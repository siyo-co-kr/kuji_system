import { useState } from 'react'
import type { SlotData, SlotPrize } from '../pages/DisplayPage'
import PrizeModal from './PrizeModal'
import GaugeDisplay from './GaugeDisplay'

interface Props { slot: SlotData | null }

export default function SingleView({ slot }: Props) {
  const [showPrizes, setShowPrizes] = useState(false)

  if (!slot || !slot.event || slot.event.status !== 'active' || !slot.stats) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-gray-700">
        <p className="text-5xl mb-4">📺</p>
        <p className="text-lg">표시할 진행중 이벤트가 없습니다</p>
        <p className="text-sm mt-2">어드민 → 디스플레이 설정에서 이벤트를 배치하세요</p>
      </div>
    )
  }

  const { event, stats, numbers } = slot
  const winProb = stats.remainingCount > 0
    ? stats.remainingPrizeCount / stats.remainingCount * 100
    : 0

  const drawnCount = stats.totalCount - stats.remainingCount
  const progress = stats.totalCount > 0 ? drawnCount / stats.totalCount * 100 : 0

  return (
    <>
      <div className="h-full flex gap-0">
        {/* ── 좌측 패널 (30%) — 썸네일 + 경품 + 게이지 ── */}
        <div className="w-[30%] flex-shrink-0 border-r border-gray-800 flex flex-col overflow-hidden">
          {/* 썸네일 (1:1.5 = 2:3) */}
          <div className="flex-shrink-0 p-4">
            <div className="w-full aspect-[2/3] rounded-2xl overflow-hidden bg-gray-800 max-h-64">
              {event.thumbnailUrl ? (
                <img src={event.thumbnailUrl} alt={event.title}
                  className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-6xl">🎲</div>
              )}
            </div>
          </div>

          {/* 이벤트명 + 상태 */}
          <div className="px-4 flex-shrink-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse inline-block" />
              <span className="text-xs text-gray-400">진행중</span>
              {event.bonusEnabled && (
                <span className="text-xs bg-amber-500/20 text-amber-400 px-1.5 rounded-full">
                  {event.bonusThreshold}+1
                </span>
              )}
            </div>
            <h2 className="font-bold text-white text-base leading-tight">{event.title}</h2>
          </div>

          {/* 게이지 */}
          <div className="flex-1 min-h-0 overflow-hidden px-4 py-2">
            <GaugeDisplay stats={stats} winProbability={winProb} compact={false} />
          </div>

          {/* 경품 카드 목록 — 가로 단일 행, 가로 스크롤 */}
          {event.prizes.length > 0 && (
            <div className="flex-shrink-0 px-4 pb-3 border-t border-gray-800 pt-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">경품</p>
              {/* 가로 스크롤, 스크롤바 숨김 */}
              <div className="flex flex-row gap-2 overflow-x-auto scrollbar-hide pb-1">
                {event.prizes.map((prize) => (
                  <PrizeCard key={prize.id} prize={prize} />
                ))}
              </div>
              <button onClick={() => setShowPrizes(true)}
                className="w-full mt-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold hover:bg-amber-500/20 transition-colors">
                🎁 경품 전체 보기
              </button>
            </div>
          )}
        </div>

        {/* ── 우측 패널 (70%) — 번호 그리드 ── */}
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
          {/* 헤더 통계 */}
          <div className="flex-shrink-0 px-5 py-3 border-b border-gray-800 flex items-center gap-6">
            <div>
              <p className="text-xs text-gray-500">남은 번호</p>
              <p className="text-2xl font-bold text-indigo-400 tabular-nums">
                {stats.remainingCount}
                <span className="text-sm text-gray-600 ml-0.5">/{stats.totalCount}</span>
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">당첨 확률</p>
              <p className="text-2xl font-bold text-amber-400 tabular-nums">{winProb.toFixed(1)}%</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">남은 경품</p>
              <p className="text-2xl font-bold text-green-400 tabular-nums">
                {stats.remainingPrizeCount}
                <span className="text-sm text-gray-600 ml-0.5">/{stats.totalPrizeCount}</span>
              </p>
            </div>
            {/* 미니 진행 바 */}
            <div className="flex-1">
              <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                  style={{ width: `${progress}%` }} />
              </div>
              <p className="text-xs text-gray-600 text-right mt-0.5">{progress.toFixed(0)}% 추첨됨</p>
            </div>
          </div>

          {/* 번호 그리드 — 스크롤바 숨김 */}
          <div className="flex-1 min-h-0 overflow-auto scrollbar-hide p-4">
            <div className="flex flex-wrap gap-2 content-start">
              {numbers.map((n) => (
                <div key={n.id}
                  className={`
                    flex items-center justify-center rounded-xl font-bold
                    w-11 h-11 sm:w-12 sm:h-12 text-sm flex-shrink-0 transition-all duration-300
                    ${n.isDrawn
                      ? 'bg-gray-800 text-gray-600 line-through'
                      : n.isPrize
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                      : 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/20'
                    }
                  `}>
                  {n.number}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {showPrizes && (
        <PrizeModal eventTitle={event.title} prizes={event.prizes} onClose={() => setShowPrizes(false)} />
      )}
    </>
  )
}

function PrizeCard({ prize }: { prize: SlotPrize }) {
  const total = prize.prizeNumbers.length
  const remaining = total - prize.prizeNumbers.filter((pn) => pn.kujiNumber.isDrawn).length
  const isExhausted = remaining === 0

  return (
    <div className={`flex-shrink-0 w-24 rounded-xl overflow-hidden border transition-all ${
      isExhausted ? 'border-gray-700 opacity-50' : 'border-gray-700'
    }`}>
      {/* 이미지 */}
      <div className="aspect-square bg-gray-800 overflow-hidden flex items-center justify-center">
        {prize.images[0] ? (
          <img src={prize.images[0].imageUrl} alt={prize.name}
            className={`w-full h-full object-cover ${isExhausted ? 'grayscale' : ''}`} />
        ) : (
          <span className="text-3xl">{isExhausted ? '🩶' : '🎁'}</span>
        )}
      </div>
      {/* 정보 */}
      <div className="p-2 bg-gray-900">
        <p className={`text-xs font-semibold leading-tight line-clamp-1 ${
          isExhausted ? 'text-gray-600 line-through' : 'text-white'
        }`}>
          {prize.name}
        </p>
        <span className={`inline-block mt-1 text-xs font-bold px-1.5 py-0.5 rounded ${
          isExhausted ? 'bg-gray-800 text-gray-600' : 'bg-amber-500/20 text-amber-400'
        }`}>
          {remaining}/{total}
        </span>
      </div>
    </div>
  )
}
