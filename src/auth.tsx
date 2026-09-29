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

export function AuthProvider({ children }: { children: ReactNode }) {
  // Token is restored by api.ts; the user record rides along in localStorage.
  const [user, setUser] = useState<User | null>(api.hasToken() ? storedUser() : null)

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

