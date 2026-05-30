import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { api } from '@/lib/api'

import type { Role } from '@kuji/types'

interface AuthStore {
  _hasHydrated: boolean
  token: string | null
  account: {
    id: string
    email: string
    role: Role
    isApproved: boolean
    mustChangePassword: boolean
    store: { id: string; name: string }
  } | null
  setHasHydrated: (val: boolean) => void
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  isAuthenticated: () => boolean
  setAccount: (account: AuthStore['account']) => void
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      _hasHydrated: false,
      token: null,
      account: null,
      setHasHydrated: (val) => set({ _hasHydrated: val }),
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
      // localStorage에서 복원이 완료됐을 때 플래그 설정
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true)
      },
    }
  )
)
