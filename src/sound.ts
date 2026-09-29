/* Notification ping via Web Audio — no audio files to ship. Two-tone chime (A5→D6).
 * Browsers block sound until the page is interacted with at least once, so an
 * unlock listener resumes the audio context on the first click/keypress. */
let ctx: AudioContext | null = null

function ensure(): AudioContext | null {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return null
    ctx = ctx || new AC()
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch { return null }
}

if (typeof window !== 'undefined') {
  const unlock = () => { ensure() }
  window.addEventListener('pointerdown', unlock, { passive: true })
  window.addEventListener('keydown', unlock)
}

/** Play the "you have a new notification" chime. Safe to call anywhere, anytime. */
export function playPing(): void {
  const c = ensure()
  if (!c) return
  try {
    const t = c.currentTime + 0.01
    const beep = (freq: number, at: number, dur = 0.16, vol = 0.22) => {
      const o = c.createOscillator()
      const g = c.createGain()
      o.type = 'sine'
      o.frequency.setValueAtTime(freq, t + at)
      g.gain.setValueAtTime(0.0001, t + at)
      g.gain.exponentialRampToValueAtTime(vol, t + at + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, t + at + dur)
      o.connect(g)
      g.connect(c.destination)
      o.start(t + at)
      o.stop(t + at + dur + 0.05)
    }
    beep(880, 0)          /* A5 */
    beep(1174.66, 0.18)   /* D6 */
  } catch { /* audio unavailable — never break the UI over a sound */ }
}
