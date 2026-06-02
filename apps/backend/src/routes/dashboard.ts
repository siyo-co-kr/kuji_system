import { FastifyPluginAsync } from 'fastify'
import { requireAuth } from '../plugins/auth.js'

export const dashboardRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', { preHandler: requireAuth }, async (request) => {
    const { storeId, role } = request.user

    app.log.info({ accountId: request.user.accountId, role }, '대시보드 조회')

    const notices = await app.prisma.notice.findMany({
      orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
      take: 10,
    })

    if (role === 'superadmin') {
      const [total, approved] = await Promise.all([
        app.prisma.account.count({ where: { role: 'admin' } }),
        app.prisma.account.count({ where: { role: 'admin', isApproved: true } }),
      ])
      return { role, accounts: { total, approved, pending: total - approved }, notices }
    }

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
