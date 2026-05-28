import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { requireAuth } from '../plugins/auth.js'

const createPrizeSchema = z.object({
  eventId: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().optional(),
  quantity: z.number().int().min(1),
  numberIds: z.array(z.string().uuid()).min(1),
})

export const prizeRoutes: FastifyPluginAsync = async (app) => {
  app.post('/', { preHandler: requireAuth }, async (request, reply) => {
    const body = createPrizeSchema.parse(request.body)
    const { storeId } = request.user

    const event = await app.prisma.event.findFirst({
      where: { id: body.eventId, storeId },
    })
    if (!event) return reply.status(404).send({ error: 'Event not found' })

    const prize = await app.prisma.$transaction(async (tx) => {
      const newPrize = await tx.prize.create({
        data: {
          eventId: body.eventId,
          name: body.name,
          description: body.description,
          quantity: body.quantity,
        },
      })

      await tx.kujiNumber.updateMany({
        where: { id: { in: body.numberIds }, eventId: body.eventId },
        data: { isPrize: true },
      })

      await tx.prizeNumber.createMany({
        data: body.numberIds.map((kujiNumberId) => ({
          prizeId: newPrize.id,
          kujiNumberId,
        })),
      })

      return tx.prize.findUniqueOrThrow({
        where: { id: newPrize.id },
        include: {
          images: true,
          prizeNumbers: { include: { kujiNumber: true } },
        },
      })
    })

    return reply.status(201).send(prize)
  })

  app.post('/:id/images', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { imageUrl, order } = request.body as { imageUrl: string; order?: number }

    const image = await app.prisma.prizeImage.create({
      data: { prizeId: id, imageUrl, order: order ?? 0 },
    })

    return reply.status(201).send(image)
  })

  app.delete('/:id', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string }

    await app.prisma.$transaction(async (tx) => {
      const prize = await tx.prize.findUniqueOrThrow({
        where: { id },
        include: { prizeNumbers: true },
      })

      await tx.kujiNumber.updateMany({
        where: { id: { in: prize.prizeNumbers.map((p) => p.kujiNumberId) } },
        data: { isPrize: false },
      })

      await tx.prizeNumber.deleteMany({ where: { prizeId: id } })
      await tx.prizeImage.deleteMany({ where: { prizeId: id } })
      await tx.prize.delete({ where: { id } })
    })

    return reply.status(204).send()
  })
}
