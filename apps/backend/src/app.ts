import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import jwt from '@fastify/jwt'
import multipart from '@fastify/multipart'
import socketio from 'fastify-socket.io'

import { prismaPlugin } from './plugins/prisma.js'
import { redisPlugin } from './plugins/redis.js'
import { authRoutes } from './routes/auth.js'
import { eventRoutes } from './routes/events.js'
import { prizeRoutes } from './routes/prizes.js'
import { paymentRoutes } from './routes/payments.js'
import { registerSocketHandlers } from './socket/index.js'

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: process.env.NODE_ENV === 'production' ? 'warn' : 'info',
    },
  })

  await app.register(helmet, { contentSecurityPolicy: false })
  await app.register(cors, {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
  })
  await app.register(jwt, {
    secret: process.env.JWT_SECRET || 'dev-secret-change-in-prod',
  })
  await app.register(multipart, {
    limits: { fileSize: 10 * 1024 * 1024 },
  })
  await app.register(socketio, {
    cors: {
      origin: process.env.CORS_ORIGIN || '*',
    },
  })

  await app.register(prismaPlugin)
  await app.register(redisPlugin)

  await app.register(authRoutes, { prefix: '/api/auth' })
  await app.register(eventRoutes, { prefix: '/api/events' })
  await app.register(prizeRoutes, { prefix: '/api/prizes' })
  await app.register(paymentRoutes, { prefix: '/api/payments' })

  app.ready(() => {
    registerSocketHandlers(app)
  })

  app.get('/health', async () => ({ status: 'ok' }))

  return app
}
