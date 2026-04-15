import { create } from 'zustand'

function parseJwt(token) {
  try {
    return JSON.parse(atob(token.split('.')[1]))
  } catch { return null }
}

const useAuthStore = create((set, get) => ({
  token:   localStorage.getItem('dg_token') || null,
  user:    JSON.parse(localStorage.getItem('dg_user') || 'null'),

  setAuth: (token, user) => {
    localStorage.setItem('dg_token', token)
    localStorage.setItem('dg_user', JSON.stringify(user))
    set({ token, user })
  },

  updateCredits: (credits, earnings) => {
    const user = { ...get().user, credits, earnings }
    localStorage.setItem('dg_user', JSON.stringify(user))
    set({ user })
  },

  updateRole: (role, token) => {
    const user = { ...get().user, role }
    localStorage.setItem('dg_user', JSON.stringify(user))
    localStorage.setItem('dg_token', token)
    set({ user, token })
  },

  logout: () => {
    localStorage.removeItem('dg_token')
    localStorage.removeItem('dg_user')
    set({ token: null, user: null })
  },

  isAuthenticated: () => !!get().token,
  isContributor:   () => get().user?.role === 'contributor',
  isResearcher:    () => get().user?.role === 'researcher',
}))

export default useAuthStore
