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

/* Fired on window when an API call comes back 401 (session expired, token
 * cleared, account deactivated) — the app shell listens and bounces the user
 * to the login screen. Auth calls are excluded so a wrong password on the
 * Login form shows its error instead of triggering a logout loop. */
export const UNAUTH_EVENT = 'kc:unauthorized'

/* Decode a JWT payload without verifying the signature (we only need the `exp`
   field to detect expiry client-side, before wasting a request on a dead token). */
export function parseJwt<T = any>(token: string): T | null {
  try {
    const payload = token.split('.')[1]
    if (!payload) return null
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))) as T
  } catch { return null }
}

/* True when the token's `exp` has passed. Tokens without `exp` are treated as
   valid — better to let the server 401 than to break apps that issue non-expiry
   tokens in future. */
export function isTokenExpired(token: string): boolean {
  const payload = parseJwt<{ exp?: number }>(token)
  if (!payload || !payload.exp) return false
  return Date.now() >= payload.exp * 1000
}

/** True when the request never got a reply — device offline, backend down,
 *  DNS/CORS failure or timeout. Indistinguishable at this layer, and the user
 *  message is the same either way: it's a network problem, not their input. */
export function isNetworkError(error: unknown): boolean {
  const e = error as AxiosError | undefined
  return !!e?.isAxiosError && !e.response
}

let token: string | null = localStorage.getItem('kc_token')

/* One shared axios instance for the whole app. */
export const http: AxiosInstance = axios.create({
  baseURL: BASE,
  timeout: 20_000,
})

/* Attach the JWT to every request automatically. If the token has already
   expired (client-side check), drop it and fire UNAUTH_EVENT so the shell
   bounces the user to login instead of sending a doomed request. */
http.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (!token) return config
  if (isTokenExpired(token)) {
    setToken(null)
    window.dispatchEvent(new CustomEvent(UNAUTH_EVENT))
    return config
  }
  config.headers.Authorization = `Bearer ${token}`
  return config
})

/* Normalise every failure into `ApiError { message, status, details }`. Network
 * failures get a plain-language message and always surface through the same
 * shape, so screens render "no internet" instead of a raw axios dump. */
http.interceptors.response.use(
  (res) => res,
  (error: AxiosError<{ error?: string; details?: { field: string; message: string }[] }>) => {
    const status = error.response?.status
    const data = error.response?.data
    let message = data?.error || error.message || 'Request failed'
    if (isNetworkError(error)) {
      message = 'No internet connection — check your network and try again.'
    }
    const err = new Error(message) as ApiError
    err.status = status
    err.details = data?.details
    /* Session died mid-use. Every screen funnels through here, so this is the
       one place that can reliably force the app back to the login screen. */
    if (status === 401 && !String(error.config?.url || '').includes('/api/auth/')) {
      window.dispatchEvent(new CustomEvent(UNAUTH_EVENT))
    }
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
  getToken: () => token,
  hasToken: () => !!token,
  isTokenExpired,
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

/** Tracks browser connectivity (`navigator.onLine` + online/offline events). A
 *  request in flight when the network drops still fails through axios — this
 *  drives the persistent banner, not the fetches themselves. */
export function useOnline(): boolean {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine))
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])
  return online
}

/* Keep every tab's auth state in sync: if another tab logs out (clears
   `kc_token`) or logs in (sets a new token), this tab follows immediately so
   nobody is left holding an expired token after long use. Runs once at module
   load; no-op in non-browser environments. */
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key !== 'kc_token') return
    if (!e.newValue) {
      setToken(null)
      window.dispatchEvent(new CustomEvent(UNAUTH_EVENT))
    } else if (e.newValue !== token) {
      token = e.newValue
    }
  })
}

/** Hook helper: fetch once on mount with loading state. Empty URL = skip (avoids 404 spam).
 *  Transient failures (serverless cold-start 503s, network blips) are retried a
 *  couple of times before the screen is left to show an error — so dropdowns
 *  like the procedures catalogue no longer come up empty "sometimes". */
export function useFetch<T>(url: string, deps: unknown[] = []) {
  const [data, setData] = useState<T | undefined>(undefined)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    if (!url || url.endsWith('/undefined') || url.endsWith('/api/patients/')) { setLoading(false); return () => {} }
    let live = true
    let attempts = 0
    const MAX_ATTEMPTS = 3
    const run = () => {
      if (!live) return
      setLoading(true)
      api.get<T>(url)
        .then((d) => { if (live) { setData(d); setError(''); setLoading(false) } })
        .catch((e) => {
          if (!live) return
          attempts++
          const status = (e as any)?.status
          /* 4xx is the server answering definitively — only network failures
             and 5xx (cold starts, upstream hiccups) are worth another round-trip. */
          const isTransient = status === undefined || status >= 500
          if (attempts < MAX_ATTEMPTS && isTransient) {
            setTimeout(run, 1000)
          } else {
            setError((e as Error).message)
            setLoading(false)
          }
        })
    }
    run()
    return () => { live = false }
  }, deps)
  return { data, error, loading, refetch: () => api.get<T>(url).then((d) => setData(d)) }
}
