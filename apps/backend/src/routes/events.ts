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
  totalCount: z.number().int().min(1).max(100000),
  pricePerUnit: z.number().int().min(0),
  bonusEnabled: z.boolean().optional().default(false),
  bonusThreshold: z.number().int().min(2).max(100).optional().default(10),
  isVisible: z.boolean().optional().default(false),
  // 오프라인 모드 전용
  mode: z.enum(['online', 'offline']).optional().default('online'),
  maxNumber: z.number().int().min(1).optional(),
  prizeNumbers: z.array(z.number().int().min(1)).optional().default([]),
})

/**
 * 오프라인 쿠지 번호 생성 알고리즘
 * - 1차 싸이클: 1 ~ maxNumber (경품 번호 포함, 1회만 등장)
 * - 2차~ 싸이클: 1 ~ maxNumber 중 경품 번호 제외하며 반복
 * - totalCount 에 도달하면 종료
 */
function generateOfflineNumbers(totalCount: number, maxNumber: number, prizeNumberSet: Set<number>): number[] {
  const result: number[] = []

  // 1차 싸이클: 모든 번호 포함
  for (let n = 1; n <= maxNumber && result.length < totalCount; n++) {
    result.push(n)
  }

  // 2차~ 싸이클: 경품 번호 제외
  const nonPrizeCount = maxNumber - prizeNumberSet.size
  if (nonPrizeCount <= 0) return result  // 모든 번호가 경품이면 반복 불가

  while (result.length < totalCount) {
    for (let n = 1; n <= maxNumber && result.length < totalCount; n++) {
      if (!prizeNumberSet.has(n)) {
        result.push(n)
      }
    }
  }

  return result
}

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
      select: { id: true, number: true, isDrawn: true, isPrize: true },
    })
  })

  app.post('/', { preHandler: requireAuth }, async (request, reply) => {
    const { storeId } = request.user
    const body = createEventSchema.parse(request.body)

    // 오프라인 모드 유효성 검사
    if (body.mode === 'offline') {
      if (!body.maxNumber) {
        return reply.status(400).send({ error: '오프라인 모드는 최대 번호(maxNumber)가 필요합니다.' })
      }
      if (body.maxNumber > body.totalCount) {
        return reply.status(400).send({ error: '최대 번호는 전체 번호 수보다 클 수 없습니다.' })
      }
      const invalidPrize = (body.prizeNumbers ?? []).find((n) => n > body.maxNumber!)
      if (invalidPrize) {
        return reply.status(400).send({ error: `경품 번호 ${invalidPrize}이(가) 최대 번호(${body.maxNumber})를 초과합니다.` })
      }
    }

    const event = await app.prisma.$transaction(async (tx) => {
      const newEvent = await tx.event.create({
        data: {
          storeId,
          title:          body.title,
          description:    body.description    || null,
          thumbnailUrl:   body.thumbnailUrl   || null,
          totalCount:     body.totalCount,
          pricePerUnit:   body.pricePerUnit,
          bonusEnabled:   body.bonusEnabled   ?? false,
          bonusThreshold: body.bonusThreshold ?? 10,
          isVisible:      body.isVisible      ?? false,
          mode:           body.mode           ?? 'online',
          maxNumber:      body.mode === 'offline' ? (body.maxNumber ?? null) : null,
        },
      })

      // 번호 생성
      let numberSequence: number[]
      const prizeSet = body.mode === 'offline' ? new Set(body.prizeNumbers ?? []) : new Set<number>()
      if (body.mode === 'offline' && body.maxNumber) {
        numberSequence = generateOfflineNumbers(body.totalCount, body.maxNumber, prizeSet)
      } else {
        numberSequence = Array.from({ length: body.totalCount }, (_, i) => i + 1)
      }

      await tx.kujiNumber.createMany({
        data: numberSequence.map((number) => ({
          eventId: newEvent.id,
          number,
        })),
      })

      // 오프라인 모드: 지정된 경품 번호를 isPrize = true 로 pre-mark
      if (body.mode === 'offline' && prizeSet.size > 0) {
        await tx.kujiNumber.updateMany({
          where: { eventId: newEvent.id, number: { in: [...prizeSet] } },
          data: { isPrize: true },
        })
      }

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

  // ── 번호 일괄 비활성화 (번호값 입력) ───────────────────────────
  app.patch('/:id/numbers/batch-draw', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { storeId } = request.user
    const { numbers: numberValues } = request.body as { numbers: number[] }

    if (!Array.isArray(numberValues) || numberValues.length === 0) {
      return reply.status(400).send({ error: '번호 목록이 필요합니다.' })
    }

    const event = await app.prisma.event.findFirst({ where: { id, storeId, ...notDeleted } })
    if (!event) return reply.status(404).send({ error: 'Event not found' })
    if (event.status !== 'active') {
      return reply.status(400).send({ error: '진행중인 이벤트에서만 사용 가능합니다.' })
    }

    const drawnList: { id: string; number: number; isDrawn: boolean; drawnAt: Date | null }[] = []

    for (const numValue of numberValues) {
      const kujiNumber = await app.prisma.kujiNumber.findFirst({
        where: { eventId: id, number: numValue, isDrawn: false },
      })
      if (!kujiNumber) continue

      const updated = await app.prisma.kujiNumber.update({
        where: { id: kujiNumber.id },
        data: { isDrawn: true, drawnAt: new Date() },
      })
      drawnList.push(updated)
    }

    if (drawnList.length > 0) {
      app.io.to(`event:${id}`).emit('number:drawn', { eventId: id, numbers: drawnList })
    }

    return reply.send({ drawn: drawnList.length, skipped: numberValues.length - drawnList.length })
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
