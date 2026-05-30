import type { Payment } from './payment'
import type { KujiNumber } from './event'

export interface ServerToClientEvents {
  'payment:pending':   (data: { paymentId: string; payment: Payment }) => void
  'payment:confirmed': (data: { paymentId: string | null; eventId: string; numbers: KujiNumber[] }) => void
  'payment:cancelled': (data: { paymentId: string }) => void
  'event:updated':     (data: { eventId: string }) => void
  'event:closed':      (data: { eventId: string }) => void
  'display:config-updated': (data: { storeId: string }) => void
}

export interface ClientToServerEvents {
  'event:join':  (eventId: string) => void
  'event:leave': (eventId: string) => void
  'admin:join':  (storeId: string) => void
}
