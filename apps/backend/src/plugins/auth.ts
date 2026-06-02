import { FastifyRequest, FastifyReply } from 'fastify'

export interface JwtPayload {
  accountId: string
  storeId: string
  role: 'superadmin' | 'admin'
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JwtPayload
    user: JwtPayload
  }
}

/** JWT 검증 — 미인증 시 401 */
export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify()
  } catch {
    return reply.status(401).send({ error: 'Unauthorized' })
  }
}

/** JWT 검증 + superadmin 역할 확인 — 미인증 401, 권한 없음 403 */
export async function requireSuperAdmin(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify()
  } catch {
    return reply.status(401).send({ error: 'Unauthorized' })
  }
  if (request.user?.role !== 'superadmin') {
    return reply.status(403).send({ error: '슈퍼 어드민 권한이 필요합니다.' })
  }
}
