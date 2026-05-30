import type { SlotStats } from '../pages/DisplayPage'

interface Props {
  stats: SlotStats
  winProbability: number
}

export default function GaugeDisplay({ stats, winProbability }: Props) {
  const drawnCount  = stats.totalCount - stats.remainingCount
  const drawnPercent = stats.totalCount > 0 ? drawnCount / stats.totalCount * 100 : 0
  const prizePercent = Math.min(winProbability, 100)

  return (
    <div className="h-full flex flex-col justify-center gap-4 px-2 py-3">
      {/* 추첨 진행률 게이지 */}
      <div>
        <div className="flex justify-between text-xs mb-1">
          <span className="text-gray-400">추첨 진행</span>
          <span className="text-gray-300 font-semibold tabular-nums">
            {drawnCount} / {stats.totalCount}
          </span>
        </div>
        <div className="h-4 bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-indigo-700 to-indigo-400 rounded-full transition-all duration-700"
            style={{ width: `${drawnPercent}%` }}
          />
        </div>
        <p className="text-right text-xs text-gray-600 mt-0.5">
          {drawnPercent.toFixed(0)}% 추첨됨
        </p>
      </div>

      {/* 당첨 확률 게이지 */}
      <div>
        <div className="flex justify-between text-xs mb-1">
          <span className="text-gray-400">당첨 확률</span>
          <span className="text-amber-400 font-bold tabular-nums">
            {winProbability.toFixed(1)}%
          </span>
        </div>
        <div className="h-4 bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-amber-700 to-amber-400 rounded-full transition-all duration-700"
            style={{ width: `${prizePercent}%` }}
          />
        </div>
        <p className="text-right text-xs text-gray-600 mt-0.5">
          경품 {stats.remainingPrizeCount}개 / 번호 {stats.remainingCount}개 잔여
        </p>
      </div>

      {/* 수치 카드 */}
      <div className="grid grid-cols-3 gap-2 mt-1">
        <StatBox label="남은 번호" value={stats.remainingCount} color="text-indigo-400" />
        <StatBox label="남은 경품" value={stats.remainingPrizeCount} color="text-green-400" />
        <StatBox label="추첨됨" value={drawnCount} color="text-gray-400" />
      </div>
    </div>
  )
}

function StatBox({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-gray-800 rounded-xl px-2 py-2 text-center">
      <p className="text-xs text-gray-500 leading-none mb-1">{label}</p>
      <p className={`text-xl font-bold tabular-nums leading-none ${color}`}>{value}</p>
    </div>
  )
}
