import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { requireAuth } from '../plugins/auth.js'

const categorySchema = z.object({
  name: z.string().min(1).max(50),
})

const catalogSchema = z.object({
  categoryId:  z.string().uuid().optional().nullable(),
  name:        z.string().min(1),
  description: z.string().optional().nullable(),
  imageUrl:    z.string().url().optional().nullable(),
})

export const prizeCatalogRoutes: FastifyPluginAsync = async (app) => {
  // ── 카테고리 목록 ─────────────────────────────────────────
  app.get('/categories', { preHandler: requireAuth }, async (request) => {
    const { storeId } = request.user
    return app.prisma.prizeCatalogCategory.findMany({
      where: { storeId },
      orderBy: { createdAt: 'asc' },
      include: { _count: { select: { prizes: true } } },
    })
  })

  // ── 카테고리 생성 ──────────────────────────────────────────
  app.post('/categories', { preHandler: requireAuth }, async (request, reply) => {
    const { storeId } = request.user
    const { name } = categorySchema.parse(request.body)
    const category = await app.prisma.prizeCatalogCategory.create({
      data: { storeId, name },
    })
    return reply.status(201).send(category)
  })

  // ── 카테고리 수정 ──────────────────────────────────────────
  app.patch('/categories/:id', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { storeId } = request.user
    const { name } = categorySchema.parse(request.body)

    const cat = await app.prisma.prizeCatalogCategory.findFirst({ where: { id, storeId } })
    if (!cat) return reply.status(404).send({ error: 'Category not found' })

    return app.prisma.prizeCatalogCategory.update({ where: { id }, data: { name } })
  })

  // ── 카테고리 삭제 ──────────────────────────────────────────
  app.delete('/categories/:id', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { storeId } = request.user

    const cat = await app.prisma.prizeCatalogCategory.findFirst({ where: { id, storeId } })
    if (!cat) return reply.status(404).send({ error: 'Category not found' })

    // 카테고리 삭제 시 해당 경품들의 categoryId를 null로 설정
    await app.prisma.prizeCatalog.updateMany({
      where: { categoryId: id },
      data: { categoryId: null },
    })
    await app.prisma.prizeCatalogCategory.delete({ where: { id } })
    return reply.status(204).send()
  })

  // ── 카탈로그 목록 (카테고리 필터 가능) ───────────────────────
  app.get('/', { preHandler: requireAuth }, async (request) => {
    const { storeId } = request.user
    const q = request.query as { categoryId?: string }

    return app.prisma.prizeCatalog.findMany({
      where: {
        storeId,
        ...(q.categoryId ? { categoryId: q.categoryId } : {}),
      },
      include: { category: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    })
  })

  // ── 카탈로그 항목 생성 ─────────────────────────────────────
  app.post('/', { preHandler: requireAuth }, async (request, reply) => {
    const { storeId } = request.user
    const body = catalogSchema.parse(request.body)

    const item = await app.prisma.prizeCatalog.create({
      data: { storeId, ...body },
      include: { category: { select: { id: true, name: true } } },
    })
    return reply.status(201).send(item)
  })

  // ── 카탈로그 항목 수정 ─────────────────────────────────────
  app.patch('/:id', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { storeId } = request.user
    const body = catalogSchema.partial().parse(request.body)

    const item = await app.prisma.prizeCatalog.findFirst({ where: { id, storeId } })
    if (!item) return reply.status(404).send({ error: 'Item not found' })

    return app.prisma.prizeCatalog.update({
      where: { id },
      data: body,
      include: { category: { select: { id: true, name: true } } },
    })
  })

  // ── 카탈로그 항목 삭제 ─────────────────────────────────────
  app.delete('/:id', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { storeId } = request.user

    const item = await app.prisma.prizeCatalog.findFirst({ where: { id, storeId } })
    if (!item) return reply.status(404).send({ error: 'Item not found' })

    await app.prisma.prizeCatalog.delete({ where: { id } })
    return reply.status(204).send()
  })
}
