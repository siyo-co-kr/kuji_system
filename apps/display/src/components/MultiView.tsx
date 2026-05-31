import { useState } from 'react'
import type { SlotData, SlotPrize, SlotNumber } from '../pages/DisplayPage'

/* ─────────────────────────────── 그리드 헬퍼 ─────────────────────── */
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

/* ─────────────────────────────── MultiView ─────────────────────────── */
interface Props { slotCount: number; slotData: SlotData[] }

export default function MultiView({ slotCount, slotData }: Props) {
  const oneRow = isOneRow(slotCount)
  const hasActive = slotData.some((s) => s.event?.status === 'active')

  if (!hasActive) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-gray-700">
        <p className="text-5xl mb-4">📺</p>
        <p>표시할 진행중 이벤트가 없습니다</p>
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

/* ─────────────────────────────── 슬롯 ─────────────────────────────── */
function MultiSlot({ slot }: { slot: SlotData }) {
  const [numberModal, setNumberModal] = useState<'remaining' | 'drawn' | null>(null)
  const [showAllPrizes, setShowAllPrizes] = useState(false)
  const [selectedPrize, setSelectedPrize] = useState<SlotPrize | null>(null)

  if (!slot.event || slot.event.status !== 'active' || !slot.stats) {
    return (
      <div className="bg-gray-900/50 rounded-2xl border border-gray-800 flex items-center justify-center">
        <p className="text-gray-700 text-sm">이벤트 없음</p>
      </div>
    )
  }

  const { event, stats, numbers } = slot
  const drawnCount  = stats.totalCount - stats.remainingCount
  const drawnPct    = stats.totalCount > 0 ? drawnCount / stats.totalCount * 100 : 0
  const winProb     = stats.remainingCount > 0
    ? stats.remainingPrizeCount / stats.remainingCount * 100 : 0

  return (
    <>
      <div className="bg-gray-900 rounded-2xl border border-gray-800 flex overflow-hidden min-h-0">

        {/* ── 좌측: 썸네일 ── */}
        <div className="flex-shrink-0 w-[22%] p-2.5">
          <div className="w-full aspect-[2/3] rounded-xl overflow-hidden bg-gray-800 h-full max-h-full">
            {event.thumbnailUrl
              ? <img src={event.thumbnailUrl} alt={event.title} className="w-full h-full object-cover" />
              : <div className="w-full h-full flex items-center justify-center text-3xl">🎲</div>}
          </div>
        </div>

        {/* ── 우측: 컨텐츠 ── */}
        <div className="flex-1 min-w-0 flex flex-col p-2.5 gap-2 overflow-hidden">

          {/* 이벤트명 + 뱃지 */}
          <div className="flex-shrink-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="inline-flex items-center gap-1 text-xs font-bold text-white
                bg-green-500 px-2 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                진행 중
              </span>
              {event.bonusEnabled && (
                <span className="text-xs bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded-full font-bold">
                  {event.bonusThreshold}+1
                </span>
              )}
            </div>
            <h2 className="font-bold text-white text-sm leading-tight mt-1 line-clamp-1">
              {event.title}
            </h2>
          </div>

          {/* 통계 3칸 (클릭 가능) */}
          <div className="flex-shrink-0 grid grid-cols-3 gap-1.5">
            <StatBtn
              label="잔여 개수"
              value={stats.remainingCount}
              sub={`/${stats.totalCount}`}
              color="text-indigo-400"
              onClick={() => setNumberModal('remaining')}
            />
            <StatBtn
              label="남은 경품"
              value={stats.remainingPrizeCount}
              sub={`/${stats.totalPrizeCount}`}
              color="text-amber-400"
              onClick={() => setShowAllPrizes(true)}
            />
            <StatBtn
              label="추첨됨"
              value={drawnCount}
              sub={`/${stats.totalCount}`}
              color="text-gray-400"
              onClick={() => setNumberModal('drawn')}
            />
          </div>

          {/* 게이지 2줄 */}
          <div className="flex-shrink-0 space-y-1.5">
            <GaugeBar label="추첨 진행" pct={drawnPct}
              color="from-indigo-700 to-indigo-400" />
            <GaugeBar label={`당첨 확률 ${winProb.toFixed(1)}%`} pct={Math.min(winProb, 100)}
              color="from-amber-700 to-amber-400" />
          </div>

          {/* 경품 카드 가로 스크롤 */}
          {event.prizes.length > 0 && (
            <div className="flex-1 min-h-0 flex flex-col">
              <p className="text-xs text-gray-500 mb-1 flex-shrink-0">경품</p>
              <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
                {event.prizes.map((prize) => (
                  <PrizeThumb
                    key={prize.id}
                    prize={prize}
                    onClick={() => setSelectedPrize(prize)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── 모달 ── */}
      {numberModal && (
        <NumberGridModal
          numbers={numbers}
          filter={numberModal}
          eventTitle={event.title}
          onClose={() => setNumberModal(null)}
        />
      )}
      {showAllPrizes && (
        <AllPrizesModal
          prizes={event.prizes}
          eventTitle={event.title}
          onClose={() => setShowAllPrizes(false)}
          onSelectPrize={(p) => { setShowAllPrizes(false); setSelectedPrize(p) }}
        />
      )}
      {selectedPrize && (
        <PrizeDetailModal
          prize={selectedPrize}
          onClose={() => setSelectedPrize(null)}
        />
      )}
    </>
  )
}

/* ─────────────────────────────── 소형 컴포넌트 ─────────────────────── */

function StatBtn({ label, value, sub, color, onClick }: {
  label: string; value: number; sub: string; color: string; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="bg-gray-800 hover:bg-gray-700 active:scale-95 rounded-xl px-2 py-1.5 text-center transition-all"
    >
      <p className="text-xs text-gray-500 leading-none mb-0.5">{label}</p>
      <p className={`text-lg font-bold tabular-nums leading-none ${color}`}>
        {value}<span className="text-xs text-gray-600 font-normal">{sub}</span>
      </p>
    </button>
  )
}

function GaugeBar({ label, pct, color }: { label: string; pct: number; color: string }) {
  return (
    <div>
      <div className="flex justify-between text-xs text-gray-500 mb-0.5">
        <span>{label}</span>
        <span>{pct.toFixed(0)}%</span>
      </div>
      <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
        <div
          className={`h-full bg-gradient-to-r ${color} rounded-full transition-all duration-700`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function PrizeThumb({ prize, onClick }: { prize: SlotPrize; onClick: () => void }) {
  const total = prize.prizeNumbers.length
  const remaining = total - prize.prizeNumbers.filter((pn) => pn.kujiNumber.isDrawn).length
  const exhausted = remaining === 0

  return (
    <button
      onClick={onClick}
      className={`flex-shrink-0 w-20 rounded-xl overflow-hidden border transition-all active:scale-95
        ${exhausted ? 'border-gray-700 opacity-50' : 'border-gray-700 hover:border-amber-500/60'}`}
    >
      <div className="aspect-square bg-gray-800 flex items-center justify-center overflow-hidden">
        {prize.images[0]
          ? <img src={prize.images[0].imageUrl} alt={prize.name}
              className={`w-full h-full object-cover ${exhausted ? 'grayscale' : ''}`} />
          : <span className="text-2xl">{exhausted ? '🩶' : '🎁'}</span>}
      </div>
      <div className="px-1.5 py-1 bg-gray-900">
        <p className={`text-xs font-semibold truncate leading-tight
          ${exhausted ? 'text-gray-600 line-through' : 'text-white'}`}>
          {prize.name}
        </p>
        <p className={`text-xs font-bold ${exhausted ? 'text-gray-600' : 'text-amber-400'}`}>
          {remaining}/{total}
        </p>
      </div>
    </button>
  )
}

/* ─────────────────────────────── 번호 그리드 모달 ─────────────────── */

function NumberGridModal({ numbers, filter, eventTitle, onClose }: {
  numbers: SlotNumber[]
  filter: 'remaining' | 'drawn'
  eventTitle: string
  onClose: () => void
}) {
  const filtered = filter === 'remaining'
    ? numbers.filter((n) => !n.isDrawn)
    : numbers.filter((n) => n.isDrawn)

  return (
    <LargeModal onClose={onClose}
      title={`${eventTitle} — ${filter === 'remaining' ? '잔여 번호' : '추첨된 번호'}`}
      badge={`${filtered.length}개`}
    >
      <div className="flex flex-wrap gap-2 content-start">
        {filtered.map((n) => (
          <div key={n.id}
            className={`w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center rounded-xl
              text-sm font-bold flex-shrink-0
              ${n.isDrawn
                ? 'bg-gray-700 text-gray-500 line-through'
                : n.isPrize
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50'
                : 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30'
              }`}>
            {n.number}
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="text-gray-500 text-sm w-full text-center py-8">
            {filter === 'remaining' ? '남은 번호가 없습니다' : '아직 추첨된 번호가 없습니다'}
          </p>
        )}
      </div>
    </LargeModal>
  )
}

/* ─────────────────────────────── 전체 경품 모달 ─────────────────────── */

function AllPrizesModal({ prizes, eventTitle, onClose, onSelectPrize }: {
  prizes: SlotPrize[]
  eventTitle: string
  onClose: () => void
  onSelectPrize: (p: SlotPrize) => void
}) {
  return (
    <LargeModal onClose={onClose} title={`${eventTitle} — 전체 경품`} badge={`${prizes.length}개`}>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {prizes.map((prize) => {
          const total = prize.prizeNumbers.length
          const remaining = total - prize.prizeNumbers.filter((pn) => pn.kujiNumber.isDrawn).length
          const exhausted = remaining === 0

          return (
            <button key={prize.id} onClick={() => onSelectPrize(prize)}
              className={`rounded-2xl overflow-hidden border text-left transition-all active:scale-95
                ${exhausted ? 'border-gray-700 opacity-50' : 'border-gray-700 hover:border-amber-500/60'}`}>
              <div className="aspect-square bg-gray-800 flex items-center justify-center overflow-hidden">
                {prize.images[0]
                  ? <img src={prize.images[0].imageUrl} alt={prize.name}
                      className={`w-full h-full object-cover ${exhausted ? 'grayscale' : ''}`} />
                  : <span className="text-5xl">{exhausted ? '🩶' : '🎁'}</span>}
              </div>
              <div className="p-3 bg-gray-900">
                <p className={`font-bold text-sm leading-tight line-clamp-2 mb-1.5
                  ${exhausted ? 'text-gray-500 line-through' : 'text-white'}`}>
                  {prize.name}
                </p>
                <span className={`inline-block text-sm font-bold px-2 py-0.5 rounded-full
                  ${exhausted ? 'bg-gray-800 text-gray-600' : 'bg-amber-500/20 text-amber-400'}`}>
                  {remaining}/{total}
                </span>
              </div>
            </button>
          )
        })}
      </div>
    </LargeModal>
  )
}

/* ─────────────────────────────── 경품 상세 모달 ─────────────────────── */

function PrizeDetailModal({ prize, onClose }: { prize: SlotPrize; onClose: () => void }) {
  const total = prize.prizeNumbers.length
  const drawnNums   = prize.prizeNumbers.filter((pn) => pn.kujiNumber.isDrawn).map((pn) => pn.kujiNumber)
  const remaining   = prize.prizeNumbers.filter((pn) => !pn.kujiNumber.isDrawn).map((pn) => pn.kujiNumber)
  const exhausted   = remaining.length === 0

  const allNums = prize.prizeNumbers
    .map((pn) => pn.kujiNumber)
    .sort((a, b) => a.number - b.number)

  return (
    <LargeModal onClose={onClose} title={prize.name}
      badge={exhausted ? '소진' : `${remaining.length}/${total} 남음`}>
      <div className="flex flex-col sm:flex-row gap-6 h-full">
        {/* 이미지 */}
        <div className="flex-shrink-0 sm:w-64">
          <div className="aspect-square rounded-2xl overflow-hidden bg-gray-800 flex items-center justify-center">
            {prize.images[0]
              ? <img src={prize.images[0].imageUrl} alt={prize.name}
                  className={`w-full h-full object-cover ${exhausted ? 'grayscale' : ''}`} />
              : <span className="text-8xl">{exhausted ? '🩶' : '🎁'}</span>}
          </div>

          {/* 잔여/소진 뱃지 */}
          <div className={`mt-3 text-center py-2 rounded-xl font-bold text-lg
            ${exhausted ? 'bg-gray-800 text-gray-500' : 'bg-amber-500/20 text-amber-400'}`}>
            {exhausted ? '소진됨' : `${remaining.length} / ${total} 남음`}
          </div>
        </div>

        {/* 번호 정보 */}
        <div className="flex-1 min-w-0 flex flex-col gap-4 overflow-auto scrollbar-hide">
          {/* 설명 */}
          {prize.description && (
            <p className="text-gray-400 text-sm leading-relaxed">{prize.description}</p>
          )}

          {/* 전체 번호 */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              배정 번호 ({total}개)
            </p>
            <div className="flex flex-wrap gap-2">
              {allNums.map((kn) => (
                <span key={kn.id}
                  className={`w-12 h-12 flex items-center justify-center rounded-xl text-sm font-bold
                    ${kn.isDrawn
                      ? 'bg-gray-700 text-gray-500 line-through'
                      : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                    }`}>
                  {kn.number}
                </span>
              ))}
            </div>
          </div>

          {/* 추첨된 번호 */}
          {drawnNums.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                추첨됨 ({drawnNums.length}개)
              </p>
              <div className="flex flex-wrap gap-2">
                {drawnNums.map((kn) => (
                  <span key={kn.id}
                    className="w-12 h-12 flex items-center justify-center rounded-xl text-sm font-bold
                      bg-gray-700 text-gray-500 line-through">
                    {kn.number}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </LargeModal>
  )
}

/* ─────────────────────────────── 공통 모달 래퍼 ─────────────────────── */

function LargeModal({ children, title, badge, onClose }: {
  children: React.ReactNode
  title: string
  badge?: string
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-gray-900 rounded-2xl border border-gray-700 shadow-2xl
        w-[92vw] h-[88vh] flex flex-col overflow-hidden">
        {/* 헤더 */}
        <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <div className="flex items-center gap-3 min-w-0">
            <h2 className="font-bold text-white text-lg truncate">{title}</h2>
            {badge && (
              <span className="flex-shrink-0 bg-indigo-500/20 text-indigo-400 text-sm font-bold px-2.5 py-0.5 rounded-full">
                {badge}
              </span>
            )}
          </div>
          <button onClick={onClose}
            className="flex-shrink-0 ml-4 text-gray-400 hover:text-white text-2xl leading-none transition-colors">
            ✕
          </button>
        </div>
        {/* 바디 */}
        <div className="flex-1 min-h-0 overflow-auto scrollbar-hide p-6">
          {children}
        </div>
      </div>
    </div>
  )
}
