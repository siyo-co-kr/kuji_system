import type { PublicPrize } from '../pages/EventLivePage'

interface Props {
  prizes: PublicPrize[]
}

export default function PrizeBoard({ prizes }: Props) {
  if (prizes.length === 0) {
    return <p className="text-sm text-gray-600 text-center py-4">등록된 경품이 없습니다</p>
  }

  return (
    <div className="space-y-3">
      {prizes.map((prize) => {
        const drawnCount = prize.prizeNumbers.filter((pn) => pn.kujiNumber.isDrawn).length
        const totalCount = prize.prizeNumbers.length
        const allDone = drawnCount === totalCount && totalCount > 0

        const sortedNumbers = prize.prizeNumbers
          .map((pn) => pn.kujiNumber)
          .sort((a, b) => a.number - b.number)

        return (
          <div
            key={prize.id}
            className={`rounded-xl border p-3 transition-all ${
              allDone
                ? 'border-gray-700 bg-gray-800/50 opacity-60'
                : 'border-gray-700 bg-gray-800'
            }`}
          >
            <div className="flex items-start gap-3">
              {/* 이미지 */}
              <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-gray-700">
                {prize.images[0] ? (
                  <img
                    src={prize.images[0].imageUrl}
                    alt={prize.name}
                    className={`w-full h-full object-cover ${allDone ? 'grayscale' : ''}`}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-2xl">🎁</div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className={`font-semibold text-sm truncate ${allDone ? 'line-through text-gray-500' : 'text-white'}`}>
                    {prize.name}
                  </p>
                  {/* 당첨 카운터 */}
                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded flex-shrink-0 ${
                    allDone
                      ? 'bg-gray-700 text-gray-500'
                      : drawnCount > 0
                      ? 'bg-yellow-500/20 text-yellow-400'
                      : 'bg-green-500/20 text-green-400'
                  }`}>
                    {drawnCount}/{totalCount}
                  </span>
                </div>

                {/* 번호 목록 */}
                {sortedNumbers.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {sortedNumbers.map((kn) => (
                      <span
                        key={kn.id}
                        className={`text-xs px-1.5 py-0.5 rounded font-mono ${
                          kn.isDrawn
                            ? 'bg-gray-700 text-gray-500 line-through'
                            : 'bg-amber-500/20 text-amber-400'
                        }`}
                      >
                        {kn.number}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
