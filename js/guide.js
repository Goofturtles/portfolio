// The guide (Arjun, 2026-11-01: "add an animated guy [to] guide you through ... when one person has done it make it so
// that the same device never has to do it again unless they click tutorial", "make sure it syncs"). A cartoon of Arjun
// walks the visitor round his room once: the lamp, his résumé on the wall, the laptop, AI Arjun's ring and the rest of
// the desk, in his own voice (ElevenLabs, media/guide/), each line in a bubble as it is spoken, his mouth moving with
// the voice and each thing lighting up as he names it.
//   once    finished or skipped on a device, it is never offered there again (localStorage 'pc-tour'); the Tutorial pill in
//           the room's corner, and Tutorial in the taskbar's tray, play it again. The first time the mini desktop opens he
//           says one more line there ('pc-tour-desk').
//   sync    the voice is Web Audio, decoded when the tour starts (from a press, so the browser lets it play), and each
//           line's text, his mouth and the things he names all read the audio's own clock, so they cannot drift apart.
//           media/guide/guide.json holds, per line, its text, where its pauses fall (chunks: [first char, end char, from s,
//           to s], measured from the recording) and its loudness every 20 ms (env, 0..9). Muted, the same timeline runs
//           silently, so the words and the mouth still keep time.
//   motion  he walks from thing to thing (with reduced motion he is simply there); his bubble stands over his head, or,
//           on a phone, along the foot of the screen.
import { CONFIG, reduced, el, voice, setVoice, store, wait } from './config.js'
import { line } from './icons.js'
import { createArjun } from './guide/arjun.js'
import * as room from './room.js'

const DONE = 'pc-tour', DESK = 'pc-tour-desk'
// where he stands for each line: an object of the room (its id), 'start' (left of the laptop) or 'pill' (by the Tutorial
// button); live: only where the live room is (the résumé hangs only there); marks: words that light a thing as they are said
// (each line's words are also in media/guide/guide.json, with its timing; these are what shows if that file cannot load)
const STEPS = [
  { clip: 'hello', at: 'start', pose: 'wave', text: "Hey, I'm Arjun! Welcome to my room. Everything on this desk is a button. Let me show you." },
  { clip: 'lamp', at: 'themes', text: 'This lamp changes the light in the room. Give it a try!' },
  { clip: 'resume', at: 'resume', live: true, text: 'My résumé hangs right here on the wall.' },
  { clip: 'laptop', at: 'projects', text: 'Open my laptop to explore my projects, films, and how I build them.' },
  { clip: 'ring', at: 'ai', text: 'This ring is AI Arjun. Ask it anything about me.' },
  { clip: 'rest', at: 'ai', marks: [['card', 'how'], ['flowers', 'results'], ['glass', 'contact'], ['chair', 'about']], text: 'The card shows how I work, the flowers are my awards, the glass is for messages, and the chair is all about me.' },
  { clip: 'bye', at: 'pill', pose: 'cheer', text: "That's it! Press Tutorial in the corner anytime to see this again. Have fun!" },
]
const ASK = 'First time here? Let me show you around my room. It only takes 30 seconds.'
const DESK_TEXT = 'This is my desktop. Open any app on the taskbar, and the home button takes you back to my room.'
const app = document.getElementById('app'), roomEl = document.getElementById('room')
const phone = matchMedia(CONFIG.phone)

let layer = null, posEl = null, arjun = null, bubble = null, pill = null, data = null, dataJob = null
let ctx = null, gain = null, bufs = {}, decoding = null, ready = {}
let at = null, run = null, token = 0, offered = false, asking = false, act = () => {}
const lit = new Set()

// ---- in the room he is 3D (js/room3d/guide3d.js): a figure on the desk, among the things he shows ----------------
// Wherever the live room is up he walks, hops, points and talks there for real; the drawing (js/guide/arjun.js) is
// what he is where there is no live room (a phone on the still picture) and on the mini desktop.
let g3 = null, follow = 0
const in3d = () => !!g3 && g3 === (room.guide3d && room.guide3d()) && g3.ready && room.live() && app.dataset.place === 'room'
function want3d() {
  const a = room.guide3d && room.guide3d()
  if (a !== g3) { g3 = a || null; if (g3) { g3.onPress = () => { if (asking && !run) start(true) }; if (ctx) g3.audio(ctx, gain) } }      // the room was rebuilt (reduced motion off and on): its new figure
  return g3 ? g3.load().then(() => (g3 && g3.ready ? g3 : null)) : Promise.resolve(null)
}
// off the live room he is the 3D figure in his own canvas (js/guide/arjun3d.js, and three.js with it, fetched only then);
// the drawing (js/guide/arjun.js) stays where WebGL is missing
let soloJob = null
function solo3d() {
  return (soloJob ||= import('./guide/arjun3d.js').then((m) => m.createArjun3d()).then((a) => {
    if (a && arjun && !arjun.solo) { arjun.el.replaceWith(a.el); if (arjun.destroy) arjun.destroy(); arjun = a }
    return arjun
  }).catch(() => arjun))
}
// the bubble rides over his head while he is in the room
function track() {
  if (follow) return
  const f = () => { follow = 0; if (!in3d() || !layer || layer.hidden) return; at = g3.screen(); reflowBubble(); follow = requestAnimationFrame(f) }
  follow = requestAnimationFrame(f)
}
const stopper = (my) => () => my !== token
// where he stands for a step in the room, and the thing he shows there
function spot3(s) {
  if (s.at === 'pill') {
    const r = pill && pill.getBoundingClientRect(), o = g3 && document.querySelector('#room canvas') ? document.querySelector('#room canvas').getBoundingClientRect() : null
    return r && o ? g3.spot(null, { screen: [r.left - o.left + r.width / 2 + 40, r.top - o.top] }) : null
  }
  const id = s.at === 'start' ? 'projects' : s.at
  const p = g3.spot(id, { left: s.at === 'start' ? true : undefined })
  if (!p) return null
  const rec = room.thing && room.thing(id)
  return { ...p, aim: s.at === 'start' ? null : rec ? rec.centre : null }
}
async function go3(p, my) {
  if (reduced()) { g3.place(p.x, p.z); g3.faceCamera(); g3.show(true); return }
  if (!g3.shown) await g3.enter(p, stopper(my)); else await g3.walkTo(p, stopper(my))
}

// ---- the layer, the bubble and the pill --------------------------------------------------------------------------
function build() {
  if (layer) return
  layer = app.appendChild(el('div', 'gd'))
  layer.hidden = true
  posEl = layer.appendChild(el('div', 'gd-pos'))
  arjun = createArjun()
  posEl.appendChild(el('div', 'gd-anc')).appendChild(arjun.el)
  bubble = layer.appendChild(el('div', 'gd-bub'))
  bubble.setAttribute('role', 'dialog'); bubble.setAttribute('aria-label', 'Tour of the room')
  bubble.innerHTML = `<p class="gd-say" aria-hidden="true"><span class="on"></span><span class="off"></span></p><p class="gd-sr" aria-live="polite"></p>` +
    `<div class="gd-row"><span class="gd-n"></span><button type="button" class="gd-ic gd-mute"></button><span class="gd-sp"></span><span class="gd-btns"></span></div>` +
    `<button type="button" class="gd-ic gd-x" aria-label="Skip the tour">${line('close', 16)}</button>`
  bubble.addEventListener('click', (e) => {
    const b = e.target.closest('button')
    if (!b) return
    if (b.classList.contains('gd-mute')) return setVoice(!voice())
    if (b.classList.contains('gd-x')) return asking ? decline() : run ? finish() : closeTip()
    const go = b.dataset.go
    if (go === 'start') start(true)
    else if (go === 'no') decline()
    else if (go === 'next') step(run ? run.i + 1 : 0)
    else if (go === 'back') step(run ? Math.max(0, run.i - 1) : 0)
    else if (go === 'tip') closeTip()
  })
  bubble.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); asking ? decline() : run ? finish() : closeTip() }
    else if (run && e.key === 'ArrowRight' && !e.target.closest('input')) step(run.i + 1)
    else if (run && e.key === 'ArrowLeft' && !e.target.closest('input')) step(Math.max(0, run.i - 1))
  })
  addEventListener('voicechange', mute)
  addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || (!run && !asking) || layer.hidden || !document.getElementById('themes').hidden) return
    e.stopPropagation(); e.preventDefault(); asking ? decline() : finish()
  }, true)
  addEventListener('resize', () => { if (!layer.hidden) reflow() })
  addEventListener('room3d', () => setTimeout(settle, 60)); addEventListener('motionchange', () => setTimeout(settle, 60))      // the live room came or went under him
  document.addEventListener('visibilitychange', () => { if (ctx) document.hidden ? ctx.suspend().catch(() => {}) : ctx.resume().catch(() => {}) })
  mute()
}
function makePill() {
  if (pill || !roomEl) return
  pill = roomEl.appendChild(el('button', 'tour-pill'))
  pill.type = 'button'
  pill.setAttribute('aria-label', 'Tutorial: a tour of the room with Arjun')
  const face = pill.appendChild(el('span', 'tp-face'))
  face.appendChild(el('span', 'tp3'))      // his 3D bust (character/arjun.py renders it): still, and now and then a wave
  pill.appendChild(el('span', 'tp-t', 'Tutorial'))
  pill.addEventListener('click', () => start(true))
  // left alone a while in the room, the little Arjun in the pill waves now and then
  let still = performance.now(), waved = 0
  const moved = () => { still = performance.now() }
  addEventListener('pointermove', moved, { passive: true }); addEventListener('keydown', moved, true); addEventListener('pointerdown', moved, true)
  setInterval(() => {
    const now = performance.now()
    if (reduced() || document.hidden || pill.classList.contains('gd-busy') || !room.settled() || now - still < 25000 || now - waved < 42000) return
    waved = now
    pill.classList.add('tp-wave')
    setTimeout(() => { pill.classList.remove('tp-wave') }, 2600)
  }, 1000)
}
function mute() {
  if (gain) gain.gain.value = voice() ? 1 : 0
  if (!bubble) return
  const b = bubble.querySelector('.gd-mute'), on = voice()
  b.innerHTML = line(on ? 'soundOn' : 'mute', 16)
  b.setAttribute('aria-label', on ? 'Mute his voice' : 'Turn his voice on'); b.setAttribute('aria-pressed', String(!on))
}
const W = () => layer.clientWidth, H = () => layer.clientHeight
function size() {
  const p = phone.matches, h = Math.min(H() * 0.2, W() * (p ? 0.3 : 0.16))
  return Math.round(Math.min(p ? 118 : 172, Math.max(p ? 84 : 104, h)))
}
function place(p) {
  posEl.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px)`
  arjun.el.style.setProperty('--ga-h', p.h.toFixed(1) + 'px')
}
const aspect = () => { const r = arjun.el.getBoundingClientRect(); return r.height ? r.width / r.height : 0.62 }

// where he stands for a step, the way he faces, and what he points at
function spotFor(s) {
  const w = W(), h = size(), gw = h * aspect(), pad = 10, floor = H() - (phone.matches ? 200 : 14)
  let x, y, face = 1, aim = null
  if (s.at === 'start') {
    const a = room.anchor('projects')
    y = a ? a.foot[1] : H() * 0.75; x = a ? Math.min(w * 0.36, a.x0 - gw * 0.4) : w * 0.3      // beside the laptop, never over its screen
  } else if (s.at === 'pill') {
    const r = pill && pill.getBoundingClientRect(), o = layer.getBoundingClientRect()
    x = r ? r.right - o.left + gw * 0.5 + 18 : w * 0.2; y = r ? r.bottom - o.top : floor; face = -1
    if (r) aim = [r.left - o.left + r.width / 2, r.top - o.top + r.height / 2]
  } else {
    const a = room.anchor(s.at)
    if (!a) return null
    const right = a.cx > w / 2
    x = right ? a.x0 - gw * 0.5 - pad : a.x1 + gw * 0.5 + pad; y = a.foot[1]; face = right ? 1 : -1
    aim = [a.cx, Math.min(a.cy, a.y0 + (a.y1 - a.y0) * 0.35)]
  }
  x = Math.min(w - gw / 2 - 8, Math.max(gw / 2 + 8, x))
  y = Math.min(floor, Math.max(h + 24, y))
  return { x, y, h, face, aim }
}
// the arm's angle (degrees above level, toward the way he faces) from his shoulder to a point
function aimAt(p, to) {
  if (!to) return 0
  const sx = p.x + p.face * p.h * aspect() * 0.18, sy = p.y - p.h * 0.6
  return Math.max(-35, Math.min(80, Math.atan2(sy - to[1], Math.abs(to[0] - sx)) * 180 / Math.PI))
}

// He gets from thing to thing on foot: a few steps walked exactly (at his own stride, so the planted shoe never slides:
// js/guide/arjun.js walkSpeed), or, further than a few steps, in hops (each about his own height across, a squash as he
// pushes off and lands, a stretch in the air), so crossing the screen takes a second or two and not ten.
const anc = () => posEl.firstElementChild
function squash(sx, sy) { anc().style.transform = `translate(-50%, -100%) scale(${sx.toFixed(3)}, ${sy.toFixed(3)})` }
async function walkTo(p, my) {
  if (!at || reduced()) {
    place(p); at = p
    layer.classList.remove('gd-in'); void layer.offsetWidth; layer.classList.add('gd-in')
    return
  }
  const from = at, d = Math.hypot(p.x - from.x, p.y - from.y)
  if (d < 6) { place(p); at = p; return }
  arjun.face(p.x >= from.x ? 1 : -1); arjun.point(0)
  const stride = (arjun.stride || 0.206) * p.h, stepMs = arjun.stepMs || 500, walk = !!arjun.solo || d < stride * 4.5      // the tortoise always walks
  const n = walk ? Math.max(1, Math.round(d / stride)) : Math.max(1, Math.ceil(d / (p.h * 0.95)))
  const per = walk ? stepMs : 380, ms = n * per
  arjun.pose(walk ? 'walk' : 'idle')
  const t0 = performance.now()
  await new Promise((done) => {
    const f = (now) => {
      if (my !== token) { squash(1, 1); return done() }
      const k = Math.min(1, (now - t0) / ms)
      let x = from.x + (p.x - from.x) * k, y = from.y + (p.y - from.y) * k, h = from.h + (p.h - from.h) * k
      if (!walk) {
        const j = Math.min(n - 1, Math.floor(k * n)), u = k * n - j          // which hop, and how far through it
        const e = u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2          // each hop eases across its own span
        const a = from, b = p, kk = (j + e) / n
        x = a.x + (b.x - a.x) * kk; y = a.y + (b.y - a.y) * kk - Math.sin(Math.PI * u) * p.h * 0.2
        const push = u < 0.14 ? 1 - u / 0.14 : u > 0.86 ? (u - 0.86) / 0.14 : 0, air = Math.sin(Math.PI * u)
        squash(1 + 0.07 * push - 0.03 * air, 1 - 0.09 * push + 0.05 * air)
      }
      place({ x, y, h })
      if (k < 1) requestAnimationFrame(f); else { squash(1, 1); done() }
    }
    requestAnimationFrame(f)
  })
  if (my === token) at = p
}

// the bubble: over his head (on a phone, along the foot of the screen), its tail toward him
function showBubble(html, btns, n) {
  bubble.querySelector('.gd-btns').innerHTML = btns
  bubble.querySelector('.gd-n').textContent = n || ''
  bubble.classList.toggle('gd-ask', !n)
  bubble.hidden = false                                     // shown first: a live region only speaks what changes while it is seen
  say(html, html.length)
  reflowBubble()
  bubble.classList.remove('gd-on'); void bubble.offsetWidth; bubble.classList.add('gd-on')
}
function reflowBubble() {
  if (!at || bubble.hidden) return
  const w = W(), h = H(), bw = bubble.offsetWidth, bh = bubble.offsetHeight
  bubble.classList.toggle('gd-dock', phone.matches)
  if (phone.matches) { bubble.style.transform = `translate(${Math.round((w - bw) / 2)}px, ${Math.round(h - bh - 18)}px)`; return }
  const headY = at.y - at.h - 14, below = headY - bh < 10
  const x = Math.min(w - bw - 10, Math.max(10, at.x - bw / 2)), y = below ? Math.min(h - bh - 10, at.y + 12) : headY - bh
  bubble.classList.toggle('gd-below', below)
  bubble.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`
  bubble.style.setProperty('--tail', Math.round(Math.min(bw - 24, Math.max(24, at.x - x))) + 'px')
}
function reflow() {
  if (in3d()) return reflowBubble()
  const s = run ? steps()[run.i] : asking ? STEPS[0] : null
  if (s) { const p = spotFor(s); if (p) { place(p); at = p; arjun.face(p.face); arjun.point(aimAt(p, p.aim)) } }
  reflowBubble()
}
// the text: what has been said in full colour, the rest held in place (so the bubble never changes size) but unseen
function say(text, n) {
  const p = bubble.querySelector('.gd-say')
  p.firstChild.textContent = text.slice(0, n); p.lastChild.textContent = text.slice(n)
  const sr = bubble.querySelector('.gd-sr')
  if (sr.textContent !== text) sr.textContent = text
}

// ---- the voice -----------------------------------------------------------------------------------------------
const loadData = () => (dataJob ||= fetch('media/guide/guide.json').then((r) => (r.ok ? r.json() : null)).catch(() => null).then((d) => (data = d)))
// from a press: the audio context starts inside the press (as every browser asks), then the clips are fetched and decoded
// the first press anywhere lets audio in (a browser asks for one), so his voice can speak where no tour was asked for:
// the one line on the mini desktop, the first time it opens
function wake() {
  if (!ctx) {
    const A = window.AudioContext || window.webkitAudioContext
    if (A) { try { ctx = new A(); gain = ctx.createGain(); gain.connect(ctx.destination); gain.gain.value = voice() ? 1 : 0 } catch (e) { ctx = null } }
  }
  if (ctx && ctx.state !== 'running') ctx.resume().catch(() => {})
  if (ctx && g3) g3.audio(ctx, gain)
}
// one line's voice on its own, fetched and decoded if it is not yet, waited for at most ms
async function clipReady(k, ms) {
  if (bufs[k] || !ctx) return
  const d = await loadData()
  if (!d || !d.clips[k]) return
  ready[k] ||= fetch(d.clips[k].src).then((r) => r.arrayBuffer()).then((b) => new Promise((ok, no) => ctx.decodeAudioData(b, ok, no))).then((buf) => { bufs[k] = buf }).catch(() => {})
  await Promise.race([ready[k], wait(ms)])
}
function unlock() {
  wake()
  // fetched and decoded one after another in the order he says them, so the first line is ready first
  decoding ||= loadData().then(async (d) => {
    if (!d || !ctx) return
    const order = [...new Set(STEPS.map((s) => s.clip).concat(Object.keys(d.clips)))].filter((k) => d.clips[k])
    let chain = Promise.resolve()
    for (const k of order) {
      ready[k] = chain = chain.then(() => fetch(d.clips[k].src)).then((r) => r.arrayBuffer())
        .then((b) => new Promise((ok, no) => ctx.decodeAudioData(b, ok, no))).then((buf) => { bufs[k] = buf }).catch(() => {})
    }
    await chain
  })
  return decoding
}
// a line's voice, if it arrives soon enough: the words never wait long for it
const voiceFor = (k, ms) => Promise.race([ready[k] || Promise.resolve(), wait(ms)])
// where in the text the voice is at t seconds, from the chunks (between two chunks it rests at the end of the first)
function charsAt(c, t) {
  let n = 0
  for (const [a, b, t0, t1] of c.chunks) { if (t >= t1) n = b; else { if (t > t0) n = a + Math.round((b - a) * (t - t0) / (t1 - t0)); break } }
  return t >= c.dur ? c.text.length : n
}
function timeAt(c, i) { for (const [a, b, t0, t1] of c.chunks) if (i < b) return i <= a ? t0 : t0 + (t1 - t0) * (i - a) / (b - a); return c.dur }
const envAt = (c, t) => { const i = Math.floor(t * (data ? data.fps : 50)); return c.env && i >= 0 && i < c.env.length ? +c.env[i] / 9 : 0 }

// one line: the voice (or its silent timeline), the text, the mouth and the marks, all off one clock. Resolves when it ends.
function speak(name, words, my, onMark) {
  const c = data && data.clips[name]
  const text = c ? c.text : words, dur = c ? c.dur : text.length * 0.062 + 0.5
  const clip = c || { text, dur, chunks: [[0, text.length, 0.15, dur - 0.3]], env: null }
  let src = null, t0 = 0
  const started = performance.now()
  if (ctx && bufs[name] && ctx.state === 'running') {
    src = ctx.createBufferSource(); src.buffer = bufs[name]; src.connect(in3d() ? g3.audio(ctx, gain) : gain)
    t0 = ctx.currentTime + 0.03; src.start(t0)
  }
  const clock = () => (src ? ctx.currentTime - t0 : (performance.now() - started) / 1000)
  run.stop = () => { if (src) { try { src.stop() } catch (e) { /* already ended */ } src = null } }
  let mouth = 0, mark = -1
  return new Promise((done) => {
    const f = () => {
      if (my !== token) return done(false)
      const t = clock()
      say(text, reduced() ? text.length : charsAt(clip, Math.max(0, t)))      // with reduced motion the words are simply there
      // the mouth follows the voice's loudness (without a recording: a talking rhythm while the words come)
      const v = clip.env ? envAt(clip, t) : t < clip.chunks[0][3] ? 0.35 + 0.35 * Math.sin(t * 17) * Math.sin(t * 5.3) : 0
      mouth += (v - mouth) * 0.55
      const open = Math.max(0, Math.min(1, (mouth - 0.06) * 1.5))
      if (in3d()) g3.mouth(open); else arjun.mouth(open)
      if (onMark) { const m = onMark.times.findLastIndex((x) => t >= x); if (m !== mark) { mark = m; onMark.go(m) } }
      if (t < dur) requestAnimationFrame(f); else { arjun.mouth(0); if (g3) g3.mouth(0); say(text, text.length); done(true) }
    }
    requestAnimationFrame(f)
  })
}

// ---- the tour ------------------------------------------------------------------------------------------------
function light(id, on) { if (on === lit.has(id)) return; on ? lit.add(id) : lit.delete(id); room.highlight(id, on); backdrop(on ? id : [...lit].pop() || null) }
// the room dims round what he talks about, the thing itself left in its own light (and floating up: things.js)
let spotEl = null, spotId = null, spotRaf = 0
function backdrop(id) {
  spotId = id
  if (!spotEl && layer) { spotEl = layer.insertBefore(el('div', 'gd-spot'), layer.firstChild); spotEl.setAttribute('aria-hidden', 'true') }
  if (!spotEl) return
  spotEl.classList.toggle('on', !!id)
  if (id && !spotRaf) {
    const f = () => {
      spotRaf = 0
      if (!spotId) return
      const a = room.anchor(spotId)
      if (a) {
        const w = Math.max(110, (a.x1 - a.x0) * 1.05), h = Math.max(110, (a.y1 - a.y0) * 1.05)
        spotEl.style.setProperty('--sx', ((a.x0 + a.x1) / 2).toFixed(1) + 'px'); spotEl.style.setProperty('--sy', ((a.y0 + a.y1) / 2).toFixed(1) + 'px')
        spotEl.style.setProperty('--sw', w.toFixed(1) + 'px'); spotEl.style.setProperty('--sh', h.toFixed(1) + 'px')
      }
      const g = in3d() ? g3.screen() : null                     // and he stays in the light too
      if (g) { spotEl.style.setProperty('--gx', g.x.toFixed(1) + 'px'); spotEl.style.setProperty('--gy', (g.y - g.h / 2).toFixed(1) + 'px'); spotEl.style.setProperty('--gw', (g.h * 2.6).toFixed(1) + 'px'); spotEl.style.setProperty('--gh', (g.h * 1.8).toFixed(1) + 'px') }
      spotRaf = requestAnimationFrame(f)
    }
    spotRaf = requestAnimationFrame(f)
  }
}
function unlightAll() { for (const id of [...lit]) light(id, false) }
const steps = () => STEPS.filter((s) => !s.live || room.live())

function open() {
  build(); makePill()
  layer.hidden = false
  layer.classList.add('gd-show')
  if (pill) pill.classList.add('gd-busy')
}
// the first visit: he walks in, waves, and asks
let early = false
export async function offer() {
  makePill()                                                  // the Tutorial pill is there on every visit, seen the tour or not
  if (!early && room.live()) { early = true; (window.requestIdleCallback || setTimeout)(() => want3d(), { timeout: 6000 }) }      // the 3D figure fetched and readied while the room rests
  if (store.get(DONE) === '1' || run || asking || offered) return
  offered = true
  if (pill) pill.classList.add('gd-busy')                    // on a first visit the pill waits until he has asked
  for (let t = 0; document.getElementById('boot') && t < 120; t++) await wait(250)      // the loader is still up (the live room is slow to arrive): he waits for it
  await wait(1700)
  if (!room.settled() || run || asking || app.dataset.place !== 'room' || document.getElementById('boot')) { offered = false; if (pill && !run && !asking) pill.classList.remove('gd-busy'); return }
  open()
  asking = true
  const my = ++token
  loadData().then((d) => { if (d && d.clips.hello) fetch(d.clips.hello.src).catch(() => {}) })      // his first line is in the cache before he is asked to say it
  if (await want3d() && in3d()) {
    if (my !== token) return
    layer.classList.add('gd-3d')
    room.quiet(true)
    const p3 = spot3(STEPS[0])
    if (!p3) { asking = false; hide(); return }
    await go3(p3, my)
    if (my !== token) return
    g3.faceCamera(); g3.pose('wave')
    at = g3.screen(); track()
    showBubble(ASK, `<button type="button" class="gd-b" data-go="no">No thanks</button><button type="button" class="gd-b gd-p" data-go="start">Show me around</button>`)
    return
  }
  await solo3d()
  if (my !== token) return
  const p = spotFor(STEPS[0])
  if (!p) { asking = false; hide(); return }
  at = reduced() ? null : { x: -p.h, y: p.y, h: p.h }                    // in from the left edge
  if (at) place(at)
  room.quiet(true)
  await walkTo(p, my)
  if (my !== token) return
  arjun.face(1); arjun.pose('wave')
  showBubble(ASK, `<button type="button" class="gd-b" data-go="no">No thanks</button><button type="button" class="gd-b gd-p" data-go="start">Show me around</button>`)
}
function decline() {
  asking = false
  store.set(DONE, '1')
  leaveToPill(bubble.contains(document.activeElement))
}
// the tour itself; fromPress: started by a press (the Tutorial pill, Show me around), so the voice may play
export async function start(fromPress) {
  build(); makePill()
  if (fromPress) unlock()
  asking = false
  if (run) run.stop && run.stop()
  room.quiet(true)
  open()
  run = { i: -1, stop: null }
  if (await want3d() && in3d()) layer.classList.add('gd-3d')
  else if (await solo3d() && !at) { const p = spotFor(STEPS[0]); if (p) { at = reduced() ? null : { x: -p.h, y: p.y, h: p.h }; if (at) place(at) } }
  await Promise.race([loadData(), wait(1500)])
  await voiceFor('hello', 2000)
  if (run) step(0)
}
async function step(i) {
  if (!run) return
  const list = steps()
  if (i >= list.length) return finish(true)
  const my = ++token
  if (run.stop) run.stop()
  unlightAll()
  run.i = i
  const s = list[i], n = `${i + 1} / ${list.length}`
  const keys = bubble.contains(document.activeElement)      // a keyboard on the bubble stays on it, step to step
  bubble.hidden = true
  bubble.querySelector('.gd-sr').textContent = ''
  const three = in3d()
  const p = three ? spot3(s) : spotFor(s)
  if (!p) return step(i + 1)
  if (three) {
    g3.mouth(0)
    if (g3.peeked) await g3.unpeek()
    await go3(p, my)
    if (my !== token) return
    // not to be seen there (behind the laptop, under the frames): he climbs up over what hides him and calls out
    const seen = g3.seen()
    if (seen.on && seen.by && await g3.peek(seen.by)) {
      if (my !== token) return
      at = g3.screen(); track()
      showBubble('Over here!', '', '')
      await voiceFor('over', 600)
      await speak('over', 'Over here!', my)
      if (my !== token) return
    }
    if (s.pose) { g3.faceCamera(); g3.look(null); g3.pose(s.pose) }
    else if (p.aim) {
      g3.pointAt(p.aim)
      wait(1500).then(() => { if (my === token && run) { g3.faceCamera(); g3.look(null); g3.pose('talk') } })      // he shows it, then turns back to you to talk
    } else { g3.faceCamera(); g3.pose('talk') }
    at = g3.screen(); track()
  } else {
    await walkTo(p, my)
    if (my !== token) return
    arjun.face(p.face)
    arjun.pose(s.pose || (p.aim ? 'point' : 'idle'))
    arjun.point(aimAt(p, p.aim))
  }
  if (s.at !== 'start' && s.at !== 'pill') light(s.at, true)
  if (s.at === 'pill' && pill) pill.classList.remove('gd-busy')      // the Tutorial pill he is pointing at is there to see
  const btns = (i > 0 ? `<button type="button" class="gd-b" data-go="back">Back</button>` : '') + `<button type="button" class="gd-b gd-p" data-go="next">${i === list.length - 1 ? 'Done' : 'Next'}</button>`
  const c = data && data.clips[s.clip], words = c ? c.text : s.text
  showBubble(words, btns, n)
  say(words, 0)
  if (keys || i === 0) bubble.querySelector('[data-go="next"]').focus({ preventScroll: true })
  let marks = null, mark = -1
  if (s.marks) {
    const timed = c || { text: words, dur: words.length * 0.062 + 0.5, chunks: [[0, words.length, 0.15, words.length * 0.062 + 0.2]] }
    const times = s.marks.map(([word]) => timeAt(timed, Math.max(0, words.indexOf(word))))
    marks = { times, go: (m) => {
      mark = m
      unlightAll()
      if (m < 0) return
      const id = s.marks[m][1], a = room.anchor(id)
      light(id, true)
      if (three) {
        const rec = room.thing && room.thing(id)
        if (rec) { g3.pointAt(rec.centre); const k = m; wait(1100).then(() => { if (my === token && mark === k) { g3.faceCamera(); g3.look(null); g3.pose('talk') } }) }
      } else if (a) { const face = a.cx >= at.x ? 1 : -1; arjun.face(face); arjun.pose('point'); arjun.point(aimAt({ ...at, face }, [a.cx, a.cy])) }
    } }
  }
  await voiceFor(s.clip, 1200)
  if (my !== token) return
  const ended = await speak(s.clip, words, my, marks)
  if (!ended || my !== token) return
  await wait(s.at === 'pill' ? 600 : 1100)
  if (my === token && run) step(i + 1)
}
async function finish() {
  if (!run) return
  if (run.stop) run.stop()
  run = null
  store.set(DONE, '1')
  unlightAll()
  leaveToPill(bubble.contains(document.activeElement))
}
// he walks to the Tutorial pill and goes into it: that is where he waits
async function leaveToPill(keys) {
  const my = ++token
  if (keys && pill) pill.focus({ preventScroll: true })      // the keyboard waits on the pill he goes into
  bubble.hidden = true
  arjun.mouth(0)
  if (in3d() && g3.shown) {
    g3.mouth(0)
    if (g3.peeked) await g3.unpeek()
    const p3 = !reduced() && spot3({ at: 'pill' })
    if (p3) {
      await g3.walkTo(p3, stopper(my))
      if (my !== token) return
      g3.faceCamera(); g3.look(null); g3.pose('wave')
      await wait(900)
      if (my !== token) return
      await g3.exit(stopper(my))
      if (my !== token) return
    }
    hide()
    if (pill) { pill.classList.remove('gd-busy'); pill.classList.remove('tp-pop'); void pill.offsetWidth; pill.classList.add('tp-pop') }
    return
  }
  const p = pill && app.dataset.place === 'room' ? spotFor({ at: 'pill' }) : null
  if (p && !reduced()) {
    await walkTo(p, my)
    if (my !== token) return
    arjun.face(-1); arjun.pose('wave')
    await wait(500)
    if (my !== token) return
    layer.classList.add('gd-into')
    await wait(380)
    if (my !== token) return
  }
  hide()
  if (pill) { pill.classList.remove('gd-busy'); pill.classList.remove('tp-pop'); void pill.offsetWidth; pill.classList.add('tp-pop') }
}
function hide() {
  if (!layer) return
  token++
  if (run && run.stop) run.stop()
  run = null; asking = false; at = null
  unlightAll()
  room.quiet(false)
  if (g3) g3.hide()
  if (follow) { cancelAnimationFrame(follow); follow = 0 }
  layer.hidden = true
  layer.classList.remove('gd-show', 'gd-into', 'gd-in', 'gd-3d')
  bubble.hidden = true
  if (pill) pill.classList.remove('gd-busy')
}

// the camera moved under him (a new light from the lamp travels the film's path): he stands by his thing again
export function settle() { if (layer && !layer.hidden && (run || asking)) reflow() }
// a press that will start the tour after a change of place (Tutorial in the taskbar): the voice is let in now, inside the press
export function prime() { build(); unlock() }

// ---- elsewhere ---------------------------------------------------------------------------------------------------
// the visitor is going somewhere else: a running tour counts as seen; an unanswered question is asked again next time
export function away() {
  if (run) { store.set(DONE, '1'); hide() } else if (asking) { offered = false; hide() } else if (layer && !layer.hidden && !tip) hide()
}
// the room is showing again: the pill is there; a first visit that has not answered is asked
export function home() { makePill(); if (tip) closeTip(); offer() }
export const busy = () => !!run || asking
// the first time the mini desktop opens: one line about it, by the bottom left corner
let tip = false
export async function deskTip() {
  if (store.get(DESK) === '1' || run || asking || tip) return
  tip = true
  await wait(reduced() ? 300 : 1300)
  if (!tip || app.dataset.place !== 'desktop') { tip = false; return }
  open()
  const my = ++token
  await solo3d()
  if (my !== token || !tip) return
  const h = size(), gw = h * aspect(), bar = phone.matches ? 230 : document.querySelector('#desktop.onlap') ? 10 : 56      // on a phone his bubble runs along the foot of the screen: he stands above it
  const p = { x: gw / 2 + 18, y: H() - bar, h, face: 1, aim: null }
  at = reduced() ? null : { x: -h, y: p.y, h }
  if (at) place(at)
  await walkTo(p, my)
  if (my !== token) return
  arjun.face(1); arjun.pose('wave')
  showBubble(DESK_TEXT, `<button type="button" class="gd-b gd-p" data-go="tip">Got it</button>`)
  run = { i: -1, stop: null }
  await loadData()
  await clipReady('desk', 1500)
  if (my !== token) return
  const ended = await speak('desk', DESK_TEXT, my)
  if (ended && my === token) { arjun.pose('idle'); run = null }
}
function closeTip() {
  tip = false
  store.set(DESK, '1')
  hide()
}
// leaving the desktop with the tip still up: it has been seen
export function deskAway() { if (tip) closeTip() }
// Tutorial from the taskbar's tray (main.js): the next desktop visit gets its tip again too
export function tutorial() { store.set(DESK, ''); start(true) }
export function init(onAct) {
  act = onAct
  addEventListener('pointerdown', wake, { capture: true, once: true }); addEventListener('keydown', wake, { capture: true, once: true })
}
window.__guide = { state: () => ({ audio: ctx ? ctx.state : 'none', voices: Object.keys(bufs), step: run ? run.i : null, asking, voice: voice() }) }      // for site/tools checks only
