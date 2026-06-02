import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { requireAuth } from '../plugins/auth.js'

const updateEventSchema = z.object({
  title:          z.string().min(1).optional(),
  description:    z.string().optional().nullable(),
  thumbnailUrl:   z.string().url().optional().nullable().or(z.literal('')),
  bonusEnabled:   z.boolean().optional(),
  bonusThreshold: z.number().int().min(2).max(100).optional(),
  pricePerUnit:   z.number().int().min(0).optional(),
})

const createEventSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  thumbnailUrl: z.string().url().optional().or(z.literal('')),
  totalCount: z.number().int().min(1).max(10000),
  pricePerUnit: z.number().int().min(0),
  bonusEnabled: z.boolean().optional().default(false),
  bonusThreshold: z.number().int().min(2).max(100).optional().default(10),
  isVisible: z.boolean().optional().default(false),
})

const bulkDeleteSchema = z.object({
  eventIds: z.array(z.string().uuid()).min(1),
})

/** 삭제되지 않은 이벤트만 조회하는 기본 조건 */
const notDeleted = { deletedAt: null }

export const eventRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (request) => {
    const storeId = (request.query as { storeId?: string }).storeId

    return app.prisma.event.findMany({
      where: storeId ? { storeId, ...notDeleted } : notDeleted,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            kujiNumbers: { where: { isDrawn: false } },
            prizes: true,
          },
        },
      },
    })
  })

  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }

    const event = await app.prisma.event.findFirst({
      where: { id, ...notDeleted },
      include: {
        prizes: {
          include: {
            images: { orderBy: { order: 'asc' } },
            prizeNumbers: { include: { kujiNumber: true } },
          },
        },
        _count: { select: { kujiNumbers: true } },
      },
    })

    if (!event) return reply.status(404).send({ error: 'Event not found' })
    return event
  })

  app.get('/:id/stats', async (request, reply) => {
    const { id } = request.params as { id: string }

    const [totalCount, remainingCount, totalPrizeCount, remainingPrizeCount] = await Promise.all([
      app.prisma.kujiNumber.count({ where: { eventId: id } }),
      app.prisma.kujiNumber.count({ where: { eventId: id, isDrawn: false } }),
      app.prisma.kujiNumber.count({ where: { eventId: id, isPrize: true } }),
      app.prisma.kujiNumber.count({ where: { eventId: id, isPrize: true, isDrawn: false } }),
    ])

    return { totalCount, remainingCount, totalPrizeCount, remainingPrizeCount }
  })

  app.get('/:id/numbers', async (request) => {
    const { id } = request.params as { id: string }

    return app.prisma.kujiNumber.findMany({
      where: { eventId: id },
      orderBy: { number: 'asc' },
      select: { id: true, number: true, isDrawn: true },
    })
  })

  app.post('/', { preHandler: requireAuth }, async (request, reply) => {
    const { storeId } = request.user
    const body = createEventSchema.parse(request.body)

    const event = await app.prisma.$transaction(async (tx) => {
      const newEvent = await tx.event.create({
        data: {
          storeId,
          ...body,
          thumbnailUrl:   body.thumbnailUrl   || null,
          bonusEnabled:   body.bonusEnabled    ?? false,
          bonusThreshold: body.bonusThreshold  ?? 10,
          isVisible:      body.isVisible       ?? false,
        },
      })

      await tx.kujiNumber.createMany({
        data: Array.from({ length: body.totalCount }, (_, i) => ({
          eventId: newEvent.id,
          number: i + 1,
        })),
      })

      return newEvent
    })

    return reply.status(201).send(event)
  })

  // ── 이벤트 정보 수정 ─────────────────────────────────────────
  app.patch('/:id', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { storeId } = request.user
    const body = updateEventSchema.parse(request.body)

    const event = await app.prisma.event.findFirst({ where: { id, storeId, ...notDeleted } })
    if (!event) return reply.status(404).send({ error: 'Event not found' })

    const updated = await app.prisma.event.update({
      where: { id },
      data: {
        ...body,
        thumbnailUrl: body.thumbnailUrl === '' ? null : body.thumbnailUrl,
      },
    })

    return updated
  })

  // ── 이벤트 상태 변경 (자유롭게 전환 가능) ───────────────────
  app.patch('/:id/status', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { status } = request.body as { status: 'draft' | 'active' | 'closed' }
    const { storeId } = request.user

    const event = await app.prisma.event.findFirst({ where: { id, storeId, ...notDeleted } })
    if (!event) return reply.status(404).send({ error: 'Event not found' })

    const updated = await app.prisma.event.update({
      where: { id },
      data: {
        status,
        startedAt: status === 'active' && !event.startedAt ? new Date() : undefined,
        endedAt:   status === 'closed' && !event.endedAt   ? new Date() : undefined,
      },
    })

    app.io.to(`event:${id}`).emit('event:updated', { eventId: id })
    return updated
  })

  // ── 번호 수동 추첨 (어드민 클릭) ─────────────────────────────
  app.patch('/:id/numbers/:numberId/draw', { preHandler: requireAuth }, async (request, reply) => {
    const { id, numberId } = request.params as { id: string; numberId: string }
    const { storeId } = request.user

    // 이벤트 소유 확인
    const event = await app.prisma.event.findFirst({ where: { id, storeId, ...notDeleted } })
    if (!event) return reply.status(404).send({ error: 'Event not found' })

    const kujiNumber = await app.prisma.kujiNumber.findFirst({
      where: { id: numberId, eventId: id },
    })
    if (!kujiNumber) return reply.status(404).send({ error: 'Number not found' })

    // 토글: 추첨 ↔ 미추첨
    const newDrawn = !kujiNumber.isDrawn
    const updated = await app.prisma.kujiNumber.update({
      where: { id: numberId },
      data: {
        isDrawn:  newDrawn,
        drawnAt:  newDrawn ? new Date() : null,
      },
    })

    if (newDrawn) {
      app.io.to(`event:${id}`).emit('number:drawn', { eventId: id, numbers: [updated] })
    } else {
      app.io.to(`event:${id}`).emit('event:updated', { eventId: id })
    }
    app.log.info({ eventId: id, numberId, number: updated.number, isDrawn: newDrawn }, `번호 수동 ${newDrawn ? '추첨' : '추첨 취소'}`)

    return { ...updated, toggled: newDrawn ? 'drawn' : 'undrawn' }
  })

  // ── 디스플레이 노출 설정 ──────────────────────────────────
  app.patch('/:id/visibility', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { isVisible } = request.body as { isVisible: boolean }
    const { storeId } = request.user

    const event = await app.prisma.event.findFirst({ where: { id, storeId, ...notDeleted } })
    if (!event) return reply.status(404).send({ error: 'Event not found' })

    const updated = await app.prisma.event.update({
      where: { id },
      data: { isVisible },
    })

    app.io.to(`event:${id}`).emit('event:updated', { eventId: id })
    return updated
  })

  // ── 이벤트 삭제 (소프트 삭제) ────────────────────────────
  // 결제 내역 보존: DB에서 제거하지 않고 deletedAt 만 설정
  app.delete('/:id', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { storeId } = request.user

    const event = await app.prisma.event.findFirst({
      where: { id, storeId, ...notDeleted },
    })
    if (!event) return reply.status(404).send({ error: 'Event not found' })

    if (event.status === 'active') {
      return reply.status(400).send({ error: '진행중인 이벤트는 삭제할 수 없습니다.' })
    }

    await app.prisma.event.update({
      where: { id },
      data: { deletedAt: new Date() },
    })

    return reply.status(204).send()
  })

  // ── 종료 이벤트 일괄 삭제 ─────────────────────────────────
  app.post('/bulk-delete', { preHandler: requireAuth }, async (request, reply) => {
    const { storeId } = request.user
    const body = bulkDeleteSchema.parse(request.body)

    // 소유권 확인 + closed 상태만 허용
    const events = await app.prisma.event.findMany({
      where: {
        id: { in: body.eventIds },
        storeId,
        status: 'closed',
        ...notDeleted,
      },
      select: { id: true },
    })

    if (events.length === 0) {
      return reply.status(400).send({ error: '삭제 가능한 이벤트가 없습니다.' })
    }

    const validIds = events.map((e) => e.id)
    await app.prisma.event.updateMany({
      where: { id: { in: validIds } },
      data: { deletedAt: new Date() },
    })

    return reply.send({ deleted: validIds.length })
  })
}
