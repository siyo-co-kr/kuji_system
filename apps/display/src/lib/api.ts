import axios from 'axios'

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api'

export const api = axios.create({ baseURL: BASE })

// 저장된 토큰을 모든 요청에 자동 첨부
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('display-token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// 401 → 로그인 페이지로
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('display-token')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)
