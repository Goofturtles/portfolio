// Small signs of life on the mini desktop while it is left alone (Arjun, 2026-11-01: idle motion on the desktop too).
//   AI Arjun's search box, empty and not in use, types out the questions it can answer (its own suggestions, read off the
//   page under it, so every one has a real answer), holds each a moment, rubs it out and types the next. A hand on the
//   page, or the box itself in use, puts its own words back at once.
//   (The start card's tiles catching a sheen now and then is css/laptop.css alone.)
// Nothing runs while the desktop is away, the tab is hidden, or the visitor asks for less motion.
import { reduced } from './config.js'

const BOXES = '.g-q, .mb-url'                                    // the browser's new-tab box (apps/view_browser.js); the phone page's (js/ai.js)
const FALLBACK = ['What have you built?', 'How can I contact you?', 'What have you won?']
const own = new WeakMap()                                         // each box's own placeholder
let root = null, timer = 0, box = null, list = [], qi = 0, phase = 'wait', at = 0, n = 0, still = 0

function visible() {
  for (const b of root.querySelectorAll(BOXES)) if (b.offsetParent !== null && !b.closest('[inert], .shelved')) return b
  return null
}
function restore() {
  if (box && own.has(box)) box.placeholder = own.get(box)
  box = null; phase = 'wait'; n = 0
}
function questions(b) {
  const page = b.closest('.n-page, .m-ai, .wcont') || root
  const q = [...page.querySelectorAll('.n-sugg a, .mb-sugg a, [data-q]')].map((a) => a.textContent.trim()).filter((t) => t && t.length < 48)
  return q.length ? q : FALLBACK
}
function tick() {
  const now = performance.now()
  if (document.hidden || reduced() || !root || root.hidden || root.classList.contains('dormant')) { restore(); return }
  const b = visible()
  if (b !== box) { restore(); box = b; if (b) { if (!own.has(b)) own.set(b, b.placeholder); list = questions(b); at = now } }
  if (!box) return
  if (document.activeElement === box || box.value) { restore(); return }
  if (now - still < 2500) { if (phase !== 'wait') restore(); box = b; at = now; return }      // a hand on the page: its own words, and a pause
  const q = list[qi % list.length]
  if (phase === 'wait' && now - at > 2600) { phase = 'type'; n = 0; at = now }
  else if (phase === 'type' && now - at > 62) { n++; at = now; box.placeholder = q.slice(0, n); if (n >= q.length) phase = 'hold' }
  else if (phase === 'hold' && now - at > 1900) { phase = 'erase'; at = now }
  else if (phase === 'erase' && now - at > 24) { n--; at = now; box.placeholder = n > 0 ? q.slice(0, n) : own.get(box); if (n <= 0) { phase = 'gap'; qi++ } }
  else if (phase === 'gap' && now - at > 900) { phase = 'type'; n = 0; at = now }
}
const moved = () => { still = performance.now() }

// the desktop is showing (js/desktop.js enter) / has gone (leave)
export function wake(el) {
  root = el
  if (timer) return
  still = performance.now()
  timer = setInterval(tick, 40)
  addEventListener('pointermove', moved, { passive: true }); addEventListener('keydown', moved, true)
}
export function sleep() {
  clearInterval(timer); timer = 0
  restore()
  removeEventListener('pointermove', moved); removeEventListener('keydown', moved, true)
}
