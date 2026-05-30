import fp from 'fastify-plugin'
import { createClient, RedisClientType } from 'redis'

declare module 'fastify' {
  interface FastifyInstance {
    redis: RedisClientType
  }
}

export const redisPlugin = fp(async (app) => {
  const client = createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    socket: {
      reconnectStrategy: (retries) => {
        // 10회 재시도 후 포기 (서버는 계속 동작)
        if (retries > 10) return false
        return Math.min(retries * 500, 5000)
      },
    },
  }) as RedisClientType

  client.on('error', (err) => app.log.warn({ err }, 'Redis connection error (결제 기능 일시 불가)'))

  // 연결은 백그라운드로 — 실패해도 서버 시작 차단 안 함
  client.connect().then(() => {
    app.log.info('Redis connected')
  }).catch((err) => {
    app.log.warn({ err }, 'Redis unavailable — 결제 실시간 기능 비활성화됨')
  })

  app.decorate('redis', client)

  app.addHook('onClose', async () => {
    try { await client.quit() } catch { /* ignore */ }
  })
})
