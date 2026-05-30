import { FastifyPluginAsync } from 'fastify'

async function requireAuth(
  request: Parameters<typeof import('../plugins/auth.js').requireAuth>[0],
  reply: Parameters<typeof import('../plugins/auth.js').requireAuth>[1]
) {
  try { await request.jwtVerify() }
  catch { return reply.status(401).send({ error: 'Unauthorized' }) }
}

export const dashboardRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', { preHandler: requireAuth }, async (request) => {
    const { storeId, role } = request.user

    // 공지사항 (고정 우선, 최신 10개)
    const notices = await app.prisma.notice.findMany({
      orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
      take: 10,
    })

    if (role === 'superadmin') {
      const [total, approved] = await Promise.all([
        app.prisma.account.count({ where: { role: 'admin' } }),
        app.prisma.account.count({ where: { role: 'admin', isApproved: true } }),
      ])
      return {
        role,
        accounts: { total, approved, pending: total - approved },
        notices,
      }
    }

    // ── 일반 어드민 대시보드 ─────────────────────────────────
    const notDeleted = { deletedAt: null as null }

    const [evTotal, evActive, evDraft, evClosed] = await Promise.all([
      app.prisma.event.count({ where: { storeId, ...notDeleted } }),
      app.prisma.event.count({ where: { storeId, status: 'active', ...notDeleted } }),
      app.prisma.event.count({ where: { storeId, status: 'draft', ...notDeleted } }),
      app.prisma.event.count({ where: { storeId, status: 'closed', ...notDeleted } }),
    ])

    return {
      role,
      events: { total: evTotal, active: evActive, draft: evDraft, closed: evClosed },
      notices,
    }
  })
}
