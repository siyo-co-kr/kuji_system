import axios from 'axios'

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:4000/api'

export const api = axios.create({
  baseURL: BASE_URL,
})
