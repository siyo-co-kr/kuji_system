import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { requireAuth } from '../plugins/auth.js'

const createPaymentSchema = z.object({
  eventId: z.string().uuid(),
  kujiNumberIds: z.array(z.string().uuid()).min(1),
  method: z.enum(['app_simple', 'app_card', 'manual']),
})

export const paymentRoutes: FastifyPluginAsync = async (app) => {
  // ── 승인 대기 결제 목록 ───────────────────────────────────
  app.get('/pending', { preHandler: requireAuth }, async (request) => {
    const { storeId } = request.user

    return app.prisma.payment.findMany({
      where: { storeId, status: 'pending', method: 'manual' },
      include: {
        paymentNumbers: { include: { kujiNumber: true } },
        event: { select: { id: true, title: true, bonusEnabled: true } },
      },
      orderBy: { requestedAt: 'desc' },
    })
  })

  // ── 결제 내역 (전체 목록 + 페이징) ──────────────────────────
  app.get('/history', { preHandler: requireAuth }, async (request) => {
    const { storeId } = request.user
    const q = request.query as { page?: string; limit?: string; status?: string }
    const page  = Math.max(1, Number(q.page)  || 1)
    const limit = Math.min(100, Math.max(1, Number(q.limit) || 30))
    const skip  = (page - 1) * limit

    type PaymentStatus = 'pending' | 'confirmed' | 'cancelled'
    const where: { storeId: string; status?: PaymentStatus } = { storeId }
    if (q.status && ['pending', 'confirmed', 'cancelled'].includes(q.status)) {
      where.status = q.status as PaymentStatus
    }

    const [total, payments] = await Promise.all([
      app.prisma.payment.count({ where }),
      app.prisma.payment.findMany({
        where,
        include: {
          event: { select: { id: true, title: true, deletedAt: true, bonusEnabled: true } },
          paymentNumbers: { select: { id: true, isBonus: true } },
        },
        orderBy: { requestedAt: 'desc' },
        skip,
        take: limit,
      }),
    ])

    return {
      data: payments.map((p) => ({
        ...p,
        paidCount:    p.paidCount || p.paymentNumbers.filter(pn => !pn.isBonus).length,
        bonusCount:   p.bonusCount,
        ticketCount:  p.paymentNumbers.length,
        eventTitle:   p.event?.title ?? '(이벤트 없음)',
        eventDeleted: !!(p.event?.deletedAt),
      })),
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    }
  })

  // ── 결제 생성 ─────────────────────────────────────────────
  app.post('/', async (request, reply) => {
    const body = createPaymentSchema.parse(request.body)

    const event = await app.prisma.event.findUniqueOrThrow({
      where: { id: body.eventId },
    })

    // 요청한 번호들이 모두 유효한지 확인
    const requestedNumbers = await app.prisma.kujiNumber.findMany({
      where: {
        id: { in: body.kujiNumberIds },
        eventId: body.eventId,
        isDrawn: false,
      },
    })

    if (requestedNumbers.length !== body.kujiNumberIds.length) {
      return reply.status(400).send({ error: '이미 뽑힌 번호가 포함되어 있습니다.' })
    }

    // ── 10+1 보너스 계산 ─────────────────────────────────────
    const paidCount  = body.kujiNumberIds.length
    const totalAmount = paidCount * event.pricePerUnit
    let bonusNumberIds: string[] = []
    let bonusCount = 0

    if (event.bonusEnabled && event.bonusThreshold > 0) {
      bonusCount = Math.floor(paidCount / event.bonusThreshold)
      if (bonusCount > 0) {
        // 이미 선택된 번호를 제외한 뽑히지 않은 번호 중 무작위로 선택
        const available = await app.prisma.kujiNumber.findMany({
          where: {
            eventId: body.eventId,
            isDrawn: false,
            id: { notIn: body.kujiNumberIds },
          },
          select: { id: true },
        })

        // Fisher-Yates 셔플로 무작위 선택
        const shuffled = [...available].sort(() => Math.random() - 0.5)
        bonusNumberIds = shuffled.slice(0, bonusCount).map((n) => n.id)
        bonusCount = bonusNumberIds.length // 실제로 추가된 수 (부족하면 줄어들 수 있음)
      }
    }

    // ── 결제 생성 ─────────────────────────────────────────────
    const payment = await app.prisma.$transaction(async (tx) => {
      const newPayment = await tx.payment.create({
        data: {
          eventId: body.eventId,
          storeId: event.storeId,
          totalAmount,
          paidCount,
          bonusCount,
          method: body.method,
          status: 'pending',
          paymentNumbers: {
            create: [
              ...body.kujiNumberIds.map((kujiNumberId) => ({
                kujiNumberId,
                isBonus: false,
              })),
              ...bonusNumberIds.map((kujiNumberId) => ({
                kujiNumberId,
                isBonus: true,
              })),
            ],
          },
        },
        include: {
          paymentNumbers: {
            include: { kujiNumber: true },
          },
        },
      })

      return newPayment
    })

    if (body.method === 'manual') {
      app.io.to(`store:${event.storeId}`).emit('payment:pending', {
        paymentId: payment.id,
        payment,
        bonusCount,
      })
    }

    return reply.status(201).send({
      ...payment,
      bonusCount,
      message: bonusCount > 0
        ? `10+1 이벤트 적용! 보너스 번호 ${bonusCount}개가 자동 추가됐습니다.`
        : undefined,
    })
  })

  // ── 결제 확인 ─────────────────────────────────────────────
  app.post('/:id/confirm', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { accountId, storeId } = request.user

    const payment = await app.prisma.payment.findFirst({
      where: { id, storeId, status: 'pending' },
      include: {
        paymentNumbers: { include: { kujiNumber: true } },
      },
    })

    if (!payment) return reply.status(404).send({ error: 'Payment not found' })

    const confirmedPayment = await app.prisma.$transaction(async (tx) => {
      await tx.kujiNumber.updateMany({
        where: { id: { in: payment.paymentNumbers.map((p) => p.kujiNumberId) } },
        data: { isDrawn: true, drawnAt: new Date() },
      })

      return tx.payment.update({
        where: { id },
        data: {
          status: 'confirmed',
          confirmedAt: new Date(),
          confirmedById: accountId,
        },
        include: {
          paymentNumbers: {
            include: {
              kujiNumber: {
                include: { prizeNumber: { include: { prize: true } } },
              },
            },
          },
        },
      })
    })

    const drawnNumbers = confirmedPayment.paymentNumbers.map((pn) => pn.kujiNumber)

    app.io.to(`event:${payment.eventId}`).emit('payment:confirmed', {
      paymentId: id,
      numbers: drawnNumbers,
    })

    return confirmedPayment
  })

  // ── 결제 취소 ─────────────────────────────────────────────
  app.post('/:id/cancel', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { storeId } = request.user

    const payment = await app.prisma.payment.findFirst({
      where: { id, storeId, status: 'pending' },
    })

    if (!payment) return reply.status(404).send({ error: 'Payment not found' })

    await app.prisma.payment.update({
      where: { id },
      data: { status: 'cancelled' },
    })

    app.io.to(`event:${payment.eventId}`).emit('payment:cancelled', { paymentId: id })

    return reply.status(204).send()
  })
}
