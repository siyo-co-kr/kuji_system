import { FastifyInstance } from 'fastify'

export function registerSocketHandlers(app: FastifyInstance) {
  app.io.on('connection', (socket) => {
    app.log.info({ socketId: socket.id }, 'Socket connected')

    socket.on('event:join', (eventId: string) => {
      socket.join(`event:${eventId}`)
      app.log.debug({ socketId: socket.id, eventId }, 'Joined event room')
    })

    socket.on('event:leave', (eventId: string) => {
      socket.leave(`event:${eventId}`)
    })

    socket.on('admin:join', (storeId: string) => {
      socket.join(`store:${storeId}`)
      app.log.debug({ socketId: socket.id, storeId }, 'Admin joined store room')
    })

    socket.on('disconnect', () => {
      app.log.info({ socketId: socket.id }, 'Socket disconnected')
    })
  })
}
