export type PaymentMethod = 'app_simple' | 'app_card' | 'manual'
export type PaymentStatus = 'pending' | 'confirmed' | 'cancelled'

export interface Payment {
  id: string
  eventId: string
  storeId: string
  totalAmount: number
  method: PaymentMethod
  status: PaymentStatus
  pgTransactionId?: string
  requestedAt: string
  confirmedAt?: string
  confirmedById?: string
  createdAt: string
  numbers?: string[]
}
