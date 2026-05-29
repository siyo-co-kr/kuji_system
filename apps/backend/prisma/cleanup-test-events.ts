/**
 * 테스트 이벤트 삭제 스크립트
 * 실행: tsx prisma/cleanup-test-events.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // siyo 매장의 모든 이벤트 ID 조회
  const events = await prisma.event.findMany({
    where: { storeId: 'seed-store-siyo' },
    select: { id: true, title: true, status: true },
  })

  if (events.length === 0) {
    console.log('삭제할 이벤트가 없습니다.')
    return
  }

  console.log(`삭제 대상 이벤트 ${events.length}개:`)
  events.forEach((e) => console.log(`  - [${e.status}] ${e.title} (${e.id})`))

  const eventIds = events.map((e) => e.id)

  // 관련 데이터를 순서대로 삭제 (FK 제약 순서 고려)
  await prisma.$transaction([
    // PaymentNumber 삭제
    prisma.paymentNumber.deleteMany({
      where: { kujiNumber: { eventId: { in: eventIds } } },
    }),
    // Payment 삭제
    prisma.payment.deleteMany({ where: { eventId: { in: eventIds } } }),
    // PrizeNumber 삭제
    prisma.prizeNumber.deleteMany({
      where: { kujiNumber: { eventId: { in: eventIds } } },
    }),
    // PrizeImage 삭제
    prisma.prizeImage.deleteMany({
      where: { prize: { eventId: { in: eventIds } } },
    }),
    // Prize 삭제
    prisma.prize.deleteMany({ where: { eventId: { in: eventIds } } }),
    // KujiNumber 삭제
    prisma.kujiNumber.deleteMany({ where: { eventId: { in: eventIds } } }),
    // Event 삭제
    prisma.event.deleteMany({ where: { id: { in: eventIds } } }),
  ])

  console.log(`\n✅ ${events.length}개 이벤트 및 관련 데이터 삭제 완료`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
