import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { sendTempPasswordEmail } from '../lib/email.js'

/** 슈퍼 어드민 전용 미들웨어 — JWT 검증 + 역할 확인을 하나로 처리 */
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
  // ── 전체 매장 목록 + 이벤트 현황 ──────────────────────────
  app.get('/stores', { preHandler: requireSuperAdmin }, async () => {
    const stores = await app.prisma.store.findMany({
      include: {
        accounts: {
          select: { id: true, email: true, role: true, isApproved: true, createdAt: true },
          orderBy: { createdAt: 'asc' },
        },
        events: {
          select: {
            id: true,
            title: true,
            status: true,
            totalCount: true,
            pricePerUnit: true,
            createdAt: true,
            _count: {
              select: {
                kujiNumbers: { where: { isDrawn: false } },
                prizes: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        _count: { select: { events: true } },
      },
      orderBy: { createdAt: 'asc' },
    })
    return stores
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

  // ── 계정 생성 (이메일 + 매장명 → 임시 비밀번호 발급 + 메일 발송) ──
  app.post('/accounts', { preHandler: requireSuperAdmin }, async (request, reply) => {
    const body = createAccountSchema.parse(request.body)

    // 이메일 중복 확인
    const existing = await app.prisma.account.findUnique({ where: { email: body.email } })
    if (existing) {
      return reply.status(409).send({ error: '이미 등록된 이메일입니다.' })
    }

    const tempPassword = generateTempPassword()
    const passwordHash = await bcrypt.hash(tempPassword, 10)

    // 매장 생성 + 계정 생성을 트랜잭션으로 처리
    const account = await app.prisma.$transaction(async (tx) => {
      const store = await tx.store.create({
        data: { name: body.storeName },
      })
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

    // 이메일 발송 (실패해도 계정은 유지)
    try {
      await sendTempPasswordEmail(body.email, tempPassword)
    } catch (err) {
      app.log.error({ err }, 'Failed to send temp password email')
    }

    return reply.status(201).send({
      message: `${body.email} 계정이 생성됐습니다.`,
      account,
      tempPassword, // 이메일 발송 실패 시 화면에서 확인 가능하도록 반환
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

    try {
      await sendTempPasswordEmail(account.email, tempPassword)
    } catch (err) {
      app.log.error({ err }, 'Failed to send temp password email')
    }

    return reply.send({
      message: `${account.email} 으로 임시 비밀번호를 발송했습니다.`,
      tempPassword,
    })
  })

  // ── 계정 승인 ─────────────────────────────────────────────
  app.post('/accounts/:id/approve', { preHandler: requireSuperAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string }

    // mustChangePassword 가 true이면 승인 불가 (비밀번호 변경 미완료)
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
