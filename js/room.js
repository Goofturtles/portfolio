// The room (home): the desk shot held on a frame. THE OBJECTS ARE THE BUTTONS (film/SPEC.md "The room has no
// bubbles"): at rest the room is the picture and nothing else. An object lights when it is pointed at, a Fluent
// tooltip with its name follows the pointer, and a click flies in. The taskbar along the bottom (js/shell.js, the same
// one the mini desktop has) is the whole way in for touch, keyboards and screen readers; pointing at one of its icons
// lights the matching object, and when the room first settles the light sweeps once across the objects.
// Where an object is comes from media/manifest.json (hotspots, per lighting state and orientation). They are boxes
// until the rendered mask exists; the light is the picture's own pixels made brighter until the rendered hover
// passes exist (a theme may then carry hover: { id: { src, box } }, and that picture is added instead).
// Changing theme dissolves plate to plate over 1.2 s; the shot's own clip is scrubbed only when it is as sharp as the
// screen (2560 wide on a computer). The picture is NEVER stretched past its real size (MAX_UP).
// THE ROOM IS LIVE 3D WHEREVER IT CAN BE (film/SPEC.md "The room is real-time 3D"): js/room3d/stage.js is fetched and
// mounted over the still, and from then on the still, its boxes and everything above about pictures is only the
// fallback: no WebGL 2, reduced motion (the system's setting or the tray's switch, live), or a visitor saving data.
// The name tip, the taskbar and the way places are entered and left are the same in both.
import { CONFIG, reduced, wait, el } from './config.js'
import { media, pick, place, small, themeInfo, loadPicture, clipURL, loopClip } from './media.js'
import { taskbar } from './shell.js'
import * as laptop from './laptop.js'

// The laptop and the mini desktop (film/SPEC.md "The room is real-time 3D", item 6). On a computer the desktop is ON
// the laptop (js/laptop.js): the camera flies in until the screen fills most of the view and stays, the room still
// round it, and the desktop is drawn onto the glass. On a phone the camera dives until the screen fills the view and
// the full-screen desktop takes over on the same picture. The film's tunnel (js/tunnel3d/) is no longer flown here.

// [id, name, what a click does] : the seven objects (laptop, ring, paper, flowers, chair, glass, lamp)
const PLACES = [['projects', 'Laptop', 'Click to open his desktop'], ['ai', 'AI Arjun', 'Click to ask anything about him'], ['how', 'How I work', 'Click to read his five steps'],
  ['results', 'Results', 'Click to see his results'], ['about', 'About', 'Click to read who he is'], ['contact', 'Contact', 'Click to write to him'], ['themes', 'Lamp', 'Click to change the light']]
const LIGHTS = { app: 'projects' }                // a taskbar slot -> the object it lights, where the names differ
const MAX_UP = 1.2                   // a picture may be shown this much larger than it is before it goes into the frame instead
const OVER = 14                      // a covering picture reaches this far past the stage, so following the pointer never shows an edge
const STD = 'cubic-bezier(.8, 0, .2, 1)'
const root = document.getElementById('room'), frame = root.querySelector('.frame'), spotsEl = root.querySelector('.spots'), tip = root.querySelector('.rtip')
const layers = [...root.querySelectorAll('.poster')], video = root.querySelector('video')
const phoneMQ = matchMedia(CONFIG.phone)
let front = 0, shown = null, idle = null          // shown = { theme, m, nat } : what is on screen; idle = the loop behind it, if the manifest has one
let bar = null, onPick = () => {}, flight = 0, swept = false
let r3d = null, r3dJob = null, leftBy = null, hot3d = null, tipTimer = 0      // the live room (js/room3d/stage.js), once it is up

const bootDone = () => { if (window.__boot) window.__boot.done() }      // ends the loader in index.html (it also ends itself after 15 s)
const spot = (id) => spotsEl.querySelector(`[data-id="${id}"]`)
function light(id, on) {
  const s = spot(LIGHTS[id] || id), a = bar && bar.el.querySelector(`.tk[data-ico="${id}"]`)
  if (s) s.classList.toggle('lit', on)
  if (a) a.classList.toggle('hot', on)
  if (r3d) r3d.light(LIGHTS[id] || id, on)
}

// ---- the live room --------------------------------------------------------------------------------------
const saving = () => !!(navigator.connection && navigator.connection.saveData)
const want3d = () => !reduced() && !saving()
const mark = (id, on) => { const a = bar && id && bar.el.querySelector(`.tk[data-ico="${id}"]`); if (a) a.classList.toggle('hot', on) }
// the real object under the pointer changed: its taskbar icon answers, and after a short pause its name follows the pointer
function hover3d(id) {
  clearTimeout(tipTimer); hideTip()
  mark(hot3d, false)
  hot3d = id && PLACES.some((p) => p[0] === id) ? id : null
  if (!hot3d) return
  mark(hot3d, true)
  tipTimer = setTimeout(() => { if (hot3d && r3d && r3d.live) showTip(hot3d, above3d(hot3d)) }, 350)
}
async function go3d() {
  if (r3d || r3dJob || !want3d()) return
  r3dJob = import('./room3d/stage.js').then((stage) => (stage.supported() ? stage.mount(root, { theme: media.theme, onHover: hover3d, onPick: (opens) => { hideTip(); onPick(opens, 'object') }, onLost: drop3d }) : null))
    .catch((e) => { console.warn('The live room could not start, so the still stays.', e); return null })
  const api = await r3dJob
  r3dJob = null
  if (!api) { bootDone(); if (!root.hidden && root.classList.contains('in')) sweep(); return }      // no live room after all: the still's own sweep
  if (!want3d()) { bootDone(); return api.destroy() }
  r3d = api
  laptop.attach(api)
  if (api.contract.themes[media.theme]) api.setTheme(media.theme)      // the theme may have changed while the scene was loading
  root.classList.add('live3d')
  bootDone()                                                     // the loader (index.html) gives way to the room, whose first frame is drawn
  const here = !root.hidden && root.classList.contains('in')
  if (here) { api.live = true; if (!swept) { swept = true; api.sweep() } } else if (root.hidden) api.stop()
  dispatchEvent(new CustomEvent('room3d'))                       // main.js shows the room's tag again (a stand-in scene says so)
}
function drop3d() {
  if (!r3d) return
  const api = r3d
  r3d = null; leftBy = null
  laptop.attach(null)                                           // a desktop that was on the laptop goes back to full screen
  if (document.getElementById('app').dataset.place !== 'room') root.hidden = true      // and covers the room again
  hover3d(null)
  root.classList.remove('live3d', 'point', 'grab')
  api.destroy()
  paint(media.theme)
}
addEventListener('motionchange', () => (reduced() ? drop3d() : go3d()))
// the room goes away under the place that covers it: only once that place is really up (main.js sets data-place)
function hideWhenCovered(my) {
  if (my !== flight) return
  if (document.getElementById('app').dataset.place === 'room') return setTimeout(() => hideWhenCovered(my), 80)
  setTimeout(() => { if (my !== flight) return; root.hidden = true; if (r3d) r3d.stop() }, 460)
}
// The name tip: small, still, just above the object it names (never chasing the pointer). `top` is the point it
// stands on: the top middle of the object as the camera sees it.
function showTip(id, top) {
  const p = PLACES.find((x) => x[0] === id)
  if (!p || !top) return
  tip.innerHTML = `<b>${p[1]}</b><i>${p[2]}</i>`
  tip.hidden = false
  const w = root.clientWidth, h = root.clientHeight, tw = tip.offsetWidth, th = tip.offsetHeight
  const x = Math.max(8, Math.min(w - tw - 8, top[0] - tw / 2)), y = Math.max(8, Math.min(h - 56 - th, top[1] - th - 10))
  tip.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`
  requestAnimationFrame(() => tip.classList.add('on'))
}
function hideTip() { tip.classList.remove('on'); tip.hidden = true }
// the top middle of a live object on the page (its bounding box, as the camera sees it)
const above3d = (id) => (r3d ? r3d.top(id) : null)
const aboveSpot = (b) => { const r = b.getBoundingClientRect(), o = root.getBoundingClientRect(); return [r.left + r.width / 2 - o.left, r.top - o.top] }

function buildBar() {
  if (bar) { bar.stop(); bar.el.remove() }
  const phone = phoneMQ.matches
  root.classList.toggle('phone', phone); root.classList.toggle('desk', !phone)
  bar = taskbar(root, themeInfo(r3d || !shown ? media.theme : shown.theme).ui, phone, { kind: 'room', pick: (id) => { if (root.classList.contains('in')) onPick(id, 'bar') } })
  for (const [type, on] of [['pointerover', true], ['pointerout', false], ['focusin', true], ['focusout', false]]) bar.el.addEventListener(type, (e) => { const a = e.target.closest('[data-ico]'); if (a) light(a.dataset.ico, on) })
}

export function init(pickFn) {
  onPick = pickFn
  spotsEl.innerHTML = PLACES.map(([id]) => `<button type="button" class="spot" data-id="${id}" tabindex="-1"><i></i></button>`).join('')
  buildBar()
  phoneMQ.addEventListener('change', buildBar)
  spotsEl.addEventListener('click', (e) => { const b = e.target.closest('.spot'); if (!b || !root.classList.contains('in')) return; hideTip(); light(b.dataset.id, true); onPick(b.dataset.id, 'object') })
  // an object under the pointer lights, and after a short pause its name follows the pointer
  let timer = 0
  spotsEl.addEventListener('pointerover', (e) => { const b = e.target.closest('.spot'); if (!b || e.pointerType === 'touch') return; light(b.dataset.id, true); clearTimeout(timer); timer = setTimeout(() => showTip(b.dataset.id, aboveSpot(b)), 350) })
  spotsEl.addEventListener('pointerout', (e) => { const b = e.target.closest('.spot'); if (!b) return; light(b.dataset.id, false); clearTimeout(timer); hideTip() })
  // the picture follows the pointer a little (a mouse only; a touch screen drifts instead, css/shell.css)
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches
  let next = null
  const set = (x, y) => { next = [x, y]; requestAnimationFrame(() => { if (!next) return; root.style.setProperty('--px', next[0].toFixed(3)); root.style.setProperty('--py', next[1].toFixed(3)); next = null }) }
  root.addEventListener('pointermove', (e) => { if (fine && !reduced()) set(e.clientX / root.clientWidth * 2 - 1, e.clientY / root.clientHeight * 2 - 1) })
  // on the laptop the room leans a little after the pointer (rig.js keeps it to a fifth of the room's lean), and
  // holds still while a button is down, so what is being dragged on the desktop does not move under the hand
  addEventListener('pointermove', (e) => { if (leftBy === 'dock' && r3d && fine && !e.buttons) r3d.lean(e.clientX / innerWidth * 2 - 1, e.clientY / innerHeight * 2 - 1) }, { passive: true })
  root.addEventListener('pointerleave', () => { hideTip(); set(0, 0) })
  addEventListener('resize', () => { if (shown && pick('room', shown.theme).poster !== shown.m.poster) paint(shown.theme); else layout() })
}

// put a theme's picture on the back layer and bring it up over the other one: only the light differs, so the
// dissolve reads as the light changing. The picture is fully decoded before it starts (js/media.js loadPicture).
async function paint(theme) {
  const m = pick('room', theme), next = layers[1 - front], old = layers[front]
  next.dataset.theme = theme
  next.innerHTML = ''
  let nat = null
  const got = m.picture && await loadPicture(m.picture).catch(() => null)
  if (got) {
    const ext = el('div', 'ext'), pic = el('div', 'pic')
    ext.style.backgroundImage = `url("${got.im.currentSrc || got.im.src}")`
    pic.appendChild(got.el)
    next.append(ext, pic)
    nat = [got.im.naturalWidth, got.im.naturalHeight]
  }
  next.classList.add('on', 'top'); old.classList.remove('top')
  setTimeout(() => { if (!next.classList.contains('top')) return; old.classList.remove('on') }, 1300)
  front = 1 - front
  shown = { theme, m, nat }
  layout()
  rest(m)
}
export const tag = () => (r3d ? r3d.tag() : shown ? shown.m.tag : '')

// The place rests on a loop when the manifest has one for this lighting state (film/SPEC.md "Never static"): the
// clip plays over its own first frame, which is the still.
function rest(m) {
  if (idle) { idle.stop(); idle.video.remove(); idle = null }
  if (!m.loop || reduced()) return
  const v = frame.appendChild(el('video', 'idle'))            // after the re-light's video, which stays the first in the frame
  v.hidden = true; v.setAttribute('aria-hidden', 'true')
  idle = { video: v, stop: loopClip(v, m.loop.src) }
  layout()
}

// where the picture sits on a stage of w x h, and where a point of the frame (fractions) lands
function sit(nat, m, w, h) {
  if (!nat) return { framed: false, x: 0, y: 0, w, h, pos: '', at: (fx, fy) => place(fx, fy, w, h) }
  const [nw, nh] = nat, framed = Math.max(w / nw, h / nh) > MAX_UP
  const rw = framed ? Math.min(w, nw) : w + 2 * OVER, rh = framed ? Math.min(h, nh) : h + 2 * OVER
  const s = Math.max(rw / nw, rh / nh), spare = nw * s - rw
  const ax = m.aim == null || spare < 1 ? 0.5 : Math.min(1, Math.max(0, (m.aim * nw * s - rw / 2) / spare))
  const x = (w - rw) / 2, y = (h - rh) / 2, ox = -spare * ax, oy = (rh - nh * s) / 2
  // a tall screen with no picture of its own reads the manifest's 9:16 hotspots, which are fractions of the stage
  const at = m.aim == null ? (fx, fy) => [x + ox + fx * nw * s, y + oy + fy * nh * s] : (fx, fy) => place(fx, fy, w, h)
  return { framed, x, y, w: rw, h: rh, pos: `${(ax * 100).toFixed(1)}% 50%`, at }
}

function layout() {
  if (!shown) return
  const w = root.clientWidth, h = root.clientHeight, m = pick('room', shown.theme), S = sit(shown.nat, m, w, h)
  const box = `left:${S.x}px;top:${S.y}px;width:${S.w}px;height:${S.h}px;object-position:${S.pos || '50% 50%'}`
  const layer = layers[front], pic = layer.querySelector('.pic')
  layer.classList.toggle('framed', S.framed); frame.classList.toggle('framed', S.framed)
  if (pic) { pic.style.cssText = `left:${S.x}px;top:${S.y}px;width:${S.w}px;height:${S.h}px`; pic.querySelector('img').style.objectPosition = S.pos }
  for (const v of frame.querySelectorAll('video')) v.style.cssText = box
  // an object is a button only where the picture has it (a prop test has no lamp, glass or chair)
  const objects = m.status !== 'prop' && m.status !== 'none', pass = m.hover || {}
  for (const b of spotsEl.children) {
    const s = m.hotspots[b.dataset.id], lit = b.firstElementChild
    b.hidden = !s || !s.box || !objects
    if (b.hidden) continue
    const [x0, y0] = S.at(s.box[0], s.box[1]), [x1, y1] = S.at(s.box[2], s.box[3])
    b.style.cssText = `left:${x0}px;top:${y0}px;width:${x1 - x0}px;height:${y1 - y0}px;z-index:${Math.max(1, 100 - Math.round((x1 - x0) * (y1 - y0) / 4000))}`      // where two objects overlap, the smaller one is on top
    const p = pass[b.dataset.id]                             // the rendered hover pass, once the lead delivers it: added over the picture, in its own box
    lit.classList.toggle('pass', !!p)
    if (p) { const [a0, b0] = S.at(p.box[0], p.box[1]), [a1, b1] = S.at(p.box[2], p.box[3]); lit.style.cssText = `left:${a0 - x0}px;top:${b0 - y0}px;width:${a1 - a0}px;height:${b1 - b0}px;background-image:url("${p.src}")` } else lit.style.cssText = ''
  }
}

// when the room first settles, the light sweeps once across the objects, left to right, so nobody misses them
function sweep() {
  if (swept || reduced()) return
  swept = true
  const live = [...spotsEl.children].filter((b) => !b.hidden).sort((a, b) => a.offsetLeft - b.offsetLeft)
  live.forEach((b, i) => setTimeout(() => { b.classList.add('lit'); setTimeout(() => { if (!b.matches(':hover')) b.classList.remove('lit') }, 560) }, 200 + i * 120))
}

export async function start() {
  await paint(media.theme)
  if (want3d()) go3d()                                       // the live scene loads behind the loader and the still, and takes over when its first frame is drawn
  else { bootDone(); if (shown.m.clip) clipURL(shown.m.clip).catch(() => {}) }    // the still is the room here: the loader gives way to it; the clip is fetched behind it, ready for the first re-light
}

// the transform that puts an object's box over the whole stage (the camera, inside the laptop), or null
function zoomTo(id, fill) {
  if (!shown) return null
  const w = root.clientWidth, h = root.clientHeight, s = shown.m.hotspots[id]
  if (!s || !s.box) return null
  const S = sit(shown.nat, shown.m, w, h), [x0, y0] = S.at(s.box[0], s.box[1]), [x1, y1] = S.at(s.box[2], s.box[3])
  const k = Math.min(w / (x1 - x0), h / (y1 - y0)) * (fill ? 1 : 0.6)
  return `translate(${(w / 2 - (x0 + x1) / 2 * k).toFixed(1)}px, ${(h / 2 - (y0 + y1) / 2 * k).toFixed(1)}px) scale(${k.toFixed(3)})`
}

// back = coming out of another place: the camera pulls back out of the laptop. Otherwise the first, gentle settle.
export async function enter(back) {
  flight++
  root.hidden = false
  layout()
  root.classList.remove('out')
  void root.offsetWidth
  root.classList.add('in')
  if (r3d) {                                                   // the real camera comes back out of the laptop's screen, or back from the object it went toward
    const my = flight, how = leftBy
    leftBy = null
    if (back) await (how === 'approach' ? r3d.retreat() : how === 'dock' ? r3d.undock() : r3d.rise()); else { r3d.reset(); r3d.start() }
    if (my !== flight) return
    r3d.live = true
    if (!swept) { swept = true; r3d.sweep() }
    return
  }
  if (!reduced()) {
    root.classList.add('arrive')
    frame.style.transformOrigin = '0 0'
    const w = root.clientWidth, h = root.clientHeight
    const from = (back && zoomTo('projects', true)) || `translate(${(-0.03 * w).toFixed(1)}px, ${(-0.03 * h).toFixed(1)}px) scale(1.06)`
    await frame.animate([{ transform: from, opacity: 0 }, { opacity: 1, offset: 0.4 }, { transform: 'none', opacity: 1 }], { duration: back ? 520 : 700, easing: back ? STD : 'cubic-bezier(.1, .9, .2, 1)' }).finished.catch(() => {})
    root.classList.remove('arrive')
  }
  if (!r3dJob) sweep()                                         // while the live room is loading the light waits for it: the real objects are swept, not the boxes of the still
}
// The change of place while there is no render of the flight: the picture is scaled into the laptop's box (the mini
// desktop IS the laptop's screen) over half a second and the place cross-fades in over its end. For the pages, the
// camera goes toward the object that was picked. Resolves when the cross-fade may start; hides itself when it is over.
export async function leave(id, next) {
  hideTip()
  const my = ++flight
  if (r3d) {
    // The desktop IS the laptop's screen. On a computer the camera flies in until the screen fills most of the view
    // and stays: the desktop appears on the glass as the camera lands (js/laptop.js) and the room stays round it.
    // On a phone it dives until the screen fills the view and the full-screen desktop takes over on the same picture.
    // A place that opens over the room (the pages) gets a push toward its object.
    root.classList.remove('in')
    if (next === 'desktop' && laptop.can()) {
      leftBy = 'dock'
      const dock = r3d.dock(laptop.fill(root.clientWidth / root.clientHeight, ...r3d.glassSize()))
      window.__landing = dock.then(() => wait(60))             // js/desktop.js opens a window only once the camera has landed
      await wait(120)                                           // the screen wakes as the camera sets off, while it is still small on the page
      return
    }
    leftBy = next === 'desktop' ? 'dive' : 'approach'
    if (next === 'desktop') await r3d.dive()
    else await Promise.race([r3d.approach(id), wait(400)])
    hideWhenCovered(my)
    return
  }
  if (reduced()) { root.hidden = true; root.classList.remove('in', 'out'); return }
  frame.style.transformOrigin = '0 0'
  frame.style.setProperty('--zoom', (next === 'desktop' ? zoomTo('projects', true) : zoomTo(id, false)) || zoomTo('projects', true) || 'scale(1.6)')
  root.classList.remove('in'); root.classList.add('out')
  setTimeout(() => { if (my !== flight) return; root.hidden = true; root.classList.remove('out'); for (const b of spotsEl.children) b.classList.remove('lit') }, 560)
  await wait(300)
}

// ---- the re-light --------------------------------------------------------------------------------------
const once = (target, type, ms) => new Promise((r) => { target.addEventListener(type, r, { once: true }); setTimeout(r, ms) })
async function scrub(from, to, src) {
  const url = await Promise.race([clipURL(src), wait(3000)]).catch(() => null)
  if (!url) return                                           // the clip did not arrive: the dissolve below still happens
  if (video.getAttribute('src') !== url) { video.src = url; await once(video, 'loadeddata', 3000) }
  if (video.readyState < 2) return
  video.pause(); video.currentTime = from
  await once(video, 'seeked', 800)
  video.hidden = false
  if (to > from) {                                           // forwards: the clip simply plays to the hold
    await video.play().catch(() => {})
    await new Promise((done) => (function watch() { video.currentTime >= to || video.ended || video.paused ? done() : requestAnimationFrame(watch) })())
    video.pause()
  } else {                                                   // backwards: no browser plays in reverse, so step it
    const t0 = performance.now(), ms = Math.min(2200, (from - to) * 1000)
    await new Promise((done) => (function step(now) { const k = Math.min(1, (now - t0) / ms); video.currentTime = from + (to - from) * k; k < 1 ? requestAnimationFrame(step) : done() })(t0))
  }
  video.currentTime = to
}
export async function relight(theme) {
  if (r3d) {                                                   // live: the baked light blends while the camera travels the film's path to this theme's home
    hideTip()
    if (bar) { bar.el.classList.remove('light', 'dark'); bar.el.classList.add(themeInfo(theme).ui) }
    return r3d.setTheme(theme)
  }
  const to = pick('room', theme), was = shown, info = to.clipInfo
  // The film's own re-light is played only from a clip as sharp as the screen (film/SPEC.md: 2560 wide on a computer,
  // 1080 on the short side on a phone); a smaller one is never blown up, and the plates dissolve instead.
  const sharp = !!info && (small() ? Math.min(info.w || 0, info.h || 0) >= 1080 : (info.w || 0) >= 2560)
  // Backwards is stepped frame by frame, which only stays smooth in a clip with a key frame every few frames.
  const steppable = !info || !info.keyint || info.keyint <= 12 || (was && to.hold > was.m.hold)
  const clip = sharp && !reduced() && !root.hidden && was && to.clip && to.clip === was.m.clip && steppable
  if (clip) await scrub(was.m.hold, to.hold, to.clip)
  frame.classList.toggle('cut', !!clip)                      // after the clip the still is simply there: nothing to fade
  await paint(theme)
  if (bar) { bar.el.classList.remove('light', 'dark'); bar.el.classList.add(themeInfo(theme).ui) }
  if (clip) { await wait(120); video.hidden = true; frame.classList.remove('cut') }
}
