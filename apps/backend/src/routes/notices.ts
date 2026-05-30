import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'

async function requireAuth(
  request: Parameters<typeof import('../plugins/auth.js').requireAuth>[0],
  reply: Parameters<typeof import('../plugins/auth.js').requireAuth>[1]
) {
  try { await request.jwtVerify() }
  catch { return reply.status(401).send({ error: 'Unauthorized' }) }
}

async function requireSuperAdmin(
  request: Parameters<typeof import('../plugins/auth.js').requireAuth>[0],
  reply: Parameters<typeof import('../plugins/auth.js').requireAuth>[1]
) {
  try { await request.jwtVerify() }
  catch { return reply.status(401).send({ error: 'Unauthorized' }) }
  if (request.user?.role !== 'superadmin') {
    return reply.status(403).send({ error: '슈퍼 어드민 권한이 필요합니다.' })
  }
}

const noticeSchema = z.object({
  title:    z.string().min(1).max(200),
  content:  z.string().min(1),
  isPinned: z.boolean().optional().default(false),
})

export const noticeRoutes: FastifyPluginAsync = async (app) => {
  // ── 공지 목록 (로그인한 사용자 모두 조회 가능) ──────────────
  app.get('/', { preHandler: requireAuth }, async (request) => {
    const q = request.query as { limit?: string }
    const limit = Math.min(50, Number(q.limit) || 10)

    return app.prisma.notice.findMany({
      orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
      take: limit,
    })
  })

  // ── 공지 단건 조회 ────────────────────────────────────────
  app.get('/:id', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const notice = await app.prisma.notice.findUnique({ where: { id } })
    if (!notice) return reply.status(404).send({ error: '공지사항을 찾을 수 없습니다.' })
    return notice
  })

  // ── 공지 생성 (슈퍼 어드민 전용) ─────────────────────────
  app.post('/', { preHandler: requireSuperAdmin }, async (request, reply) => {
    const body = noticeSchema.parse(request.body)
    const notice = await app.prisma.notice.create({ data: body })
    return reply.status(201).send(notice)
  })

  // ── 공지 수정 (슈퍼 어드민 전용) ─────────────────────────
  app.patch('/:id', { preHandler: requireSuperAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = noticeSchema.partial().parse(request.body)
    const notice = await app.prisma.notice.update({ where: { id }, data: body })
    return reply.send(notice)
  })

  // ── 공지 삭제 (슈퍼 어드민 전용) ─────────────────────────
  app.delete('/:id', { preHandler: requireSuperAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string }
    await app.prisma.notice.delete({ where: { id } })
    return reply.status(204).send()
  })
}
