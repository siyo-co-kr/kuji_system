import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { requireAuth } from '../plugins/auth.js'

const loginSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(1),
})

const registerSchema = z.object({
  email:           z.string().email(),
  name:            z.string().min(1).max(50),
  phone:           z.string().min(1).max(20),
  password:        z.string().min(8),
  passwordConfirm: z.string().min(1),
  storeName:       z.string().min(1).max(100),
  storeAddress:    z.string().min(1).max(200),
})

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword:     z.string().min(8),
})

const updateProfileSchema = z.object({
  name:  z.string().min(1).max(50).optional(),
  phone: z.string().max(20).optional().nullable(),
})

export const authRoutes: FastifyPluginAsync = async (app) => {
  // ── 회원가입 ─────────────────────────────────────────────────
  app.post('/register', async (request, reply) => {
    const body = registerSchema.parse(request.body)

    if (body.password !== body.passwordConfirm) {
      return reply.status(400).send({ error: '비밀번호가 일치하지 않습니다.' })
    }

    const existing = await app.prisma.account.findUnique({ where: { email: body.email } })
    if (existing) {
      return reply.status(409).send({ error: '이미 사용 중인 이메일입니다.' })
    }

    const passwordHash = await bcrypt.hash(body.password, 10)

    const account = await app.prisma.$transaction(async (tx) => {
      const store = await tx.store.create({
        data: {
          name:    body.storeName,
          address: body.storeAddress,
        },
      })
      return tx.account.create({
        data: {
          storeId:           store.id,
          email:             body.email,
          name:              body.name,
          phone:             body.phone,
          passwordHash,
          role:              'admin',
          isApproved:        false,
          mustChangePassword: false,
        },
        include: { store: true },
      })
    })

    app.log.info({ accountId: account.id, email: account.email }, '신규 어드민 회원가입')

    return reply.status(201).send({
      message: '회원가입이 완료됐습니다. 슈퍼 어드민 승인 후 서비스를 이용할 수 있습니다.',
    })
  })

  // ── 로그인 ─────────────────────────────────────────────────
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
      storeId:   account.storeId,
      role:      account.role,
    })

    app.log.info({ accountId: account.id, role: account.role }, '로그인')

    return reply.send({
      token,
      account: {
        id:                account.id,
        email:             account.email,
        name:              account.name,
        phone:             account.phone,
        role:              account.role,
        isApproved:        account.isApproved,
        mustChangePassword: account.mustChangePassword,
        store: {
          id:      account.store.id,
          name:    account.store.name,
          address: account.store.address,
          phone:   account.store.phone,
        },
      },
    })
  })

  // ── 내 정보 조회 ───────────────────────────────────────────
  app.get('/me', { preHandler: requireAuth }, async (request) => {
    const account = await app.prisma.account.findUniqueOrThrow({
      where: { id: request.user.accountId },
      include: { store: true },
    })
    return {
      id:                account.id,
      email:             account.email,
      name:              account.name,
      phone:             account.phone,
      role:              account.role,
      isApproved:        account.isApproved,
      mustChangePassword: account.mustChangePassword,
      store: {
        id:      account.store.id,
        name:    account.store.name,
        address: account.store.address,
        phone:   account.store.phone,
      },
    }
  })

  // ── 프로필 수정 (name, phone) ──────────────────────────────
  app.patch('/profile', { preHandler: requireAuth }, async (request, reply) => {
    const body = updateProfileSchema.parse(request.body)
    const { accountId } = request.user

    const updated = await app.prisma.account.update({
      where: { id: accountId },
      data: body,
    })

    app.log.info({ accountId }, '프로필 수정')
    return reply.send({ message: '프로필이 수정됐습니다.', name: updated.name, phone: updated.phone })
  })

  // ── 비밀번호 변경 ──────────────────────────────────────────
  app.post('/change-password', { preHandler: requireAuth }, async (request, reply) => {
    const body = changePasswordSchema.parse(request.body)
    const { accountId } = request.user

    const account = await app.prisma.account.findUniqueOrThrow({ where: { id: accountId } })

    const isValid = await bcrypt.compare(body.currentPassword, account.passwordHash)
    if (!isValid) {
      return reply.status(400).send({ error: '현재 비밀번호가 올바르지 않습니다.' })
    }

    const newHash = await bcrypt.hash(body.newPassword, 10)
    await app.prisma.account.update({
      where: { id: accountId },
      data: { passwordHash: newHash, mustChangePassword: false },
    })

    app.log.info({ accountId }, '비밀번호 변경')
    return reply.send({ message: '비밀번호가 변경됐습니다.' })
  })
}
