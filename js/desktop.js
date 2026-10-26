// The mini desktop: the laptop's desktop from the film, live.
//   wide screen with a mouse   the wallpaper, the site's own taskbar and window frames (js/shell.js, to Windows 11's
//                              measurements) and windows that open, close, minimise, maximise, move and come to the front: the portfolio document (film/ui's P4 window), AI Arjun (film/ui's browser),
//                              and one real app per place (js/apps/): Projects a file explorer, Films a media player,
//                              How I work a task board, Results an achievements screen, Contact a chat app
//   on the laptop              on a computer with the live room, all of the above is drawn ON the laptop's screen in
//                              the room (js/laptop.js): a fixed size at the glass's shape, mapped onto it every frame
//   phone / touch              one full-screen app at a time and the taskbar as a bottom bar with names; the same apps
//                              in their narrow layout; AI Arjun is a mobile browser page (ai.js)
// film/ui is used as it is (apps/, copied by tools/sync_ui.py) for what is INSIDE a window: the portfolio document and
// the browser. Its taskbar, its title bars and its icons are not used here: the site owns those (js/shell.js, js/icons.js).
import { apps } from './apps.js'
import { CONFIG, reduced, wait, el } from './config.js'
import { SECTIONS, sectionHTML } from './sections.js'
import { mountAI } from './ai.js'
import { taskbar, titlebar, setMax, YOUTUBE } from './shell.js'
import { line, ico } from './icons.js'
import * as laptop from './laptop.js'
import { themeInfo } from './media.js'
import { film as filmOf, loadOwn } from './apps/common.js'
import { mountBloom, still as bloomStill, small as bloomSmall } from './bloom.js'
import * as explorer from './apps/explorer.js'
import * as player from './apps/player.js'
import * as board from './apps/board.js'
import * as trophies from './apps/trophies.js'
import * as chat from './apps/chat.js'
import * as about from './apps/about.js'
import * as pdoc from './apps/portfolio.js'

const root = document.getElementById('desktop')
const phoneMQ = matchMedia(CONFIG.phone)
const NAMES = Object.fromEntries(SECTIONS)
const APPS = { projects: explorer, films: player, how: board, results: trophies, contact: chat, about }
const TARGET = { app: 'portfolio' }                         // taskbar slot -> the app it opens, where the names differ. A slot whose link is a web address (GitHub, LinkedIn, Medium, YouTube) is simply followed.
let act = () => {}, setTitle = () => {}
let mode = null, wall, layer, bar, body, shell
const wins = new Map(), screens = new Map()                 // desk: the open windows; phone: the apps that have been opened
let zTop = 10, byKey = false, shown = null, onlap = false, start = null
const ctx = { act: (id, arg) => act(id, arg), toast: (text) => act('toast', text) }

export function init(onAct, onTitle) { act = onAct; setTitle = onTitle }
// On the laptop the desktop is never taken out of the page between visits: it rests invisible on the glass (dormant:
// transparent, inert, laid out and painted already), so flying in never pays for laying it out and painting it.
const away = () => root.hidden || root.classList.contains('dormant')
function doze(on) {
  root.classList.toggle('dormant', on); root.inert = on
  if (on && onlap) laptop.park()                            // resting: nothing of it runs a frame in the room (js/laptop.js, css/laptop.css, js/apps/common.js)
}
export const prepare = () => Promise.all([apps.all(), loadOwn().catch(() => {})]).then((r) => { if (!mode && root.hidden) build(); return r })      // built ahead, hidden: arriving on it must not cost the flight any frames
export const isPhone = () => phoneMQ.matches
export const tag = () => ''                                // the wallpaper is the finished picture, not a work-in-progress render

export async function enter(id, arg) {
  await apps.all()
  const want = isPhone() ? 'phone' : 'desk'
  if (mode !== want || onlap !== (want === 'desk' && laptop.can())) build()
  if (onlap) laptop.glue(root)                               // sized and on the glass before it shows
  root.hidden = false
  doze(false)
  root.classList.add('arriving')
  // Flying in (js/room.js), the desktop itself is what the camera lands on; a window opens once it has landed, as an
  // app opens on a desktop. Opening it mid-flight cost the flight over 100 ms of frames.
  const landing = mode === 'desk' && window.__landing
  window.__landing = null
  // Back at the laptop itself (not at one place on it) the desktop is as it was left, for the life of the page: the same
  // windows open where they were, the one in front still in front, minimised or maximised as before, each app as it was
  // (the browser's tabs and scroll). Leaving only hid it (leave() below); nothing here puts a window away or opens one.
  // The first visit has no windows, so it shows the start card, as ever.
  const kept = mode === 'desk' && id === 'start' && wins.size > 0
  if (kept) marks()
  if (landing) { if (!kept) showStart(); landing.then(() => { if (away()) return; if (!kept) show(id, arg) }) } else if (!kept) show(id, arg)
  await wait(reduced() ? 0 : onlap ? 600 : 320)
  root.classList.remove('arriving')
}
export async function leave() {
  // on the laptop the camera pulls back with the desktop still on the glass; near the end the glass shows its own
  // picture again (the same wallpaper)
  if (onlap && !reduced()) await wait((parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--m-rise-ms')) || 1250) * 0.6)
  root.classList.add('leaving')
  await wait(reduced() ? 0 : 280)
  if (onlap) doze(true); else root.hidden = true
  root.classList.remove('leaving')
  for (const a of [wins.get('films'), screens.get('films')]) if (a && a.app) a.app.pause()      // a film does not play on behind another place; it waits where it was and is not started again
}
export function show(id = 'portfolio', arg) { mode === 'phone' ? showPhone(id === 'start' ? 'portfolio' : id, arg) : id === 'start' ? showStart() : open(id, arg) }
export function setTheme() {
  if (!mode) return
  const ui = themeInfo().ui
  root.classList.add('retheme'); clearTimeout(setTheme.t); setTheme.t = setTimeout(() => root.classList.remove('retheme'), 520)      // for this half second every colour inside eases (site.css)
  for (const e of [bar, start, mode === 'phone' ? root : null, ...[...wins.values()].filter((w) => w.themed).map((w) => w.el)]) if (e) { e.classList.remove('light', 'dark'); e.classList.add(ui) }
  if (wall && !wall.classList.contains('real') && !wall.classList.contains(ui)) {      // the drawn stand-in wallpaper has a light and a dark picture: the new one fades in over the old
    const old = wall
    wall = wallpaper(root, ui)
    old.after(wall); wall.classList.add('fresh')
    setTimeout(() => old.remove(), 700)
  }
}

// The wallpaper: the Windows 11 bloom, moved live over the plain picture by js/bloom.js (the plain picture is all
// there is with reduced motion or no WebGL). The small still shows first, the full-size one loads over it.
function makeWall(parent, ui) {
  const w = wallpaper(parent, ui)
  w.classList.add('real')
  w.style.backgroundImage = `url("${bloomStill()}"), url("${bloomSmall}")`
  if (!reduced()) mountBloom(w)
  return w
}

function build() {
  const was = away()
  mode = isPhone() ? 'phone' : 'desk'
  onlap = mode === 'desk' && laptop.can()
  if (!onlap) laptop.unglue()
  for (const a of [wins.get('films'), screens.get('films')]) if (a && a.app) a.app.stop()
  wins.clear(); screens.clear(); shown = null
  root.innerHTML = ''
  root.className = 'place ' + mode + (onlap ? ' onlap' : '')
  const ui = themeInfo().ui
  if (mode === 'desk') {
    wall = onlap ? null : makeWall(root, ui)                 // on the laptop the glass's own picture is the wallpaper
    start = root.appendChild(startPanel(ui))
    layer = root.appendChild(el('div', 'wins'))
  } else {
    wall = null; start = null
    root.classList.add(ui)
    body = root.appendChild(el('div', 'm-body'))
  }
  if (shell) shell.stop()
  // js/shell.js: the taskbar (on a phone five slots and a sheet), to Windows 11's measurements. Every press comes here.
  shell = taskbar(root, ui, mode === 'phone', { kind: 'desktop', pick(slotId, a, e, arg) {
    const id = TARGET[slotId] || slotId, w = mode === 'desk' && wins.get(id)
    if (a) { a.classList.remove('launch'); void a.offsetWidth; a.classList.add('launch') }      // the icon dips and comes back as it launches
    if (a && e && w && e.detail !== 0 && !w.el.hidden && w === top()) return minimise(w)      // as on Windows: the button of the window in front puts it away
    byKey = !!e && e.detail === 0                              // opened with the keyboard: the keyboard goes into the window (open())
    setTimeout(() => { byKey = false }, 400)
    act(id, arg)
  } })
  bar = shell.el
  for (const e of [start, root.querySelector(':scope > .sf')]) rim(e)      // not the taskbar: it is flat mica, as Windows' is
  if (onlap && was) {                                       // built ahead for the laptop: resting on the glass, unseen, its glass already fitted
    root.hidden = false; doze(true); laptop.prime(root)
    root.classList.add('rehearse'); setTimeout(() => root.classList.remove('rehearse'), 450)      // css/laptop.css
  }
  else if (was) root.hidden = true
}
// the glass's rim of light (css/laptop.css; shown only on the laptop, where js/laptop.js slides its two glints)
const rim = (e) => { if (e && !e.querySelector(':scope > .lg-rim')) e.appendChild(el('span', 'lg-rim', '<i></i><i></i>')) }
const slot = (id) => bar.querySelector(`.tk[data-ico="${id === 'portfolio' ? 'app' : id}"]`)
// The start state (Windows 11's Start, its pinned apps): who this is in one line, every place as a labelled tile, and at
// its foot his pages elsewhere (GitHub, LinkedIn, Medium, YouTube: off the taskbar, which holds only places) and the
// plain list. It sits on the wallpaper under the windows, so it is what shows whenever no window is open.
function startPanel(ui) {
  const D = window.DATA, P = D.profile
  const tiles = [['portfolio', 'app', 'Portfolio', 'The overview, in one document'], ['projects', 'projects', 'Projects', D.projects.length + ' projects, a folder each'],
    ['films', 'films', 'Films', D.projects.filter(filmOf).length + ' launch films to watch'], ['how', 'how', 'How I work', 'His steps, from idea to launch'],
    ['results', 'results', 'Results', D.record.length + ' results and awards'], ['ai', 'ai', 'AI Arjun', 'Ask anything about him'],
    ['about', 'about', 'About', 'Who he is and what he uses'], ['contact', 'contact', 'Contact', 'Send him a message']]
  const s = el('section', 'start ' + ui, `<header><h1>${esc(P.name)}</h1><p>${esc(P.summary)}</p></header>` +
    `<nav aria-label="Places">${tiles.map(([id, icon, name, sub]) => `<button type="button" data-app="${id}">${ico(icon, 32)}<b>${name}</b><span>${esc(sub)}</span></button>`).join('')}</nav>` +
    `<footer class="st-foot"><p>${line('home', 16)} on the taskbar goes back to the room.</p><nav class="st-links" aria-label="Elsewhere">` +
    [['github', 'GitHub', P.links.github], ['linkedin', 'LinkedIn', P.links.linkedin], ['medium', 'Medium', P.links.medium], ['youtube', 'YouTube', YOUTUBE]]
      .map(([id, name, href]) => `<a href="${esc(href)}" target="_blank" rel="noopener">${ico(id, 16)}${name}</a>`).join('') + `<a href="plain.html">${line('list', 16)}Plain list</a></nav></footer>`)
  s.setAttribute('aria-label', 'Start')
  s.addEventListener('click', (e) => { const b = e.target.closest('[data-app]'); if (b) act(b.dataset.app) })
  return s
}
// back to the start state: every window is put away (still open, its pill stays on the taskbar)
function showStart() {
  for (const w of wins.values()) if (!w.el.hidden && !w.going) shelve(w, true)
  marks()
  setTitle('')
}
// one of the apps in js/apps/, in a box
function mountApp(box, id) {
  box.classList.add('wapp')
  return APPS[id].mount(box, ctx)
}

// ---- phone: one app at a time -------------------------------------------------------------------------
// the first screen: who he is, over the wallpaper, and every app as a row
function homeHTML() {
  const D = window.DATA, P = D.profile
  const rows = [['projects', 'Projects', D.projects.length + ' project folders'], ['films', 'Films', D.projects.filter(filmOf).length + ' launch films'], ['how', 'How I work', D.steps.map((s) => s.name).join(', ')],
    ['results', 'Results', D.record.length + ' results'], ['ai', 'AI Arjun', 'Ask anything about him'], ['about', 'About', P.role + ' · ' + P.location], ['contact', 'Contact', P.links.email]]
  return `<div class="m-home"><div class="m-hero"><div class="m-heroT"><h1>${esc(P.name)}</h1><p>${esc(P.headline)}</p></div></div><p class="lead">${esc(P.summary)}</p>` +
    `<nav class="m-launch" aria-label="Apps">${rows.map(([id, name, sub], i) => `<button type="button" data-app="${id}" style="--i:${i}">${PIX(id, 40, 44)}<span><b>${name}</b><em>${esc(sub)}</em></span>${ICON.chevR}</button>`).join('')}</nav></div>`
}
function showPhone(id, arg) {
  let s = screens.get(id)
  if (!s) {
    s = { el: body.appendChild(el('div', 'm-app')) }
    s.el.dataset.app = id
    if (id === 'ai') { s.el.classList.add('m-ai'); s.ask = mountAI(s.el) }
    else if (APPS[id]) s.app = mountApp(s.el, id)
    else if (id === 'portfolio') {
      s.el.innerHTML = homeHTML()
      makeWall(s.el.querySelector('.m-hero'), 'dark')
      s.el.addEventListener('click', (e) => { const b = e.target.closest('[data-app]'); if (b && b !== s.el) act(b.dataset.app) })
    } else s.el.innerHTML = `<div class="sec m-sec">${sectionHTML(id)}</div>`
    screens.set(id, s)
  }
  if (shown && shown !== s && shown.app && shown.app.stop) shown.app.stop()
  for (const x of screens.values()) x.el.hidden = x !== s
  if (shown !== s) { s.el.classList.remove('in'); void s.el.offsetWidth; s.el.classList.add('in'); s.el.scrollTop = 0 }
  shown = s
  if (s.ask && arg) s.ask(arg)
  if (s.app) s.app.show(arg)
  for (const a of bar.querySelectorAll('.tk')) a.toggleAttribute('aria-current', a === (slot(id) || slot('more')))      // an app that lives behind More marks More
  setTitle(id === 'ai' ? 'AI Arjun' : NAMES[id] || 'Portfolio')
}

// ---- desktop: windows ---------------------------------------------------------------------------------
// Sizes and places. Every window is the same size and is centred, so a window behind another is hidden by it: never a
// sliver. The ones not moved by hand stand in a short stack, each 32 px (exactly one title bar) above the one in
// front of it, two deep, so what shows of a window behind is its whole title bar and nothing else; the window in
// front is always the lowest, and the stack re-forms, animated, whenever that changes. A narrow app (About, Results)
// keeps its content in a centred column inside the same frame.
const FILM_W = 1535, FILM_BAR = 48                         // film/ui's window: its width and its own title bar (view_window.js P4)
const BAR = 32, STEP = 0, DEEP = 2                       // STEP 0: a window behind another is wholly covered by it, as when Windows opens two apps at one size; the taskbar's pills carry the switching
const byZ = (a, b) => b.el.style.zIndex - a.el.style.zIndex
const live = () => [...wins.values()].filter((w) => !w.el.hidden && !w.shelved && !w.going && !w.away)
// One window at a time: the others are put on the shelf, still open (their pills stay) and still painted, so coming
// back to one is instant, but unseen and out of the way (css/laptop.css, .w.shelved). Minimised is display: none.
function shelve(w, on) {
  if (on && w.app && w.app.stop) w.app.stop()
  w.shelved = on; w.el.classList.toggle('shelved', on); w.el.inert = on
}
const top = () => live().sort(byZ)[0]

function metrics() {
  const W = layer.clientWidth, H = layer.clientHeight
  if (onlap) { const side = Math.max(16, Math.round(W * 0.022)); return { W, H, wide: Math.round(Math.min(FILM_W, W - 2 * side)), h: H - 2 * side } }      // on the laptop: sized to its screen, an even margin round it
  const side = W < 1280 ? 16 : Math.max(24, W * 0.08)
  const wide = Math.round(Math.min(FILM_W, W - 2 * side))
  return { W, H, wide, h: Math.round(Math.max(360, Math.min(H - 40 - DEEP * STEP, wide * 0.62))) }
}
function layout(moving) {
  const M = metrics(), stack = live().filter((w) => !w.max && !w.free).sort(byZ), n = Math.min(stack.length - 1, DEEP)
  if (moving && !reduced()) { layer.classList.add('moving'); clearTimeout(layout.t); layout.t = setTimeout(() => layer.classList.remove('moving'), 320) }
  for (const w of wins.values()) {
    if (w.going) continue
    const d = stack.indexOf(w), ww = M.wide
    const g = w.max ? { x: 0, y: 0, ww: M.W, hh: M.H }
      : w.free ? { x: Math.max(140 - ww, Math.min(w.x, M.W - ww)), y: Math.max(0, Math.min(w.y, M.H - BAR)), ww, hh: M.h }
      : { x: Math.round((M.W - ww) / 2), y: Math.round((M.H - M.h - Math.max(0, n) * STEP) / 2 + (d < 0 ? 0 : Math.max(0, n) - Math.min(d, DEEP)) * STEP), ww, hh: M.h }
    w.x = g.x; w.y = g.y
    w.el.classList.toggle('stacked', d > 0)                  // behind another in the stack: only its title bar shows
    Object.assign(w.el.style, { left: g.x + 'px', top: g.y + 'px', width: g.ww + 'px', height: g.hh + 'px' })
    if (w.st) {                                              // a film view is drawn at the film's width and scaled to the window's
      const k = g.ww / FILM_W, high = (g.hh - (w.cut ? BAR : 0)) / k + w.cut
      w.st.style.transform = `translateY(${-w.cut * k}px) scale(${k})`
      w.st.style.height = w.win.style.height = high + 'px'
      w.el.style.setProperty('--k', k)
    }
  }
  if (wins.has('ai') && window.__browser) window.__browser.bar()
}
// the taskbar: a pill under every open app, wider under the one in front
function marks() {
  const t = top()
  for (const a of bar.querySelectorAll('.tk')) {
    const o = [...wins.values()].find((x) => !x.going && slot(x.id) === a)
    a.classList.toggle('on', !!o); a.toggleAttribute('aria-current', !!o && o === t)
  }
  for (const x of wins.values()) x.el.classList.toggle('front', x === t)
  setTitle(t ? t.title : '')
}
// a short animation by class (css/shell.css); with reduced motion it is over at once
async function play(w, name, ms) {
  if (reduced()) return
  w.el.classList.add(name)
  await wait(ms)
  w.el.classList.remove(name)
}
// from a window to its button on the taskbar: where minimise goes and restore comes from
function toSlot(w) {
  const b = slot(w.id).getBoundingClientRect(), r = w.el.getBoundingClientRect()
  w.el.style.setProperty('--mx', (b.left + b.width / 2 - r.left - r.width / 2) + 'px'); w.el.style.setProperty('--my', (b.top + b.height / 2 - r.top - r.height / 2) + 'px')
}

function open(id, arg) {
  let w = wins.get(id)
  const fresh = !w
  if (fresh) {
    w = { id, el: el('section', 'w'), max: false, free: false, cut: 0 }
    w.el.dataset.app = id
    w.el.setAttribute('role', 'dialog'); w.el.tabIndex = -1
    if (id === 'ai') film(w, CONFIG.aiView === 'auto' ? (VIEWS.browser ? 'browser' : 'ai') : CONFIG.aiView)
    else if (id === 'portfolio') doc(w)
    else flow(w, id)
    chrome(w)
    wins.set(id, w)
    layer.appendChild(w.el)
  }
  const back = w.el.hidden, shelf = w.shelved
  w.el.hidden = false; shelve(w, false)
  // one window at a time, as an app fills a small screen: the others are put away (still open, their pills stay)
  for (const o of wins.values()) if (o !== w && !o.el.hidden && !o.shelved && !o.going) shelve(o, true)
  front(w)
  if (fresh) play(w, 'opening', onlap ? 480 : 320)
  else if (back) { toSlot(w); play(w, 'restoring', 260) }
  else if (shelf) play(w, 'opening', onlap ? 480 : 320)          // back from the shelf: it rises in again, as when it first opened
  if (w.show) w.show(arg)
  if (byKey) { byKey = false; (w.el.querySelector('.br-url') || (w.app && w.app.focus ? { focus: w.app.focus } : w.el)).focus({ preventScroll: true }) }
}
function front(w, later) {
  if (top() !== w || !w.el.style.zIndex) w.el.style.zIndex = ++zTop
  marks()
  if (!later) layout(true)
}
async function close(w) {
  const had = w.el.contains(document.activeElement)
  if (w.app && w.app.stop) w.app.stop()
  w.going = true
  marks()
  await play(w, 'closing', onlap ? 200 : 150)
  w.el.remove(); wins.delete(w.id)
  if (had) slot(w.id)?.focus({ preventScroll: true })       // the keyboard goes back to the icon that opened it
  layout(true)
}
async function minimise(w) {
  if (w.app && w.app.stop) w.app.stop()
  toSlot(w)
  w.away = true                                              // still open: its pill stays, the one in front changes
  marks()
  await play(w, 'minimising', 180)
  w.el.hidden = true; w.away = false
  layout(true)
}
// maximise and restore: the frame is already in its new place and grows into it from where it was
function maximise(w) {
  const a = w.el.getBoundingClientRect()
  w.max = !w.max; w.el.classList.toggle('max', w.max); setMax(w)
  w.el.style.transition = 'none'
  layout(true)
  const b = w.el.getBoundingClientRect()
  if (!reduced()) w.el.animate([{ transformOrigin: '0 0', transform: `translate(${a.left - b.left}px, ${a.top - b.top}px) scale(${a.width / b.width}, ${a.height / b.height})` }, { transformOrigin: '0 0', transform: 'none' }], { duration: 300, easing: 'cubic-bezier(.1, .9, .2, 1)' })
  requestAnimationFrame(() => { w.el.style.transition = '' })
}
// a window that is one of film/ui's views: built at the film's size, shown at the window's scale (layout())
function film(w, name) {
  const def = VIEWS[name], cont = w.el.appendChild(el('div', 'wcont')), st = cont.appendChild(el('div', 'stage'))
  st.style.width = def.w + 'px'; st.style.height = def.h + 'px'
  const draw = def.build(st)
  st.querySelector('.backdrop')?.remove()                    // the film's stand-in backdrop is not part of the window
  // the film places its window on a 1920 x 1080 frame; here the stage is just the window
  const win = st.querySelector('.win')
  win.style.left = win.style.top = '0px'
  st.style.width = win.style.width
  w.el.classList.add('light')                                // the film's browser is light in every theme
  Object.assign(w, { st, win })
  if (name === 'browser') {
    w.title = 'AI Arjun'; w.tall = win.querySelector('.br-tabs'); w.el.classList.add('tall')      // a browser's tab strip is its title bar
    draw(0)                                                  // the new-tab page; from here the view runs itself
    w.show = (q) => { if (q) window.__ask(q); window.__browser.bar() }
  } else {
    // the older AI window: its worked example types itself once, until the visitor touches it
    w.title = 'AI Arjun'; w.cut = FILM_BAR; w.icon = 'ai'
    let playing = !reduced()
    const t0 = performance.now(), stop = () => { if (playing) { playing = false; draw(99) } }
    win.addEventListener('pointerdown', stop, true); win.addEventListener('keydown', stop, true)
    if (playing) requestAnimationFrame(function tick(now) { if (!playing) return; const t = (now - t0) / 1000; if (t > 3.4) return stop(); draw(t); requestAnimationFrame(tick) })
    else draw(99)
    w.show = (q) => { if (q) { stop(); window.__ask(q) } }
  }
}
// the Portfolio document: the site's own, laid out at the window's size (js/apps/portfolio.js), light in every theme as
// the film's document is
function doc(w) {
  w.title = DATA.profile.name + ': Portfolio'; w.icon = 'app'
  w.el.classList.add('flow', 'light', 'pdoc')
  w.app = pdoc.mount(w.el.appendChild(el('div', 'wcont')), ctx)
  w.show = (name) => w.app.show(name)
}
// a window that lays itself out: one of the apps, or a section
function flow(w, id) {
  w.title = NAMES[id]
  w.icon = id
  w.themed = id !== 'films'                                  // light or dark with the theme; the player is a dark room in every theme, and so is its frame
  w.el.classList.add('flow', w.themed ? themeInfo().ui : 'dark')
  // About opens on who he is: his picture, name, and the line under it, all from his own profile
    const cont = w.el.appendChild(el('div', 'wcont', APPS[id] ? `<div class="wfill"></div>` : `<div class="wbody sec" tabindex="0">${sectionHTML(id, { heading: false })}</div>`))
  if (!APPS[id]) return
  w.app = mountApp(cont.firstChild, id)
  if (w.app.bar) { w.tall = w.app.bar; w.el.classList.add('tall', 'tabbed') }      // an app whose tab strip is its title bar (the file explorer): only the three buttons are added
  w.show = (arg) => w.app.show(arg)
}
// the frame: the title bar with its three buttons (js/shell.js), moving by the bar, and coming to the front
function chrome(w) {
  w.el.setAttribute('aria-label', w.title)
  rim(w.el)
  w.bar = w.tall || titlebar(w)
  const box = w.tall ? titlebar(w, true) : w.bar.querySelector('.wbx')
  box.addEventListener('click', (e) => {
    const d = (e.target.closest('button') || {}).dataset
    if (!d) return
    if (d.do === 'close') close(w)
    else if (d.do === 'min') minimise(w)
    else if (d.do === 'max') maximise(w)
  })
  w.bar.addEventListener('dblclick', (e) => { if (!e.target.closest('button, a, input')) maximise(w) })
  // a press anywhere on a window brings it forward at once; the stack re-forms when the press is over, so what was
  // pressed does not move away under the pointer
  w.el.addEventListener('pointerdown', () => {
    if (top() === w) return
    front(w, true)
    addEventListener('pointerup', () => setTimeout(() => layout(true), 0), { once: true })
  }, true)
  w.bar.addEventListener('pointerdown', (e) => {
    if (w.max || e.button || e.target.closest('button, a, input')) return
    const p0 = laptop.toLocal(e.clientX, e.clientY), x0 = p0[0] - w.el.offsetLeft, y0 = p0[1] - w.el.offsetTop, sx = e.clientX, sy = e.clientY      // the desktop's own pixels: on the laptop it is drawn in perspective
    const keep = (v, lo, hi) => Math.min(Math.max(hi, lo), Math.max(lo, v))
    // the window buttons are at the right end of the title bar: they never leave the desktop
    const move = (m) => {
      if (!w.free && Math.hypot(m.clientX - sx, m.clientY - sy) < 4) return      // a click, not a drag
      w.free = true; w.el.classList.add('dragging')
      const p = laptop.toLocal(m.clientX, m.clientY)
      w.x = keep(p[0] - x0, 140 - w.el.offsetWidth, layer.clientWidth - w.el.offsetWidth); w.y = keep(p[1] - y0, 0, layer.clientHeight - BAR)
      w.el.style.left = w.x + 'px'; w.el.style.top = w.y + 'px'
    }
    w.bar.setPointerCapture(e.pointerId)
    w.bar.addEventListener('pointermove', move)
    w.bar.addEventListener('pointerup', () => { w.bar.removeEventListener('pointermove', move); w.el.classList.remove('dragging') }, { once: true })
  })
}

addEventListener('resize', () => { if (mode === 'desk' && !isPhone() && !root.hidden) { if (onlap) laptop.remeasure(); layout() } })
// the live room went away under it (reduced motion switched on, the graphics context lost): back to full screen
// the live room came up: a desktop built ahead for full screen is built again for the laptop while nobody sees it, so
// the flight in never pays for it
laptop.onReady(() => { if (mode && away() && onlap !== (mode === 'desk' && laptop.can())) build() })
laptop.onLost(() => { if (!mode) return; const last = (top() || {}).id; build(); if (!away()) show(last || 'start') })
phoneMQ.addEventListener('change', () => {
  if (!mode || away()) { if (onlap) { laptop.unglue(); doze(false); root.hidden = true } mode = null; return }
  const last = mode === 'desk' ? (top() || {}).id : shown && shown.el.dataset.app
  build(); show(last || 'portfolio')
})

// Motion switched off or on (the tray's Reduce motion, or the system's setting): the moving wallpaper stops and the
// plain picture under it stays; switched back on, it starts again. Losing its graphics context is how bloom.js stops.
addEventListener('motionchange', () => {
  for (const w of root.querySelectorAll('.wall.real')) {
    const cv = w.querySelector('canvas')
    if (reduced()) { if (cv) cv.getContext('webgl')?.getExtension('WEBGL_lose_context')?.loseContext() }
    else if (!cv) mountBloom(w)
  }
})
