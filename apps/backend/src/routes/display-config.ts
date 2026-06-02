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

/**
 * 슬롯 데이터 배치 조회 — N+1 없이 7개 쿼리로 전체 슬롯 처리
 * (기존: 슬롯당 6쿼리 → 6분할 시 36쿼리)
 */
async function buildSlotData(app: Parameters<FastifyPluginAsync>[0], layoutId: string, slotCount: number) {
  const slotRecords = await app.prisma.displaySlot.findMany({
    where: { layoutId },
    orderBy: { slotIndex: 'asc' },
  })
  const slotMap = new Map(slotRecords.map((s) => [s.slotIndex, s.eventId]))
  const eventIds = [...new Set(slotRecords.map((s) => s.eventId).filter(Boolean) as string[])]

  if (eventIds.length === 0) {
    return Array.from({ length: slotCount }, (_, i) => ({
      slotIndex: i, eventId: null, event: null, stats: null, numbers: [],
    }))
  }

  // 7개 배치 쿼리 (슬롯 수와 무관)
  const [events, totalCounts, remainingCounts, prizeCounts, remainingPrizeCounts, allNumbers] =
    await Promise.all([
      app.prisma.event.findMany({
        where: { id: { in: eventIds }, ...notDeleted },
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
      app.prisma.kujiNumber.groupBy({ by: ['eventId'], where: { eventId: { in: eventIds } }, _count: true }),
      app.prisma.kujiNumber.groupBy({ by: ['eventId'], where: { eventId: { in: eventIds }, isDrawn: false }, _count: true }),
      app.prisma.kujiNumber.groupBy({ by: ['eventId'], where: { eventId: { in: eventIds }, isPrize: true }, _count: true }),
      app.prisma.kujiNumber.groupBy({ by: ['eventId'], where: { eventId: { in: eventIds }, isPrize: true, isDrawn: false }, _count: true }),
      app.prisma.kujiNumber.findMany({
        where: { eventId: { in: eventIds } },
        orderBy: { number: 'asc' },
        select: { id: true, eventId: true, number: true, isDrawn: true, isPrize: true },
      }),
    ])

  // Map으로 변환
  const eventMap   = new Map(events.map((e) => [e.id, e]))
  const toMap      = (arr: { eventId: string; _count: number }[]) => new Map(arr.map((r) => [r.eventId, r._count]))
  const totalMap   = toMap(totalCounts)
  const remainMap  = toMap(remainingCounts)
  const prizeMap   = toMap(prizeCounts)
  const remPrizeMap = toMap(remainingPrizeCounts)
  const numbersMap = allNumbers.reduce<Map<string, typeof allNumbers>>((m, n) => {
    if (!m.has(n.eventId)) m.set(n.eventId, [])
    m.get(n.eventId)!.push(n)
    return m
  }, new Map())

  return Array.from({ length: slotCount }, (_, i) => {
    const eventId = slotMap.get(i) ?? null
    if (!eventId) return { slotIndex: i, eventId: null, event: null, stats: null, numbers: [] }
    const event = eventMap.get(eventId) ?? null
    return {
      slotIndex: i,
      eventId,
      event,
      stats: event
        ? {
            totalCount:           totalMap.get(eventId)    ?? 0,
            remainingCount:       remainMap.get(eventId)   ?? 0,
            totalPrizeCount:      prizeMap.get(eventId)    ?? 0,
            remainingPrizeCount:  remPrizeMap.get(eventId) ?? 0,
          }
        : null,
      numbers: numbersMap.get(eventId) ?? [],
    }
  })
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
