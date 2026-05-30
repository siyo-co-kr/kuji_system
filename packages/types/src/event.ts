export type EventStatus = 'draft' | 'active' | 'closed'

export interface Store {
  id: string
  name: string
  address?: string
  phone?: string
  createdAt: string
  updatedAt: string
}

export interface Event {
  id: string
  storeId: string
  title: string
  description?: string
  thumbnailUrl?: string | null
  totalCount: number
  pricePerUnit: number
  bonusEnabled: boolean
  bonusThreshold: number
  isVisible: boolean
  status: EventStatus
  startedAt?: string
  endedAt?: string
  createdAt: string
  updatedAt: string
}

export interface KujiNumber {
  id: string
  eventId: string
  number: number
  isPrize: boolean
  isDrawn: boolean
  drawnAt?: string
  createdAt: string
}

export interface Prize {
  id: string
  eventId: string
  name: string
  description?: string
  quantity: number
  images: PrizeImage[]
  numbers?: PrizeNumber[]
  createdAt: string
  updatedAt: string
}

export interface PrizeImage {
  id: string
  prizeId: string
  imageUrl: string
  order: number
  createdAt: string
}

export interface PrizeNumber {
  id: string
  prizeId: string
  kujiNumberId: string
  kujiNumber?: KujiNumber
}

export interface EventStats {
  totalCount: number
  remainingCount: number
  totalPrizeCount: number
  remainingPrizeCount: number
}
