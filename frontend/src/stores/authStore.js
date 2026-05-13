import { create } from 'zustand'
import api from '../lib/api'

export const useAuthStore = create((set, get) => ({
  user: null,
  token: localStorage.getItem('access_token') || null,
  loading: true,

  setToken: (token) => {
    localStorage.setItem('access_token', token)
    set({ token })
  },

  setUser: (user) => set({ user }),

  login: async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password })
    localStorage.setItem('access_token', data.access_token)
    set({ token: data.access_token, user: data.user })
    return data
  },

  register: async (email, password, full_name) => {
    const { data } = await api.post('/auth/register', { email, password, full_name })
    localStorage.setItem('access_token', data.access_token)
    set({ token: data.access_token, user: data.user })
    return data
  },

  logout: async () => {
    try { await api.post('/auth/logout') } catch {}
    localStorage.removeItem('access_token')
    set({ user: null, token: null })
  },

  fetchMe: async () => {
    try {
      const { data } = await api.get('/auth/me')
      set({ user: data, loading: false })
    } catch {
      set({ user: null, loading: false })
    }
  },
}))
