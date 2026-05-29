import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import bcrypt from 'bcryptjs'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
})

const changePasswordSchema = z.object({
  currentPassword: z.string().min(6),
  newPassword: z.string().min(8),
})

export const authRoutes: FastifyPluginAsync = async (app) => {
  // ── 로그인 ─────────────────────────────────────────────────
  // 미승인 계정도 로그인 허용. 응답에 isApproved / mustChangePassword 포함
  app.post('/login', async (request, reply) => {
    const body = loginSchema.parse(request.body)

    const account = await app.prisma.account.findUnique({
      where: { email: body.email },
      include: { store: true },
    })

    if (!account) {
      return reply.status(401).send({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' })
    }

    const isValid = await bcrypt.compare(body.password, account.passwordHash)
    if (!isValid) {
      return reply.status(401).send({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' })
    }

    const token = app.jwt.sign({
      accountId: account.id,
      storeId: account.storeId,
      role: account.role,
    })

    return reply.send({
      token,
      account: {
        id: account.id,
        email: account.email,
        role: account.role,
        isApproved: account.isApproved,
        mustChangePassword: account.mustChangePassword,
        store: {
          id: account.store.id,
          name: account.store.name,
        },
      },
    })
  })

  // ── 내 정보 ────────────────────────────────────────────────
  app.get('/me', {
    preHandler: async (request, reply) => {
      try {
        await request.jwtVerify()
      } catch {
        return reply.status(401).send({ error: 'Unauthorized' })
      }
    },
  }, async (request) => {
    const { accountId } = request.user

    const account = await app.prisma.account.findUniqueOrThrow({
      where: { id: accountId },
      include: { store: true },
    })

    return {
      id: account.id,
      email: account.email,
      role: account.role,
      isApproved: account.isApproved,
      mustChangePassword: account.mustChangePassword,
      store: {
        id: account.store.id,
        name: account.store.name,
        address: account.store.address,
        phone: account.store.phone,
      },
    }
  })

  // ── 비밀번호 변경 ──────────────────────────────────────────
  app.post('/change-password', {
    preHandler: async (request, reply) => {
      try {
        await request.jwtVerify()
      } catch {
        return reply.status(401).send({ error: 'Unauthorized' })
      }
    },
  }, async (request, reply) => {
    const body = changePasswordSchema.parse(request.body)
    const { accountId } = request.user

    const account = await app.prisma.account.findUniqueOrThrow({
      where: { id: accountId },
    })

    const isValid = await bcrypt.compare(body.currentPassword, account.passwordHash)
    if (!isValid) {
      return reply.status(400).send({ error: '현재 비밀번호가 올바르지 않습니다.' })
    }

    const newHash = await bcrypt.hash(body.newPassword, 10)
    await app.prisma.account.update({
      where: { id: accountId },
      data: {
        passwordHash: newHash,
        mustChangePassword: false,
      },
    })

    return reply.send({ message: '비밀번호가 변경됐습니다.' })
  })
}
