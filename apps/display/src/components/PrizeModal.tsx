import type { SlotPrize } from '../pages/DisplayPage'

interface Props {
  eventTitle: string
  prizes: SlotPrize[]
  onClose: () => void
}

export default function PrizeModal({ eventTitle, prizes, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* 오버레이 */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* 모달 */}
      <div className="relative bg-gray-900 rounded-2xl border border-gray-700 shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <div>
            <h2 className="font-bold text-white text-lg">🎁 경품 목록</h2>
            <p className="text-xs text-gray-400 mt-0.5">{eventTitle}</p>
          </div>
          <button onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors text-xl leading-none">✕</button>
        </div>

        {/* 경품 카드 그리드 */}
        <div className="overflow-y-auto p-5">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {prizes.map((prize) => {
              const drawnCount = prize.prizeNumbers.filter((pn) => pn.kujiNumber.isDrawn).length
              const total = prize.prizeNumbers.length
              const remaining = total - drawnCount
              const isExhausted = remaining === 0

              const sortedNums = prize.prizeNumbers
                .map((pn) => pn.kujiNumber)
                .sort((a, b) => a.number - b.number)

              return (
                <div key={prize.id}
                  className={`rounded-2xl border overflow-hidden transition-all ${
                    isExhausted
                      ? 'border-gray-700 bg-gray-800/50 opacity-50'
                      : 'border-gray-700 bg-gray-800'
                  }`}
                >
                  {/* 이미지 */}
                  <div className="aspect-square bg-gray-700 overflow-hidden flex items-center justify-center">
                    {prize.images[0] ? (
                      <img src={prize.images[0].imageUrl} alt={prize.name}
                        className={`w-full h-full object-cover ${isExhausted ? 'grayscale' : ''}`} />
                    ) : (
                      <span className="text-4xl">{isExhausted ? '🩶' : '🎁'}</span>
                    )}
                  </div>

                  <div className="p-3">
                    {/* 이름 */}
                    <p className={`font-bold text-sm leading-tight ${
                      isExhausted ? 'text-gray-500 line-through' : 'text-white'
                    }`}>
                      {prize.name}
                    </p>

                    {/* 설명 */}
                    {prize.description && (
                      <p className={`text-xs mt-0.5 line-clamp-2 ${
                        isExhausted ? 'text-gray-600' : 'text-gray-400'
                      }`}>
                        {prize.description}
                      </p>
                    )}

                    {/* 잔여/전체 뱃지 */}
                    <div className="flex items-center justify-between mt-2">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        isExhausted
                          ? 'bg-gray-700 text-gray-500'
                          : 'bg-amber-500/20 text-amber-400'
                      }`}>
                        {remaining}/{total}
                      </span>
                    </div>

                    {/* 번호 */}
                    <div className="flex flex-wrap gap-1 mt-2">
                      {sortedNums.map((kn) => (
                        <span key={kn.id}
                          className={`text-xs font-mono px-1 py-0.5 rounded ${
                            kn.isDrawn
                              ? 'bg-gray-700 text-gray-500 line-through'
                              : 'bg-amber-500/15 text-amber-400'
                          }`}>
                          {kn.number}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
