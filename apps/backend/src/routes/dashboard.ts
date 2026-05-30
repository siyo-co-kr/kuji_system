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
    const { accountId, storeId, role } = request.user

    // 공지사항 (고정 우선, 최신 10개)
    const notices = await app.prisma.notice.findMany({
      orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
      take: 10,
    })

    if (role === 'superadmin') {
      // ── 슈퍼 어드민 대시보드 ───────────────────────────────
      const [total, approved] = await Promise.all([
        app.prisma.account.count({ where: { role: 'admin' } }),
        app.prisma.account.count({ where: { role: 'admin', isApproved: true } }),
      ])

      return {
        role,
        accounts: {
          total,
          approved,
          pending: total - approved,
        },
        notices,
      }
    }

    // ── 일반 어드민 대시보드 ─────────────────────────────────
    const notDeleted = { deletedAt: null as null }

    // 이벤트 현황
    const [evTotal, evActive, evDraft, evClosed] = await Promise.all([
      app.prisma.event.count({ where: { storeId, ...notDeleted } }),
      app.prisma.event.count({ where: { storeId, status: 'active', ...notDeleted } }),
      app.prisma.event.count({ where: { storeId, status: 'draft', ...notDeleted } }),
      app.prisma.event.count({ where: { storeId, status: 'closed', ...notDeleted } }),
    ])

    // 날짜 범위 계산
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

    // 결제 집계 헬퍼
    const sumPayments = async (where: object) => {
      const result = await app.prisma.payment.aggregate({
        where: { storeId, status: 'confirmed', ...where },
        _count: true,
        _sum: { totalAmount: true },
      })
      return {
        count: result._count ?? 0,
        amount: result._sum.totalAmount ?? 0,
      }
    }

    const [monthAll, monthManual, monthApp, todayAll, todayManual, todayApp] = await Promise.all([
      sumPayments({ requestedAt: { gte: monthStart } }),
      sumPayments({ requestedAt: { gte: monthStart }, method: 'manual' }),
      sumPayments({ requestedAt: { gte: monthStart }, method: { in: ['app_simple', 'app_card'] } }),
      sumPayments({ requestedAt: { gte: todayStart } }),
      sumPayments({ requestedAt: { gte: todayStart }, method: 'manual' }),
      sumPayments({ requestedAt: { gte: todayStart }, method: { in: ['app_simple', 'app_card'] } }),
    ])

    return {
      role,
      events: { total: evTotal, active: evActive, draft: evDraft, closed: evClosed },
      payments: {
        thisMonth: {
          count:  { total: monthAll.count,  manual: monthManual.count,  app: monthApp.count  },
          amount: { total: monthAll.amount, manual: monthManual.amount, app: monthApp.amount },
        },
        today: {
          count:  { total: todayAll.count,  manual: todayManual.count,  app: todayApp.count  },
          amount: { total: todayAll.amount, manual: todayManual.amount, app: todayApp.amount },
        },
      },
      notices,
    }
  })
}
