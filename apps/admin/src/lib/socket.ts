import { io, Socket } from 'socket.io-client'
import type { ServerToClientEvents, ClientToServerEvents } from '@kuji/types'

let socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null

export function getSocket() {
  if (!socket) {
    socket = io(process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:4000', {
      autoConnect: false,
    })
  }
  return socket
}

export function connectSocket() {
  const s = getSocket()
  // 연결 시 최신 JWT 토큰을 auth에 설정
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
  s.auth = { token: token ?? '' }
  if (!s.connected) s.connect()
  return s
}

export function disconnectSocket() {
  socket?.disconnect()
}
