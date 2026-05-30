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
import { superadminRoutes } from './routes/superadmin.js'
import { storeRoutes } from './routes/stores.js'
import { publicRoutes } from './routes/public.js'
import { prizeCatalogRoutes } from './routes/prize-catalog.js'
import { displayConfigRoutes } from './routes/display-config.js'
import { noticeRoutes } from './routes/notices.js'
import { dashboardRoutes } from './routes/dashboard.js'
import { uploadRoutes } from './routes/upload.js'
import { registerSocketHandlers } from './socket/index.js'

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: process.env.NODE_ENV === 'production' ? 'warn' : 'info',
    },
  })

  await app.register(helmet, { contentSecurityPolicy: false })

  // 다중 오리진 지원 (어드민 + 디스플레이 앱)
  const corsOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000')
    .split(',').map((o) => o.trim()).filter(Boolean)
  await app.register(cors, {
    origin: corsOrigins.length === 1 ? corsOrigins[0] : corsOrigins,
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
      origin: corsOrigins.length === 1 ? corsOrigins[0] : corsOrigins,
    },
  })

  await app.register(prismaPlugin)
  await app.register(redisPlugin)

  await app.register(authRoutes, { prefix: '/api/auth' })
  await app.register(eventRoutes, { prefix: '/api/events' })
  await app.register(prizeRoutes, { prefix: '/api/prizes' })
  await app.register(paymentRoutes, { prefix: '/api/payments' })
  await app.register(superadminRoutes, { prefix: '/api/superadmin' })
  await app.register(storeRoutes, { prefix: '/api/stores' })
  await app.register(noticeRoutes, { prefix: '/api/notices' })
  await app.register(dashboardRoutes, { prefix: '/api/dashboard' })
  await app.register(uploadRoutes, { prefix: '/api/upload' })
  await app.register(publicRoutes, { prefix: '/api/public' })
  await app.register(prizeCatalogRoutes, { prefix: '/api/prize-catalog' })
  await app.register(displayConfigRoutes, { prefix: '/api/display-config' })

  app.ready(() => {
    registerSocketHandlers(app)
  })

  app.get('/health', async () => ({ status: 'ok' }))

  return app
}
