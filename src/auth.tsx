import { createContext, useContext, useState, type ReactNode } from 'react'
import { api, type User } from './api'
import { authApi } from './endpoints'

interface AuthCtx {
  user: User
  login: (username: string, password: string) => Promise<User>
  changePassword: (currentPassword: string, newPassword: string) => Promise<User>
  logout: () => void
}
const Ctx = createContext<AuthCtx>(null as never)

function storedUser(): User | null {
  try { return JSON.parse(localStorage.getItem('kc_user') || 'null') } catch { return null }
}

/** A user object we can safely render (role/name are used for nav and initials). */
function isValidUser(u: unknown): u is User {
  const x = u as User | null
  return !!x && typeof x === 'object' && typeof x.role === 'string' && typeof x.name === 'string'
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // Token is restored by api.ts; the user record rides along in localStorage.
  // A half-written or stale `kc_user` must never take the app down — treat it as logged out.
  const [user, setUser] = useState<User | null>(() => {
    if (!api.hasToken()) return null
    const u = storedUser()
    if (!isValidUser(u)) { localStorage.removeItem('kc_user'); return null }
    return u
  })

  const login = async (username: string, password: string) => {
    const r = await authApi.login(username, password, 'hospital')
    api.setToken(r.token)
    localStorage.setItem('kc_user', JSON.stringify(r.user))
    setUser(r.user)
    return r.user
  }
  const changePassword = async (currentPassword: string, newPassword: string) => {
    const r = await authApi.changePassword(currentPassword, newPassword)
    api.setToken(r.token)
    localStorage.setItem('kc_user', JSON.stringify(r.user))
    setUser(r.user)
    return r.user
  }
  const logout = () => { api.setToken(null); localStorage.removeItem('kc_user'); setUser(null) }

  return <Ctx.Provider value={{ user: user as User, login, changePassword, logout }}>{children}</Ctx.Provider>
}

export function useAuth() {
  return useContext(Ctx)
}

