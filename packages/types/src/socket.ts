import type { KujiNumber } from './event'

export interface ServerToClientEvents {
  /** 번호 추첨 (수동 추첨 또는 기타) */
  'number:drawn':           (data: { eventId: string; numbers: KujiNumber[] }) => void
  'event:updated':          (data: { eventId: string }) => void
  'event:closed':           (data: { eventId: string }) => void
  'display:config-updated': (data: { storeId: string }) => void
}

export interface ClientToServerEvents {
  'event:join':  (eventId: string) => void
  'event:leave': (eventId: string) => void
  'admin:join':  (storeId: string) => void
}
