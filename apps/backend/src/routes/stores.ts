import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'

async function requireAuth(
  request: Parameters<typeof import('../plugins/auth.js').requireAuth>[0],
  reply: Parameters<typeof import('../plugins/auth.js').requireAuth>[1]
) {
  try {
    await request.jwtVerify()
  } catch {
    return reply.status(401).send({ error: 'Unauthorized' })
  }
}

const updateStoreSchema = z.object({
  name:    z.string().min(1).optional(),
  address: z.string().optional().nullable(),
  phone:   z.string().optional().nullable(),
})

export const storeRoutes: FastifyPluginAsync = async (app) => {
  // ── 내 매장 정보 조회 ──────────────────────────────────────
  app.get('/my', { preHandler: requireAuth }, async (request, reply) => {
    const { storeId } = request.user

    const store = await app.prisma.store.findUniqueOrThrow({ where: { id: storeId } })
    return store
  })

  // ── 내 매장 정보 수정 ──────────────────────────────────────
  app.patch('/my', { preHandler: requireAuth }, async (request, reply) => {
    const { storeId } = request.user
    const body = updateStoreSchema.parse(request.body)

    const store = await app.prisma.store.update({
      where: { id: storeId },
      data: body,
    })

    return reply.send({ message: '매장 정보가 수정됐습니다.', store })
  })
}
