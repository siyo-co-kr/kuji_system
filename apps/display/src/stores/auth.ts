import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { api } from '../lib/api'

interface AuthState {
  token: string | null
  account: {
    id: string
    email: string
    role: string
    store: { id: string; name: string }
  } | null
  login: (email: string, password: string) => Promise<void>
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      account: null,
      login: async (email, password) => {
        const res = await api.post('/auth/login', { email, password })
        const { token, account } = res.data
        localStorage.setItem('display-token', token)
        set({ token, account })
      },
      logout: () => {
        localStorage.removeItem('display-token')
        set({ token: null, account: null })
      },
    }),
    {
      name: 'kuji-display-auth',
      partialize: (s) => ({ token: s.token, account: s.account }),
    }
  )
)
