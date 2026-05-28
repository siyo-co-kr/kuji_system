import { Server } from 'socket.io'

declare module 'fastify' {
  interface FastifyInstance {
    // Socket.io 서버 - emit 시 타입 캐스팅 없이 사용하기 위해 Server<any, any> 사용
    io: Server
  }
}
