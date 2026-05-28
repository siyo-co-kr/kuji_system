import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { requireAuth } from '../plugins/auth.js'

const createPaymentSchema = z.object({
  eventId: z.string().uuid(),
  kujiNumberIds: z.array(z.string().uuid()).min(1),
  method: z.enum(['app_simple', 'app_card', 'manual']),
})

export const paymentRoutes: FastifyPluginAsync = async (app) => {
  app.get('/pending', { preHandler: requireAuth }, async (request) => {
    const { storeId } = request.user

    const payments = await app.prisma.payment.findMany({
      where: { storeId, status: 'pending', method: 'manual' },
      include: {
        paymentNumbers: {
          include: { kujiNumber: true },
        },
        event: { select: { id: true, title: true } },
      },
      orderBy: { requestedAt: 'desc' },
    })

    return payments
  })

  app.post('/', async (request, reply) => {
    const body = createPaymentSchema.parse(request.body)

    const event = await app.prisma.event.findUniqueOrThrow({
      where: { id: body.eventId },
    })

    const kujiNumbers = await app.prisma.kujiNumber.findMany({
      where: {
        id: { in: body.kujiNumberIds },
        eventId: body.eventId,
        isDrawn: false,
      },
    })

    if (kujiNumbers.length !== body.kujiNumberIds.length) {
      return reply.status(400).send({ error: '이미 뽑힌 번호가 포함되어 있습니다.' })
    }

    const totalAmount = kujiNumbers.length * event.pricePerUnit

    const payment = await app.prisma.$transaction(async (tx) => {
      const newPayment = await tx.payment.create({
        data: {
          eventId: body.eventId,
          storeId: event.storeId,
          totalAmount,
          method: body.method,
          status: body.method === 'manual' ? 'pending' : 'pending',
          paymentNumbers: {
            create: body.kujiNumberIds.map((kujiNumberId) => ({ kujiNumberId })),
          },
        },
      })

      return newPayment
    })

    if (body.method === 'manual') {
      app.io.to(`store:${event.storeId}`).emit('payment:pending', {
        paymentId: payment.id,
        payment,
      })
    }

    return reply.status(201).send(payment)
  })

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
