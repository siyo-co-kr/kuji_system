import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { api } from '@/lib/api'

interface AuthStore {
  token: string | null
  account: {
    id: string
    email: string
    role: string
    store: { id: string; name: string }
  } | null
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  isAuthenticated: () => boolean
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
    }),
    {
      name: 'kuji-auth',
      partialize: (state) => ({ token: state.token, account: state.account }),
    }
  )
)
