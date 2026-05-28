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
  }) as RedisClientType

  client.on('error', (err) => app.log.error({ err }, 'Redis error'))

  await client.connect()

  app.decorate('redis', client)

  app.addHook('onClose', async () => {
    await client.quit()
  })
})
