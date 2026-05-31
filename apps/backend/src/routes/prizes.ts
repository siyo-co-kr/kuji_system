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

  // ── 경품 수정 (이름·설명·이미지·번호 변경) ──────────────────
  app.patch('/:id', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = request.body as {
      name?:       string
      description?: string
      imageUrl?:   string | null   // 이미지 URL (null = 삭제)
      numberIds?:  string[]        // 새 번호 목록 (전체 교체)
    }
    const { storeId } = request.user

    // 소유 확인
    const prize = await app.prisma.prize.findFirst({
      where: { id, event: { storeId } },
      include: { prizeNumbers: true, images: true },
    })
    if (!prize) return reply.status(404).send({ error: 'Prize not found' })

    await app.prisma.$transaction(async (tx) => {
      // 이름·설명 업데이트
      const prizeData: Record<string, unknown> = {}
      if (body.name        !== undefined) prizeData.name        = body.name
      if (body.description !== undefined) prizeData.description = body.description

      // 이미지 교체 (기존 삭제 후 새 이미지 등록)
      if (body.imageUrl !== undefined) {
        await tx.prizeImage.deleteMany({ where: { prizeId: id } })
        if (body.imageUrl) {
          await tx.prizeImage.create({ data: { prizeId: id, imageUrl: body.imageUrl, order: 0 } })
        }
      }

      // 번호 재배정
      if (body.numberIds !== undefined) {
        const currentIds = prize.prizeNumbers.map((pn) => pn.kujiNumberId)
        const removedIds = currentIds.filter((cid) => !body.numberIds!.includes(cid))
        const addedIds   = body.numberIds.filter((nid) => !currentIds.includes(nid))

        if (removedIds.length > 0) {
          await tx.prizeNumber.deleteMany({ where: { prizeId: id, kujiNumberId: { in: removedIds } } })
          await tx.kujiNumber.updateMany({ where: { id: { in: removedIds } }, data: { isPrize: false } })
        }
        if (addedIds.length > 0) {
          await tx.prizeNumber.createMany({
            data: addedIds.map((kujiNumberId) => ({ prizeId: id, kujiNumberId })),
          })
          await tx.kujiNumber.updateMany({ where: { id: { in: addedIds } }, data: { isPrize: true } })
        }

        prizeData.quantity = body.numberIds.length
      }

      if (Object.keys(prizeData).length > 0) {
        await tx.prize.update({ where: { id }, data: prizeData })
      }
    })

    const updated = await app.prisma.prize.findUniqueOrThrow({
      where: { id },
      include: {
        images: true,
        prizeNumbers: { include: { kujiNumber: true } },
      },
    })

    return reply.send(updated)
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
