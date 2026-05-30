import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { api } from '@/lib/api'

import type { Role } from '@kuji/types'

interface AuthStore {
  token: string | null
  account: {
    id: string
    email: string
    role: Role
    isApproved: boolean
    mustChangePassword: boolean
    store: { id: string; name: string }
  } | null
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  isAuthenticated: () => boolean
  setAccount: (account: AuthStore['account']) => void
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      token: null,
      account: null,
      login: async (email, password) => {
        const res = await api.post('/auth/login', { email, password })
        const { token, account } = res.data
        localStorage.setItem('token', token)
        set({ token, account })
      },
      logout: () => {
        localStorage.removeItem('token')
        set({ token: null, account: null })
      },
      isAuthenticated: () => !!get().token,
      setAccount: (account) => set({ account }),
    }),
    {
      name: 'kuji-auth',
      partialize: (state) => ({ token: state.token, account: state.account }),
    }
  )
)
