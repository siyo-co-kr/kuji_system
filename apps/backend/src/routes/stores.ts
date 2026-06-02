import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { requireAuth } from '../plugins/auth.js'

const updateStoreSchema = z.object({
  name:    z.string().min(1).optional(),
  address: z.string().optional().nullable(),
  phone:   z.string().optional().nullable(),
})

export const storeRoutes: FastifyPluginAsync = async (app) => {
  // ── 내 매장 정보 조회 ──────────────────────────────────────
  app.get('/my', { preHandler: requireAuth }, async (request) => {
    const { storeId } = request.user
    return app.prisma.store.findUniqueOrThrow({ where: { id: storeId } })
  })

  // ── 내 매장 정보 수정 ──────────────────────────────────────
  app.patch('/my', { preHandler: requireAuth }, async (request, reply) => {
    const { storeId, accountId } = request.user
    const body = updateStoreSchema.parse(request.body)

    const store = await app.prisma.store.update({ where: { id: storeId }, data: body })
    app.log.info({ storeId, accountId }, '매장 정보 수정')
    return reply.send({ message: '매장 정보가 수정됐습니다.', store })
  })
}
