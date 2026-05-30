import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { sendTempPasswordEmail } from '../lib/email.js'

/** 슈퍼 어드민 전용 미들웨어 */
async function requireSuperAdmin(
  request: Parameters<typeof import('../plugins/auth.js').requireAuth>[0],
  reply: Parameters<typeof import('../plugins/auth.js').requireAuth>[1]
) {
  try {
    await request.jwtVerify()
  } catch {
    return reply.status(401).send({ error: 'Unauthorized' })
  }
  if (request.user?.role !== 'superadmin') {
    return reply.status(403).send({ error: '슈퍼 어드민 권한이 필요합니다.' })
  }
}

/** 랜덤 임시 비밀번호 생성 (8자: 영문+숫자) */
function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

const createAccountSchema = z.object({
  email: z.string().email(),
  storeName: z.string().min(1),
})

export const superadminRoutes: FastifyPluginAsync = async (app) => {
  // ── 전체 매장 목록 (슈퍼어드민 전용 매장 제외, 검색/페이징) ───────────────
  app.get('/stores', { preHandler: requireSuperAdmin }, async (request) => {
    const q = request.query as {
      search?: string
      page?: string
      limit?: string
    }
    const search = q.search?.trim() ?? ''
    const page  = Math.max(1, Number(q.page)  || 1)
    const limit = Math.min(50, Math.max(1, Number(q.limit) || 20))
    const skip  = (page - 1) * limit

    // 검색 조건
    const searchWhere = search
      ? {
          OR: [
            { name:    { contains: search, mode: 'insensitive' as const } },
            { address: { contains: search, mode: 'insensitive' as const } },
            { phone:   { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {}

    // 슈퍼어드민 전용 매장 제외: admin 계정이 1개 이상 있는 매장만 표시
    const baseWhere = {
      ...searchWhere,
      accounts: { some: { role: 'admin' as const } },
    }

    const [total, stores] = await Promise.all([
      app.prisma.store.count({ where: baseWhere }),
      app.prisma.store.findMany({
        where: baseWhere,
        include: {
          accounts: {
            where: { role: 'admin' },
            select: {
              id: true, email: true, role: true,
              isApproved: true, mustChangePassword: true, createdAt: true,
            },
            orderBy: { createdAt: 'asc' },
          },
          events: {
            where: { deletedAt: null },
            select: {
              id: true, title: true, status: true,
              totalCount: true, pricePerUnit: true, createdAt: true,
              _count: {
                select: { kujiNumbers: { where: { isDrawn: false } }, prizes: true },
              },
            },
            orderBy: { createdAt: 'desc' },
          },
          _count: { select: { events: true } },
        },
        orderBy: { createdAt: 'asc' },
        skip,
        take: limit,
      }),
    ])

    return {
      data: stores,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    }
  })

  // ── 승인 대기 계정 목록 ───────────────────────────────────
  app.get('/accounts/pending', { preHandler: requireSuperAdmin }, async () => {
    return app.prisma.account.findMany({
      where: { isApproved: false, role: 'admin' },
      include: { store: { select: { id: true, name: true, address: true, phone: true } } },
      orderBy: { createdAt: 'asc' },
    })
  })

  // ── 전체 계정 목록 ────────────────────────────────────────
  app.get('/accounts', { preHandler: requireSuperAdmin }, async () => {
    return app.prisma.account.findMany({
      where: { role: 'admin' },
      include: { store: { select: { id: true, name: true, address: true, phone: true } } },
      orderBy: { createdAt: 'asc' },
    })
  })

  // ── 계정 생성 ─────────────────────────────────────────────
  app.post('/accounts', { preHandler: requireSuperAdmin }, async (request, reply) => {
    const body = createAccountSchema.parse(request.body)

    const existing = await app.prisma.account.findUnique({ where: { email: body.email } })
    if (existing) {
      return reply.status(409).send({ error: '이미 등록된 이메일입니다.' })
    }

    const tempPassword = generateTempPassword()
    const passwordHash = await bcrypt.hash(tempPassword, 10)

    const account = await app.prisma.$transaction(async (tx) => {
      const store = await tx.store.create({ data: { name: body.storeName } })
      return tx.account.create({
        data: {
          storeId: store.id,
          email: body.email,
          passwordHash,
          role: 'admin',
          isApproved: false,
          mustChangePassword: true,
        },
        include: { store: { select: { id: true, name: true, address: true, phone: true } } },
      })
    })

    // 이메일 발송
    let emailSent = false
    try {
      await sendTempPasswordEmail(body.email, tempPassword)
      emailSent = true
    } catch (err) {
      app.log.error({ err }, 'Failed to send temp password email')
    }

    return reply.status(201).send({
      message: emailSent
        ? `${body.email} 계정이 생성됐습니다. 임시 비밀번호를 이메일로 발송했습니다.`
        : `${body.email} 계정이 생성됐습니다. (이메일 발송 실패 — 임시 비밀번호를 직접 전달해 주세요)`,
      account,
      tempPassword,
      emailSent,
    })
  })

  // ── 임시 비밀번호 재발급 ──────────────────────────────────
  app.post('/accounts/:id/send-temp-password', { preHandler: requireSuperAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const tempPassword = generateTempPassword()
    const passwordHash = await bcrypt.hash(tempPassword, 10)

    const account = await app.prisma.account.update({
      where: { id },
      data: { passwordHash, mustChangePassword: true },
    })

    let emailSent = false
    try {
      await sendTempPasswordEmail(account.email, tempPassword)
      emailSent = true
    } catch (err) {
      app.log.error({ err }, 'Failed to send temp password email')
    }

    return reply.send({
      message: emailSent
        ? `${account.email} 으로 임시 비밀번호를 발송했습니다.`
        : `임시 비밀번호 발급 완료 (이메일 발송 실패 — 직접 전달 필요)`,
      tempPassword,
      emailSent,
    })
  })

  // ── 계정 승인 ─────────────────────────────────────────────
  app.post('/accounts/:id/approve', { preHandler: requireSuperAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const target = await app.prisma.account.findUniqueOrThrow({ where: { id } })
    if (target.mustChangePassword) {
      return reply.status(400).send({ error: '비밀번호 변경이 완료되지 않아 승인할 수 없습니다.' })
    }

    const account = await app.prisma.account.update({
      where: { id },
      data: { isApproved: true },
      include: { store: { select: { name: true } } },
    })
    return reply.send({ message: `${account.email} 계정이 승인됐습니다.`, account })
  })

  // ── 계정 거절 (비활성화) ──────────────────────────────────
  app.post('/accounts/:id/reject', { preHandler: requireSuperAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const account = await app.prisma.account.update({
      where: { id },
      data: { isApproved: false },
      include: { store: { select: { name: true } } },
    })
    return reply.send({ message: `${account.email} 계정이 비활성화됐습니다.`, account })
  })

  // ── 계정 삭제 ─────────────────────────────────────────────
  app.delete('/accounts/:id', { preHandler: requireSuperAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string }
    await app.prisma.account.delete({ where: { id } })
    return reply.status(204).send()
  })
}
