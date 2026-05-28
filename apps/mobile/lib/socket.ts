import { io, Socket } from 'socket.io-client'
import type { ServerToClientEvents, ClientToServerEvents } from '@kuji/types'

const WS_URL = process.env.EXPO_PUBLIC_WS_URL || 'http://10.0.2.2:4000'

let socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null

export function getSocket() {
  if (!socket) {
    socket = io(WS_URL, { autoConnect: false })
  }
  return socket
}

export function joinEvent(eventId: string) {
  const s = getSocket()
  if (!s.connected) s.connect()
  s.emit('event:join', eventId)
  return s
}

export function leaveEvent(eventId: string) {
  socket?.emit('event:leave', eventId)
}
