import { FastifyRequest, FastifyReply } from 'fastify'

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify()
  } catch {
    reply.status(401).send({ error: 'Unauthorized' })
  }
}

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
