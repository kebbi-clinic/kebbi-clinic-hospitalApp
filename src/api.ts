import axios, { AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios'
import { useEffect, useRef, useState } from 'react'
import { io as ioClient, Socket } from 'socket.io-client'

const BASE = import.meta.env.VITE_API_URL;

/** Turn a stored file path (e.g. /api/uploads/x.png) into a full URL the browser can load. */
export function fileUrl(u?: string): string {
  if (!u) return ''
  return u.startsWith('http') ? u : `${BASE}${u}`
}

export interface User { id: string; name: string; role: string; app: 'hospital' | 'admin'; mustChangePassword?: boolean }
export interface ApiError extends Error { status?: number; details?: { field: string; message: string }[] }

let token: string | null = localStorage.getItem('kc_token')

/* One shared axios instance for the whole app. */
export const http: AxiosInstance = axios.create({
  baseURL: BASE,
  timeout: 20_000,
})

/* Attach the JWT to every request automatically. */
http.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

/* Normalise every failure into `ApiError { message, status, details }`. */
http.interceptors.response.use(
  (res) => res,
  (error: AxiosError<{ error?: string; details?: { field: string; message: string }[] }>) => {
    const status = error.response?.status
    const data = error.response?.data
    const err = new Error(data?.error || error.message || 'Request failed') as ApiError
    err.status = status
    err.details = data?.details
    return Promise.reject(err)
  },
)

function setToken(t: string | null) {
  token = t
  if (t) localStorage.setItem('kc_token', t)
  else {
    localStorage.removeItem('kc_token')
    /* Drop the presence-tracked socket on logout so "online" reflects reality. */
    if (socket) { socket.disconnect(); socket = null }
  }
}

export const api = {
  get: <T = never>(url: string) => http.get<T>(url).then((r) => r.data),
  post: <T = never>(url: string, body?: unknown, isForm = false) =>
    http.post<T>(url, isForm ? (body as FormData) : body).then((r) => r.data),
  put: <T = never>(url: string, body?: unknown) => http.put<T>(url, body).then((r) => r.data),
  del: <T = never>(url: string) => http.delete<T>(url).then((r) => r.data),
  setToken,
  hasToken: () => !!token,
  BASE,
}

let socket: Socket | null = null

/* Realtime is opt-in via VITE_SOCKET_URL and is OFF by default.
 *
 * The API is deployed as a Vercel /api function, which cannot host WebSocket
 * upgrades — every attempt failed and, with reconnectionAttempts: Infinity,
 * retried forever. That is the `[socket] connection error` spam in the console.
 * With no VITE_SOCKET_URL set we never open a connection at all; screens fall
 * back to their normal fetch-on-mount / fetch-on-navigate behaviour. Point
 * VITE_SOCKET_URL at a long-lived Socket.IO host (the API run via `npm start`
 * on Railway/Render/Fly) to switch realtime back on — no code change needed. */
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL as string | undefined
export const REALTIME_ENABLED = !!SOCKET_URL

/* Inert stand-in so every call site (on/off/emit/connected) keeps working. */
const inertSocket = {
  connected: false,
  on: () => inertSocket,
  once: () => inertSocket,
  off: () => inertSocket,
  emit: () => inertSocket,
  connect: () => inertSocket,
  disconnect: () => inertSocket,
} as unknown as Socket

/** One shared Socket.IO connection for the whole app.
 *  Reconnection is retried a bounded number of times and errors are swallowed —
 *  real-time is a bonus layer, so a flaky network (or a cold backend on a
 *  reload) must never take a screen down. */
export function getSocket(): Socket {
  if (!SOCKET_URL) return inertSocket
  /* The login JWT rides the handshake so the backend marks this staff member
     online for the admin console's live presence view. */
  if (!socket) {
    socket = ioClient(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      auth: { token: token || undefined },
      reconnection: true,
      /* Bounded, not Infinity: a host that cannot serve websockets should not
         keep retrying for the lifetime of the page. */
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10_000,
    })
    socket.on('connect_error', (e) => console.warn('[socket] connection error:', e.message))
  }
  return socket
}

/** Join this user's role-room so role-targeted events (notifications) arrive. */
export function subscribeRole(role: string) {
  if (!role) return
  try {
    const s = getSocket()
    if (s.connected) s.emit('subscribe', role)
    else s.on('connect', () => s.emit('subscribe', role))
  } catch (e) {
    console.warn('[socket] subscribe failed:', e)
  }
}

/** Every server event the app reacts to. */
export const REALTIME_EVENTS = [
  'data.changed', 'activity.new', 'notification', 'permissions.changed',
  'staff.updated', 'staff.created', 'staff.roleMoved', 'auth.userOnline',
]

/** Live-update hook — re-run `onEvent` whenever the server emits any of `events`.
 *  Pass a smaller `events` list to react only to specific changes. */
export function useRealtime(onEvent: (evt?: string, payload?: unknown) => void, events: string[] = REALTIME_EVENTS, role?: string) {
  const cb = useRef(onEvent)
  cb.current = onEvent
  const key = events.join('|')
  useEffect(() => {
    const s = getSocket()
    if (role) s.emit('subscribe', role)
    const handlers = (key ? key.split('|') : REALTIME_EVENTS).map((e) => {
      const h = (payload?: unknown) => cb.current(e, payload)
      return [e, h] as const
    })
    handlers.forEach(([e, h]) => s.on(e, h))
    return () => { handlers.forEach(([e, h]) => s.off(e, h)) }
  }, [key, role])
}

/** Hook helper: fetch once on mount with loading state. Empty URL = skip (avoids 404 spam). */
export function useFetch<T>(url: string, deps: unknown[] = []) {
  const [data, setData] = useState<T | undefined>(undefined)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    if (!url || url.endsWith('/undefined') || url.endsWith('/api/patients/')) { setLoading(false); return () => {} }
    let live = true
    setLoading(true)
    api.get<T>(url)
      .then((d) => { if (live) { setData(d); setError('') } })
      .catch((e) => { if (live) setError(e.message) })
      .finally(() => { if (live) setLoading(false) })
    return () => { live = false }
  }, deps)
  return { data, error, loading, refetch: () => api.get<T>(url).then((d) => setData(d)) }
}
