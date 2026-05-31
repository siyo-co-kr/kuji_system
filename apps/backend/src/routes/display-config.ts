import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { requireAuth } from '../plugins/auth.js'

const notDeleted = { deletedAt: null as null }
const VALID_SLOTS = [2, 3, 4, 6] as const

const updateSchema = z.object({
  slots:    z.number().int().refine((v) => (VALID_SLOTS as readonly number[]).includes(v)),
  viewMode: z.enum(['multi', 'single']).default('multi'),
  slotEvents: z.array(z.object({
    slotIndex: z.number().int().min(0).max(5),
    eventId:   z.string().uuid().nullable(),
  })),
})

/** 슬롯에 이벤트 + 통계 + 번호 데이터를 attach해서 반환 */
async function buildSlotData(app: Parameters<FastifyPluginAsync>[0], layoutId: string, slotCount: number) {
  const slotRecords = await app.prisma.displaySlot.findMany({
    where: { layoutId },
    orderBy: { slotIndex: 'asc' },
  })
  const slotMap = new Map(slotRecords.map((s) => [s.slotIndex, s.eventId]))

  return Promise.all(
    Array.from({ length: slotCount }, async (_, i) => {
      const eventId = slotMap.get(i) ?? null
      if (!eventId) return { slotIndex: i, eventId: null, event: null, stats: null, numbers: [] }

      const [event, totalCount, remainingCount, totalPrizeCount, remainingPrizeCount, numbers] =
        await Promise.all([
          app.prisma.event.findFirst({
            where: { id: eventId, ...notDeleted },
            include: {
              prizes: {
                include: {
                  images: { orderBy: { order: 'asc' } },
                  prizeNumbers: {
                    include: { kujiNumber: { select: { id: true, number: true, isDrawn: true } } },
                  },
                },
              },
            },
          }),
          app.prisma.kujiNumber.count({ where: { eventId } }),
          app.prisma.kujiNumber.count({ where: { eventId, isDrawn: false } }),
          app.prisma.kujiNumber.count({ where: { eventId, isPrize: true } }),
          app.prisma.kujiNumber.count({ where: { eventId, isPrize: true, isDrawn: false } }),
          app.prisma.kujiNumber.findMany({
            where: { eventId },
            orderBy: { number: 'asc' },
            select: { id: true, number: true, isDrawn: true, isPrize: true },
          }),
        ])

      return {
        slotIndex: i, eventId,
        event,
        stats: event ? { totalCount, remainingCount, totalPrizeCount, remainingPrizeCount } : null,
        numbers,
      }
    })
  )
}

export const displayConfigRoutes: FastifyPluginAsync = async (app) => {
  // ── 현재 레이아웃 조회 ─────────────────────────────────────
  app.get('/', { preHandler: requireAuth }, async (request) => {
    const { storeId } = request.user

    let layout = await app.prisma.displayLayout.findUnique({ where: { storeId } })
    if (!layout) {
      layout = await app.prisma.displayLayout.create({ data: { storeId, slots: 2, viewMode: 'multi' } })
    }

    const slotData = await buildSlotData(app, layout.id, layout.slots)
    return { slots: layout.slots, viewMode: layout.viewMode, slotData }
  })

  // ── 레이아웃 저장 + 디스플레이 실시간 반영 ─────────────────
  app.patch('/', { preHandler: requireAuth }, async (request, reply) => {
    const { storeId } = request.user
    const { slots, viewMode, slotEvents } = updateSchema.parse(request.body)

    const layout = await app.prisma.displayLayout.upsert({
      where:  { storeId },
      create: { storeId, slots, viewMode },
      update: { slots, viewMode },
    })

    await app.prisma.displaySlot.deleteMany({ where: { layoutId: layout.id } })
    await app.prisma.displaySlot.createMany({
      data: slotEvents.map(({ slotIndex, eventId }) => ({ layoutId: layout.id, slotIndex, eventId })),
    })

    app.io.to(`store:${storeId}`).emit('display:config-updated', { storeId })

    const slotData = await buildSlotData(app, layout.id, slots)
    return reply.send({ slots, viewMode, slotData })
  })
}
