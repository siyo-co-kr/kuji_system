/**
 * 공개 API — 인증 없는 읽기 전용 엔드포인트
 * 디스플레이 앱(태블릿/PC/TV)에서 사용
 */
import { FastifyPluginAsync } from 'fastify'

const notDeleted = { deletedAt: null as null }
const visibleStatuses = ['active' as const, 'closed' as const]

/** isVisible=true 이며 삭제되지 않은 이벤트인지 확인 */
async function getVisibleEvent(app: Parameters<FastifyPluginAsync>[0], id: string) {
  return app.prisma.event.findFirst({
    where: { id, isVisible: true, ...notDeleted },
  })
}

export const publicRoutes: FastifyPluginAsync = async (app) => {
  // ── 공개 이벤트 목록 ──────────────────────────────────────
  // isVisible=true + active/closed 상태 + 삭제되지 않은 이벤트
  app.get('/events', async () => {
    const events = await app.prisma.event.findMany({
      where: {
        isVisible: true,
        status: { in: visibleStatuses },
        ...notDeleted,
      },
      select: {
        id: true,
        title: true,
        description: true,
        thumbnailUrl: true,
        totalCount: true,
        pricePerUnit: true,
        bonusEnabled: true,
        bonusThreshold: true,
        isVisible: true,
        status: true,
        startedAt: true,
        endedAt: true,
        createdAt: true,
        store: { select: { id: true, name: true } },
        _count: {
          select: {
            kujiNumbers: { where: { isDrawn: false } },
            prizes: true,
          },
        },
      },
      orderBy: { startedAt: 'desc' },
    })

    return events
  })

  // ── 공개 이벤트 상세 ──────────────────────────────────────
  app.get('/events/:id', async (request, reply) => {
    const { id } = request.params as { id: string }

    const event = await app.prisma.event.findFirst({
      where: { id, isVisible: true, ...notDeleted },
      include: {
        store: { select: { id: true, name: true } },
        prizes: {
          include: {
            images: { orderBy: { order: 'asc' } },
            prizeNumbers: {
              include: { kujiNumber: { select: { id: true, number: true, isDrawn: true } } },
            },
          },
        },
        _count: { select: { kujiNumbers: true } },
      },
    })

    if (!event) return reply.status(404).send({ error: 'Event not found or not visible' })
    return event
  })

  // ── 공개 이벤트 통계 ──────────────────────────────────────
  app.get('/events/:id/stats', async (request, reply) => {
    const { id } = request.params as { id: string }

    const event = await getVisibleEvent(app, id)
    if (!event) return reply.status(404).send({ error: 'Event not found or not visible' })

    const [totalCount, remainingCount, totalPrizeCount, remainingPrizeCount] = await Promise.all([
      app.prisma.kujiNumber.count({ where: { eventId: id } }),
      app.prisma.kujiNumber.count({ where: { eventId: id, isDrawn: false } }),
      app.prisma.kujiNumber.count({ where: { eventId: id, isPrize: true } }),
      app.prisma.kujiNumber.count({ where: { eventId: id, isPrize: true, isDrawn: false } }),
    ])

    return { totalCount, remainingCount, totalPrizeCount, remainingPrizeCount }
  })

  // ── 공개 이벤트 번호 목록 ─────────────────────────────────
  // isPrize 포함: 디스플레이 앱에서 경품 번호 색상 구분에 필요
  app.get('/events/:id/numbers', async (request, reply) => {
    const { id } = request.params as { id: string }

    const event = await getVisibleEvent(app, id)
    if (!event) return reply.status(404).send({ error: 'Event not found or not visible' })

    return app.prisma.kujiNumber.findMany({
      where: { eventId: id },
      orderBy: { number: 'asc' },
      select: { id: true, number: true, isDrawn: true, isPrize: true },
    })
  })
}
