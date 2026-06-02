import { FastifyInstance } from 'fastify'
import type { JwtPayload } from '../plugins/auth.js'

export function registerSocketHandlers(app: FastifyInstance) {
  app.io.on('connection', (socket) => {
    // ── JWT 인증 ────────────────────────────────────────────────
    const token = socket.handshake.auth?.token as string | undefined
    if (!token) {
      app.log.warn({ socketId: socket.id }, 'Socket 연결 거부 — 토큰 없음')
      socket.disconnect(true)
      return
    }

    let user: JwtPayload
    try {
      user = app.jwt.verify<JwtPayload>(token)
      socket.data.user = user
      app.log.info({ socketId: socket.id, accountId: user.accountId, role: user.role }, 'Socket 인증 성공')
    } catch (err) {
      app.log.warn({ socketId: socket.id, err }, 'Socket 연결 거부 — 유효하지 않은 토큰')
      socket.disconnect(true)
      return
    }

    // ── 이벤트 룸 입장/퇴장 ──────────────────────────────────────
    socket.on('event:join', (eventId: string) => {
      socket.join(`event:${eventId}`)
      app.log.debug({ socketId: socket.id, eventId, accountId: user.accountId }, 'event:join')
    })

    socket.on('event:leave', (eventId: string) => {
      socket.leave(`event:${eventId}`)
      app.log.debug({ socketId: socket.id, eventId }, 'event:leave')
    })

    // ── 스토어 룸 입장 (어드민·디스플레이) ─────────────────────
    socket.on('admin:join', (storeId: string) => {
      // 자신의 storeId 또는 superadmin만 허용
      if (user.storeId !== storeId && user.role !== 'superadmin') {
        app.log.warn({ socketId: socket.id, storeId, accountId: user.accountId }, 'admin:join 거부 — storeId 불일치')
        return
      }
      socket.join(`store:${storeId}`)
      app.log.debug({ socketId: socket.id, storeId, accountId: user.accountId }, 'admin:join')
    })

    socket.on('disconnect', (reason) => {
      app.log.info({ socketId: socket.id, reason, accountId: user.accountId }, 'Socket 연결 해제')
    })
  })
}
