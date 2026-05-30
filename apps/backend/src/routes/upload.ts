import { FastifyPluginAsync } from 'fastify'
import { uploadImage } from '../lib/storage.js'

async function requireAuth(
  request: Parameters<typeof import('../plugins/auth.js').requireAuth>[0],
  reply: Parameters<typeof import('../plugins/auth.js').requireAuth>[1]
) {
  try {
    await request.jwtVerify()
  } catch {
    return reply.status(401).send({ error: 'Unauthorized' })
  }
}

export const uploadRoutes: FastifyPluginAsync = async (app) => {
  // POST /api/upload/image — 이미지 파일을 Supabase Storage 에 업로드하고 공개 URL 반환
  app.post('/image', { preHandler: requireAuth }, async (request, reply) => {
    const data = await request.file()
    if (!data) {
      return reply.status(400).send({ error: '파일이 없습니다.' })
    }

    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!allowed.includes(data.mimetype)) {
      return reply.status(400).send({ error: '지원하지 않는 파일 형식입니다. (jpeg/png/webp/gif)' })
    }

    const chunks: Buffer[] = []
    for await (const chunk of data.file) {
      chunks.push(chunk)
    }
    const buffer = Buffer.concat(chunks)

    try {
      const url = await uploadImage(buffer, data.mimetype)
      return reply.send({ url })
    } catch (err) {
      app.log.error({ err }, 'Image upload failed')
      return reply.status(500).send({ error: '이미지 업로드에 실패했습니다.' })
    }
  })
}
