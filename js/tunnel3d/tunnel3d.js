// The way in: a live flight down the film's tunnel of blue scales (shot P1 of Microsoft's "Loop", studied in
// film/research/P1.md), drawn in three.js. One export that matters:
//
//   flyTunnel(host, options) -> Promise     resolves when the flight is over (also when skipped, or when there is nothing to show)
//
//   host                 the element the canvas is mounted in (it should be as big as the view; the canvas fills it)
//   options.reverse      play the flight backwards (the way out)
//   options.duration     ms of flight, default 1550 (the film's own shot is 37.6 frames, 1.57 s at 24 fps)
//   options.openMs       ms of the white fade that opens onto the page (forward: after the far end fills the view;
//                        reverse: before the flight starts), default 260
//   options.fromRect     screen rectangle ({left, top, width, height} or a DOMRect, in viewport px) the first frames grow out of
//   options.toRect       screen rectangle the last frames shrink into (for the way out)
//   options.onMid        called once, when the far end fills the view (white, canvas fully opaque): swap the page behind now
//   options.onFrame      called each frame with the frame time in ms (for a read-out)
//
// A click or a key skips the flight at once (onMid is called first, if it has not been). With "reduce motion" on, or without
// WebGL, nothing is drawn: onMid is called and the promise resolves. Everything (context, canvas, listeners) is released at the end.
// The returned promise also carries .skip().
//
// three.js is found as the bare name "three" (the site's import map) and, failing that, in ../../vendor/three/.

import { F_FIRST } from './data.js'

let modulesPromise = null
function loadModules() {
  if (!modulesPromise) {
    modulesPromise = (async () => {
      let THREE
      try { THREE = await import('three') } catch (e) { THREE = await import('../../vendor/three/three.module.min.js') }
      const eng = await import('./engine.js')
      await eng.preloadAssets()
      return { THREE, eng }
    })()
    modulesPromise.catch(() => { modulesPromise = null })
  }
  return modulesPromise
}
/** Load three.js and the pictures ahead of time (call while the camera dive is playing). */
export function prepareTunnel() { return loadModules().then(() => true).catch(() => false) }

function webglOK() {
  try { const c = document.createElement('canvas'); return !!c.getContext('webgl2') } catch (e) { return false }
}
function reducedMotion() {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch (e) { return false }
}

const F_SPAN = 37.6 // film frames over `duration`
const F_MID = 129.0 // the far end fills the frame
const lerp = (a, b, t) => a + (b - a) * t
const clamp01 = (x) => Math.min(1, Math.max(0, x))
const easeOut = (t) => 1 - Math.pow(1 - clamp01(t), 3)
const easeInOut = (t) => { t = clamp01(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2 }

function toLocal(rect, hostRect) {
  if (!rect) return null
  const left = rect.left ?? rect.x, top = rect.top ?? rect.y
  return { x: left - hostRect.left, y: top - hostRect.top, w: rect.width, h: rect.height }
}

export function flyTunnel(host, options = {}) {
  let finish = () => {}
  const ctl = {}
  const promise = new Promise((resolve) => {
    const opt = { reverse: false, duration: 1550, openMs: 260, ...options }
    let midCalled = false, done = false
    const callMid = () => { if (!midCalled) { midCalled = true; try { opt.onMid && opt.onMid() } catch (e) { console.error(e) } } }
    if (reducedMotion() || !webglOK()) { callMid(); resolve(); return }

    let engine = null, canvas = null, raf = 0, ro = null, hostPos = null
    const listeners = []
    finish = (skipped) => {
      if (done) return
      done = true
      cancelAnimationFrame(raf)
      for (const [t, f, o] of listeners) window.removeEventListener(t, f, o)
      if (ro) ro.disconnect()
      callMid()
      try { engine && engine.dispose() } catch (e) { /* ignore */ }
      if (canvas) canvas.remove()
      if (hostPos !== null) host.style.position = hostPos
      resolve()
    }
    const onSkip = () => finish(true)
    ;['pointerdown', 'keydown'].forEach((t) => { const o = { capture: true }; window.addEventListener(t, onSkip, o); listeners.push([t, onSkip, o]) })

    loadModules().then(async ({ THREE, eng }) => {
      if (done) return
      canvas = document.createElement('canvas')
      canvas.setAttribute('aria-hidden', 'true')
      canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none;opacity:0'
      if (getComputedStyle(host).position === 'static') { hostPos = host.style.position; host.style.position = 'relative' }
      host.appendChild(canvas)
      engine = await eng.createEngine(THREE, canvas, { preserve: !!opt._preserve })
      if (done) { engine.dispose(); engine = null; return }
      let qScale = 1
      const size = () => {
        const w = Math.max(2, host.clientWidth), h = Math.max(2, host.clientHeight)
        let dpr = Math.min(window.devicePixelRatio || 1, 2) * qScale
        const maxPx = opt.maxPixels || 4.3e6
        if (w * h * dpr * dpr > maxPx) dpr = Math.sqrt(maxPx / (w * h))
        engine.resize(w, h, dpr)
      }
      size()
      ro = new ResizeObserver(size); ro.observe(host)
      await engine.warm()
      if (done) return

      const D = opt.duration, FADE = opt.openMs
      const tMidFwd = (D * (F_MID - F_FIRST)) / F_SPAN
      const T = opt.reverse ? FADE + D : Math.max(D, tMidFwd + FADE)
      const grow = 0.16 * D
      function timeline(t) {
        const W = host.clientWidth, H = host.clientHeight
        const full = { x: 0, y: 0, w: W, h: H }
        const hr = host.getBoundingClientRect()
        const fromR = toLocal(opt.fromRect, hr), toR = toLocal(opt.toRect, hr)
        let f, alpha = 1, mid = false, rect = full, rr = 0
        if (!opt.reverse) {
          f = t <= D ? F_FIRST + (F_SPAN * t) / D : F_FIRST + F_SPAN + ((t - D) / D) * F_SPAN * 0.5
          if (t >= tMidFwd) { mid = true; alpha = 1 - easeInOut((t - tMidFwd) / FADE) }
          if (fromR && t < grow) { const k = easeOut(t / grow); rect = { x: lerp(fromR.x, 0, k), y: lerp(fromR.y, 0, k), w: lerp(fromR.w, W, k), h: lerp(fromR.h, H, k) }; rr = (1 - k) * (opt.cornerRadius ?? 8) }
          if (toR && t > T - grow) { const k = easeInOut((t - (T - grow)) / grow); rect = { x: lerp(0, toR.x, k), y: lerp(0, toR.y, k), w: lerp(W, toR.w, k), h: lerp(H, toR.h, k) }; rr = k * (opt.cornerRadius ?? 8) }
        } else {
          if (t < FADE) { f = F_FIRST + F_SPAN + ((FADE - t) / FADE) * 3; alpha = easeInOut(t / FADE) } else {
            mid = true
            const s = t - FADE
            f = F_FIRST + F_SPAN - (F_SPAN * s) / D
          }
          const target = toR || fromR
          const s2 = t - FADE
          if (target && s2 > D - grow) { const k = easeInOut((s2 - (D - grow)) / grow); rect = { x: lerp(0, target.x, k), y: lerp(0, target.y, k), w: lerp(W, target.w, k), h: lerp(H, target.h, k) }; rr = k * (opt.cornerRadius ?? 8) }
          if (fromR && !toR && false) rect = full
        }
        return { f: Math.max(F_FIRST, f), alpha, mid, rect, rr, full: rect === full }
      }
      function paint(st) {
        engine.draw(st.f, st.full ? null : st.rect)
        canvas.style.opacity = String(st.alpha)
        if (st.full) canvas.style.clipPath = ''
        else {
          const W = host.clientWidth, H = host.clientHeight, r = st.rect
          canvas.style.clipPath = `inset(${r.y}px ${W - r.x - r.w}px ${H - r.y - r.h}px ${r.x}px round ${st.rr}px)`
        }
      }

      // debugging / proof hooks: hold one film frame, or time the render
      ctl.setFrame = (f) => { paint({ f, alpha: 1, mid: false, rect: { x: 0, y: 0, w: host.clientWidth, h: host.clientHeight }, full: true, rr: 0 }); engine.finish() }
      ctl.bench = (n = 120) => {
        const t0 = performance.now()
        for (let i = 0; i < n; i++) {
          const t = (i / n) * T
          paint(timeline(t))
          engine.finish()
        }
        return (performance.now() - t0) / n
      }
      ctl.engine = engine
      if (opt._holdFrame != null) { ctl.setFrame(opt._holdFrame); return }

      let t0 = 0, last = 0, tAcc = 0, slowN = 0, seen = 0
      const tick = (now) => {
        if (done) return
        if (!t0) { t0 = now; last = now }
        const dt = now - last
        last = now
        tAcc += Math.min(dt, 64)
        const t = opt._clock ? opt._clock() : tAcc
        if (opt.onFrame && dt > 0 && tAcc > 0) opt.onFrame(dt)
        // a slow device (a tablet): render fewer pixels instead of dropping frames
        if (dt > 0 && ++seen > 3 && seen < 60) { slowN += dt > 26 ? 1 : 0; if (slowN >= 5 && qScale > 0.55) { qScale *= 0.75; slowN = 0; size() } }
        const st = timeline(Math.min(t, T))
        paint(st)
        if (st.mid) callMid()
        if (t >= T) { finish(false); return }
        raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
    }).catch((e) => { console.error('tunnel3d:', e); finish(false) })
  })
  promise.skip = () => finish(true)
  promise._ctl = ctl
  return promise
}
