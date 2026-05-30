import type { PublicNumber } from '../pages/EventLivePage'

interface Props {
  numbers: PublicNumber[]
  recentlyDrawn: Set<string>
}

export default function NumberGrid({ numbers, recentlyDrawn }: Props) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {numbers.map((n) => {
        const isRecent = recentlyDrawn.has(n.id)

        let cls: string
        if (isRecent) {
          // 최근 추첨 — 노란 강조 + 스케일 애니메이션
          cls = 'bg-yellow-400 text-gray-900 scale-125 shadow-lg shadow-yellow-400/40 z-10 ring-2 ring-yellow-300'
        } else if (n.isDrawn) {
          // 이미 추첨됨 — 흐린 회색, 취소선
          cls = 'bg-gray-800 text-gray-600 line-through'
        } else if (n.isPrize) {
          // 경품 번호 — 앰버 강조
          cls = 'bg-amber-500/20 text-amber-400 border border-amber-500/50'
        } else {
          // 일반 번호
          cls = 'bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 hover:bg-indigo-500/20'
        }

        return (
          <div
            key={n.id}
            className={`relative w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center rounded-lg text-xs sm:text-sm font-bold transition-all duration-300 ${cls}`}
          >
            {n.number}
          </div>
        )
      })}
    </div>
  )
}
