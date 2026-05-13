import { create } from 'zustand'
import api from '../lib/api'

export const useProjectStore = create((set, get) => ({
  projects: [],
  currentProject: null,
  history: null,
  loading: false,
  error: null,

  fetchProjects: async () => {
    set({ loading: true, error: null })
    try {
      const { data } = await api.get('/projects/')
      set({ projects: data, loading: false })
    } catch (e) {
      set({ error: e.message, loading: false })
    }
  },

  createProject: async (name, url, description = '') => {
    const { data } = await api.post('/projects/', { name, url, description })
    set((s) => ({ projects: [data, ...s.projects] }))
    return data
  },

  deleteProject: async (id) => {
    await api.delete(`/projects/${id}`)
    set((s) => ({ projects: s.projects.filter((p) => p.id !== id) }))
  },

  setCurrentProject: (project) => set({ currentProject: project, history: null }),

  fetchHistory: async (projectId) => {
    const { data } = await api.get(`/projects/${projectId}/history`)
    set({ history: data })
    return data
  },
}))
