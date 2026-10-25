// Pages: the film's fanned sheets (P3). The sheets form a ring, then fan out, and the one that is picked comes upright
// to the front. "How I work" is one sheet per step (Research, Sketch, Build, Test, Present), each with REAL material
// from his work (js/apps/how.js); "Results so far" and "Follow-ups" are film/ui's own sheets (view_parts.js), and
// each Follow-ups row goes somewhere. The paper, the ring, the fan and the picking are here. Left alone, the sheets
// sway. The backdrop is P3's last frame once it is rendered (media/manifest.json, "pages"); until then a plain Windows
// surface, never a drawn stand-in. Reference: film/ref/ui/board/loop/ and the film's own frames (P3, f_0650).
import { apps } from './apps.js'
import { reduced, wait, el } from './config.js'
import { media, pick, loadImage } from './media.js'
import { esc, loadOwn } from './apps/common.js'
import { steps, sceneHTML, liven } from './apps/how.js'

const root = document.getElementById('pages')
const FOLLOW = ['projects', 'films', 'ai', 'contact']        // the Follow-ups rows, in view_parts.js's order
const W = 600, H = 800                                        // a sheet, in the film's pixels
let act = () => {}, built = false, current = 1, fan, tabs, dots, sheets = [], own = null
let FIRST = 1, RESULTS = 6, FOLLOWUPS = 7                     // where each kind of sheet sits in the fan (set in build)

export function init(onAct) { act = onAct }
export const prepare = () => Promise.all([apps.all(), loadOwn().then((o) => { own = o })])

async function build() {
  built = true
  const S = steps()
  root.innerHTML = `<div class="poster on"></div><div class="fan"></div><div class="pg-steps" role="group" aria-label="Steps"></div><div class="pg-tabs" role="group" aria-label="Sheets"></div>`
  fan = root.querySelector('.fan'); tabs = root.querySelector('.pg-tabs'); dots = root.querySelector('.pg-steps')
  const add = (cls, html, name) => {
    const s = fan.appendChild(el('article', 'sheet ' + cls, html))
    s.style.width = W + 'px'; s.style.height = H + 'px'
    s.dataset.i = sheets.length; s.style.setProperty('--n', sheets.length)
    if (name) s.setAttribute('aria-label', name); else s.setAttribute('aria-hidden', 'true')
    sheets.push(s)
  }
  add('s0', PARTS['sheet-ideas'][2]())                       // the film's first sheet: dressing, at the back of the fan
  FIRST = sheets.length
  S.forEach((s, i) => add('step', `<div class="hsheet" style="--c:var(--s${i + 1})"><header><i>${String(i + 1).padStart(2, '0')}</i><div><h2>${esc(s.name)}</h2><p>${esc(s.line)}</p></div></header>` +
    `${sceneHTML(i, own)}<footer><span>From his own work</span><button type="button" data-go="how" data-arg="${esc(s.name)}">Open the canvas</button></footer></div>`, `${i + 1}. ${s.name}`))
  RESULTS = sheets.length; add('s2', PARTS['sheet-results'][2](), 'Results so far')
  FOLLOWUPS = sheets.length; add('s3', PARTS['sheet-followups'][2](), 'Follow-ups')
  // Follow-ups: each row is a way on from here
  sheets[FOLLOWUPS].querySelectorAll('.ptr:not(.ph)').forEach((row, i) => { row.dataset.go = FOLLOW[i]; row.tabIndex = 0; row.setAttribute('role', 'link') })
  dots.innerHTML = S.map((s, i) => `<button type="button" class="hb" data-i="${FIRST + i}" aria-label="${i + 1}. ${esc(s.name)}" title="${esc(s.name)}">${i + 1}</button>`).join('')
  tabs.innerHTML = [[FIRST, 'How I work'], [RESULTS, 'Results'], [FOLLOWUPS, 'Follow-ups']].map(([i, n]) => `<button type="button" class="hb" data-i="${i}">${n}</button>`).join('')
  const press = (e) => {
    if (e.type === 'keydown' && e.key !== 'Enter') return
    const go = e.target.closest('[data-go]'), s = e.target.closest('[data-i]')
    if (go && +go.closest('.sheet').dataset.i === current) return act(go.dataset.go, go.dataset.arg)
    if (s && !s.hasAttribute('aria-hidden') && +s.dataset.i !== current) pickIndex(+s.dataset.i)
  }
  root.addEventListener('click', press); root.addEventListener('keydown', press)
  addEventListener('resize', layout)
  liven(root, own)
  await paint()
}
async function paint() {
  if (!built) return
  const m = pick('pages'), bd = root.querySelector('.poster')
  bd.dataset.theme = media.theme
  bd.innerHTML = ''                                          // a plain Windows surface (css/site.css) until P3's last frame is rendered
  if (m.poster) { const im = await loadImage(m.poster).catch(() => null); if (im) { im.alt = ''; bd.appendChild(im) } }
}
// the fan: the chosen sheet upright in front, the others leaning out behind it like a hand of cards, closer together
// the further back they are
function layout() {
  if (!built) return
  const w = root.clientWidth, h = root.clientHeight, phone = w < 700
  const k = Math.min(1, (w - (phone ? 40 : 360)) / W, (h - (phone ? 268 : 216)) / H)
  fan.style.setProperty('--k', k.toFixed(4))
  const lean = phone ? 4 : 7, shift = (phone ? 0.1 : 0.3) * W * k, at = (d) => Math.sign(d) * (1 - Math.pow(0.7, Math.abs(d))) / 0.3
  fan.style.setProperty('--fx', (-(at(sheets.length - 1 - current) + at(-current)) * shift / 4).toFixed(1) + 'px')      // the whole hand sits in the middle
  sheets.forEach((s, i) => {
    const d = i - current, a = Math.abs(d), on = d === 0
    s.classList.toggle('on', on)
    const inner = s.firstElementChild                         // only the sheet in front can be used; a press anywhere on another brings that one forward
    inner.inert = !on; on ? inner.removeAttribute('aria-hidden') : inner.setAttribute('aria-hidden', 'true')
    s.style.zIndex = on ? 20 : 10 - a
    s.style.setProperty('--r', (on ? 0 : Math.sign(d) * Math.min(a * lean, 26)) + 'deg')
    s.style.setProperty('--x', (at(d) * shift).toFixed(1) + 'px')
    s.style.setProperty('--y', (Math.abs(at(d)) * 14).toFixed(1) + 'px')
    s.style.setProperty('--s', on ? 1 : Math.max(0.72, 0.92 - a * 0.035))
    s.style.setProperty('--d', a)
    s.style.setProperty('--a', (i * 360 / sheets.length) + 'deg')
  })
  const step = current >= FIRST && current < RESULTS
  for (const t of tabs.children) t.setAttribute('aria-pressed', step ? +t.dataset.i === FIRST : +t.dataset.i === current)
  for (const t of dots.children) t.setAttribute('aria-pressed', +t.dataset.i === current)
  dots.classList.toggle('off', !step); dots.inert = !step
}
function pickIndex(i) { current = i; layout() }
const indexOf = (which) => (which === 'results' ? RESULTS : which === 'followups' ? FOLLOWUPS : FIRST)

export async function enter(which) {
  await prepare()
  root.hidden = false
  if (!built) await build()
  current = indexOf(which)
  layout()
  if (reduced()) return
  root.classList.add('arriving', 'stack')                     // one small stack ...
  void root.offsetWidth
  root.classList.replace('stack', 'ring')                     // ... opens into the ring ...
  await wait(640)
  root.classList.remove('ring')                               // ... and the ring fans out
  await wait(680)
  root.classList.remove('arriving')
}
export async function leave() {
  root.classList.add('leaving')
  await wait(reduced() ? 0 : 280)
  root.hidden = true
  root.classList.remove('leaving', 'ring', 'stack', 'arriving')
}
export const show = (which) => pickIndex(indexOf(which))
export const setTheme = paint
