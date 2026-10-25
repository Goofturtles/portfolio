// Start-up, and every change of place. One stage, no page scroll:
//   room  --chip-->  [chips lift, camera pushes in]  tunnel  [the place settles in]  -->  mini desktop | pages
// The address keeps the place (#projects, #ai-arjun, #pages-how ...), so Back works and a place can be linked to.
import { reduced, wait, retry } from './config.js'
import { media, loadManifest, themes, themeInfo, thumbOf, retryFailedMedia } from './media.js'
import { apps } from './apps.js'
import { line, pix } from './icons.js'
import * as room from './room.js'
import * as tunnel from './tunnel.js'

// kit.js draws a film view into #stage when the page finishes parsing; apps.js loads it after that has happened
const parsed = document.readyState === 'complete' ? Promise.resolve() : new Promise((r) => document.addEventListener('DOMContentLoaded', r, { once: true }))

const app = document.getElementById('app'), hud = app.querySelector('.hud'), tagEl = app.querySelector(':scope > .wip-tag'), picker = document.getElementById('themes'), toastEl = app.querySelector('.toast')
// address -> [place, what to show there]
const ROUTES = {
  home: ['room'], desktop: ['desktop', 'start'], portfolio: ['desktop', 'portfolio'], projects: ['desktop', 'projects'], films: ['desktop', 'films'],      // YouTube is not a place: its icon is a link to his channel
  'how-i-work': ['desktop', 'how'], results: ['desktop', 'results'], about: ['desktop', 'about'], contact: ['desktop', 'contact'], 'ai-arjun': ['desktop', 'ai'],
  'pages-how': ['pages', 'how'], 'pages-results': ['pages', 'results'],
}
// a chip in the room -> where it goes ("Projects" lands on the portfolio document; "How I work" and "Results" are the sheets)
const CHIP = { projects: 'portfolio', app: 'portfolio', ai: 'ai-arjun', how: 'pages-how', results: 'pages-results', about: 'about', contact: 'contact' }
// an app, from the taskbar or a link inside a place -> its address
const APP = { portfolio: 'portfolio', projects: 'projects', films: 'films', how: 'how-i-work', results: 'results', about: 'about', contact: 'contact', ai: 'ai-arjun' }
const TITLE = { room: 'Arjun Sharma', desktop: 'Portfolio', pages: 'Pages' }

let place = 'room', busy = false, sound = false, pending = null
// desktop.js and pages.js (and what they import) are fetched the first time they are needed
const loading = { room: Promise.resolve(room) }, loaded = { room }
const load = (name) => (loading[name] ||= retry((i) => import(`./${name}.js${i > 1 ? '?try=' + i : ''}`)).then((m) => { m.init(act, setTitle); loaded[name] = m; return m }))

function setTitle(text) { hud.querySelector('.title b').textContent = text || TITLE[place] }
function showTag() {
  const text = place === 'room' ? room.tag() : ''             // only a real render that is not final is tagged; nothing drawn by the site is
  tagEl.textContent = text; tagEl.hidden = !text
}
function toast(text) {
  toastEl.textContent = text; toastEl.classList.add('on')
  clearTimeout(toast.t); toast.t = setTimeout(() => toastEl.classList.remove('on'), 2800)
}

// everything that can be asked for by name: a taskbar icon, a link on a sheet, a project in the document
function act(id, arg) {
  if (id === 'themes') return togglePicker()
  if (id === 'sound') { sound = !sound; return toast(sound ? 'Sound is on. There is no soundtrack yet.' : 'Sound is off.') }
  if (id === 'home') return go('home')
  if (id === 'toast') return toast(arg)
  if (id === 'pages') return go(arg === 'results' ? 'pages-results' : 'pages-how')
  if (APP[id]) return go(APP[id], { arg })
}

async function go(route, { arg, spot, push = true } = {}) {
  if (!ROUTES[route]) route = 'home'
  const [next, what] = ROUTES[route]
  if (busy) { if (!push) pending = route; return }           // a tap during a flight is dropped; Back or Forward during one is followed when it lands
  if (push && (location.hash.slice(1) || 'home') !== route) history.pushState(null, '', route === 'home' ? location.pathname + location.search : '#' + route)
  if (next === place) { if (next !== 'room') (await load(next)).show(what, arg); return }
  busy = true
  showPicker(false)
  try {
    const from = await load(place)
    tagEl.hidden = true
    if (next === 'room') {                                     // the camera pulls back out of the laptop while the place fades away over it
      const gone = from.leave()
      place = next; app.dataset.place = next
      hud.querySelector('.back').hidden = true
      setTitle('')
      await Promise.all([gone, room.enter(true)])
    } else {
      const ready = load(next).then((m) => m.prepare())
      const left = from.leave(spot, next)                      // the room: the zoom into the laptop (js/room.js); it resolves when the cross-fade may start
      await tunnel.play(Promise.all([place === 'room' ? left : null, ready]))      // the clip of the flight, once it exists; until then only the wait
      place = next; app.dataset.place = next
      hud.querySelector('.back').hidden = false
      setTitle('')
      await (await load(next)).enter(what, arg)
    }
    showTag()
    if (!app.contains(document.activeElement) || document.activeElement.closest('[hidden]')) document.getElementById(next).focus({ preventScroll: true })   // the keyboard follows to the new place
  } finally { busy = false }
  if (pending) { const to = pending; pending = null; if ((location.hash.slice(1) || 'home') === to) go(to, { push: false }) }      // the address moved while this flight was in the air
}

// ---- themes ------------------------------------------------------------------------------------------
function buildPicker() {
  picker.innerHTML = `<div class="pk-h"><b>Themes</b><button type="button" class="pk-x" aria-label="Close themes">${line('close', 16)}</button></div>` +
    `<div class="pk-list">${themes().map((t, i) => `<button type="button" data-theme="${t.id}" style="--i:${i}"><i class="sw" data-src="${thumbOf(t.id)}"></i><span>${t.name}</span></button>`).join('')}</div>`
  picker.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return
    if (b.dataset.theme) setTheme(b.dataset.theme); else showPicker(false)
  })
  markTheme()
}
function markTheme() {
  app.dataset.theme = media.theme; app.dataset.ui = themeInfo().ui
  for (const b of picker.querySelectorAll('[data-theme]')) if (b.tagName === 'BUTTON') b.setAttribute('aria-pressed', b.dataset.theme === media.theme)
}
// the flyout, and the mark on what opened it (the taskbar's Themes button is drawn filled while it is open: shell.css)
function showPicker(on) {
  picker.hidden = !on; app.toggleAttribute('data-picker', on)
  if (on) for (const s of picker.querySelectorAll('.sw[data-src]')) { s.style.backgroundImage = 'url("' + s.dataset.src + '")'; s.removeAttribute('data-src') }      // each swatch is its room's own picture, fetched when the picker first opens
}
function togglePicker() {
  showPicker(picker.hidden)
  if (!picker.hidden) picker.querySelector('[aria-pressed="true"]').focus({ preventScroll: true })
}
function nextTheme() {
  const list = themes().map((t) => t.id)
  return setTheme(list[(list.indexOf(media.theme) + 1) % list.length])
}
async function setTheme(id) {
  if (id === media.theme) return
  media.theme = id
  try { localStorage.setItem('pc-theme', id) } catch (e) { /* private mode: the theme lasts for this visit */ }
  markTheme()
  for (const name of ['desktop', 'pages']) if (loaded[name]) loaded[name].setTheme()
  await room.relight(id)                                     // the room plays the re-light (also behind another place, so it is right on return)
  showTag()
}

// ---- start -------------------------------------------------------------------------------------------
async function start() {
  retryFailedMedia()
  await Promise.all([loadManifest(), parsed.then(() => apps.kit())])
  // the buttons over every place: a line icon and their name; the name plate carries his mark
  hud.querySelector('.back').insertAdjacentHTML('afterbegin', line('back', 16))
  hud.querySelector('.title').insertAdjacentHTML('afterbegin', pix('app', 20))
  hud.querySelector('.plain').insertAdjacentHTML('afterbegin', line('list', 16))
  // the lamp itself is the light switch (film/SPEC.md "The room is real-time 3D", item 2); the taskbar's Themes opens the picker
  room.init((id, from) => (id === 'themes' ? (from === 'object' ? nextTheme() : togglePicker()) : id === 'projects' && from === 'object' ? go('desktop', { spot: id }) : CHIP[id] ? go(CHIP[id], { spot: id }) : act(id)))      // the laptop itself opens its desktop on its start screen
  addEventListener('room3d', showTag)
  buildPicker()
  await room.start()
  tunnel.warm()
  showTag()
  const route = location.hash.slice(1)
  const arrived = room.enter()
  if (ROUTES[route] && route !== 'home') { await arrived; go(route, { push: false }) }
  hud.querySelector('.back').addEventListener('click', () => go('home'))
  addEventListener('popstate', () => go(location.hash.slice(1) || 'home', { push: false }))
  // a press anywhere outside the theme picker closes it (not on what opens it: that press toggles it)
  addEventListener('pointerdown', (e) => { if (!picker.hidden && !e.target.closest('#themes, [data-id="themes"], [data-ico="themes"]')) showPicker(false) }, true)
  addEventListener('keydown', (e) => { if (e.key !== 'Escape' || busy) return; if (!picker.hidden) showPicker(false); else if (place !== 'room' && !e.target.closest('input, textarea')) go('home') })
  // warm the mini desktop while the visitor looks at the room, so the first flight has nothing to wait for
  setTimeout(() => load('desktop').then((m) => m.prepare()).catch(() => {}), 1500)
}
start().catch((e) => { console.error(e); toast('This page could not load. Please reload.') })
