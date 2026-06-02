export type Role = 'superadmin' | 'admin'

export interface Account {
  id: string
  storeId: string
  email: string
  name: string
  phone?: string | null
  role: Role
  isApproved: boolean
  mustChangePassword?: boolean
  createdAt: string
  store?: { id: string; name: string; address?: string | null; phone?: string | null }
}
