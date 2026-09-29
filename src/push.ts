/* Web Push registration — called once after login (from Layout).
 * Registers /sw.js, asks for notification permission (once), subscribes this
 * browser and sends the subscription to the backend. The backend derives the
 * recipient role/user from the JWT — never from anything the client sends.
 * With this in place staff hear alerts even after closing the tab. */
import { api } from './api'

function toApplicationServerKey(b64: string): Uint8Array<ArrayBuffer> {
  const s = atob(b64.replace(/-/g, '+').replace(/_/g, '/'))
  const arr = new Uint8Array(new ArrayBuffer(s.length))
  for (let i = 0; i < s.length; i++) arr[i] = s.charCodeAt(i)
  return arr
}

export async function initPush(): Promise<void> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return
  try {
    await navigator.serviceWorker.register('/sw.js')
    const reg = await navigator.serviceWorker.ready
    if (Notification.permission === 'denied') return
    if (Notification.permission === 'default') {
      const p = await Notification.requestPermission()
      if (p !== 'granted') return
    }
    const existing = await reg.pushManager.getSubscription()
    if (existing) {
      await api.post('/api/push/subscribe', existing.toJSON())
      return
    }
    const { publicKey } = await api.get<{ publicKey: string }>('/api/push/public-key')
    if (!publicKey) return
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: toApplicationServerKey(publicKey),
    })
    await api.post('/api/push/subscribe', sub.toJSON())
  } catch (e) {
    console.warn('[push] registration failed:', e)
  }
}
