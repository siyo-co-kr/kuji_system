import { FastifyPluginAsync } from 'fastify'
import { requireAuth } from '../plugins/auth.js'
import { uploadImage } from '../lib/storage.js'

export const uploadRoutes: FastifyPluginAsync = async (app) => {
  app.post('/image', { preHandler: requireAuth }, async (request, reply) => {
    const data = await request.file()
    if (!data) return reply.status(400).send({ error: '파일이 없습니다.' })

    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!allowed.includes(data.mimetype)) {
      return reply.status(400).send({ error: '지원하지 않는 파일 형식입니다. (jpeg/png/webp/gif)' })
    }

    const chunks: Buffer[] = []
    for await (const chunk of data.file) chunks.push(chunk)
    const buffer = Buffer.concat(chunks)

    try {
      const url = await uploadImage(buffer, data.mimetype)
      app.log.info({ accountId: request.user.accountId, mimetype: data.mimetype, bytes: buffer.length }, '이미지 업로드 성공')
      return reply.send({ url })
    } catch (err) {
      app.log.error({ err }, '이미지 업로드 실패')
      return reply.status(500).send({ error: '이미지 업로드에 실패했습니다.' })
    }
  })
}
