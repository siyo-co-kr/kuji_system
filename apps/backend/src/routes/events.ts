import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { requireAuth } from '../plugins/auth.js'

const createEventSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  totalCount: z.number().int().min(1).max(10000),
  pricePerUnit: z.number().int().min(0),
})

export const eventRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (request) => {
    const storeId = (request.query as { storeId?: string }).storeId

    const events = await app.prisma.event.findMany({
      where: storeId ? { storeId } : undefined,
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

    return events
  })

  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }

    const event = await app.prisma.event.findUnique({
      where: { id },
      include: {
        prizes: {
          include: {
            images: { orderBy: { order: 'asc' } },
            prizeNumbers: {
              include: { kujiNumber: true },
            },
          },
        },
        _count: {
          select: {
            kujiNumbers: true,
          },
        },
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

    const numbers = await app.prisma.kujiNumber.findMany({
      where: { eventId: id },
      orderBy: { number: 'asc' },
      select: {
        id: true,
        number: true,
        isDrawn: true,
      },
    })

    return numbers
  })

  app.post('/', { preHandler: requireAuth }, async (request, reply) => {
    const { storeId } = request.user
    const body = createEventSchema.parse(request.body)

    const event = await app.prisma.$transaction(async (tx) => {
      const newEvent = await tx.event.create({
        data: {
          storeId,
          ...body,
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

  app.patch('/:id/status', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { status } = request.body as { status: 'active' | 'closed' }
    const { storeId } = request.user

    const event = await app.prisma.event.findFirst({ where: { id, storeId } })
    if (!event) return reply.status(404).send({ error: 'Event not found' })

    const updated = await app.prisma.event.update({
      where: { id },
      data: {
        status,
        startedAt: status === 'active' ? new Date() : undefined,
        endedAt: status === 'closed' ? new Date() : undefined,
      },
    })

    app.io.to(`event:${id}`).emit('event:updated', { eventId: id })

    return updated
  })
}
