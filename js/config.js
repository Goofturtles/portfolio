// The switches. Everything else is decided by media/manifest.json and apps/files.json.
export const CONFIG = {
  // AI Arjun on the mini desktop. 'auto' = film/ui's view_browser.js (the real browser window) whenever
  // tools/sync_ui.py has copied it, otherwise the older view_ai.js. Force one with 'browser' or 'ai'.
  aiView: 'auto',
  // how long the tunnel plays between places, in ms (a clip in the manifest plays for its own length instead)
  tunnelMs: 1500,
  // the phone layout: one full-screen app with a bottom bar. Also used on any touch-only screen, where the
  // desktop's small window buttons would be under 44 px.
  phone: '(max-width: 1023px), (hover: none) and (pointer: coarse)',
}

// Motion has an off switch (film/SPEC.md): the system's setting, read live, or the tray's "Reduce motion" (html.calm,
// kept for the next visit). css/site.css stills every animation for both; 'motionchange' tells whoever runs a loop.
const sysCalm = matchMedia('(prefers-reduced-motion: reduce)')
try { if (localStorage.getItem('pc-calm') === '1') document.documentElement.classList.add('calm') } catch (e) { /* private mode: the switch lasts for this visit */ }
export const calm = () => document.documentElement.classList.contains('calm')
export const reduced = () => calm() || sysCalm.matches
export function setCalm(on) {
  document.documentElement.classList.toggle('calm', on)
  try { localStorage.setItem('pc-calm', on ? '1' : '') } catch (e) { /* as above */ }
  dispatchEvent(new CustomEvent('motionchange'))
}
sysCalm.addEventListener('change', () => dispatchEvent(new CustomEvent('motionchange')))
export const wait = (ms) => new Promise((r) => setTimeout(r, ms))
export const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e }
// try again after a refused request (the local server is single-threaded and sometimes drops one of a burst)
export async function retry(fn, tries = 4) {
  for (let i = 1; ; i++) {
    try { return await fn(i) } catch (e) { if (i >= tries) throw e; await wait(250 * i) }
  }
}
