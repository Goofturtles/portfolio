// Motion for the 3D room. Reference: css/motion.css (the film's measured curves, film/research/P2.md) for every timed
// move, and a critically damped spring (the "smooth damp" of game cameras, as in why.zero.university's CameraRig,
// webgl-story-template/docs/BREAKDOWN.md 3.4) for everything that follows a hand. Nothing here is linear.

const cache = new Map()
const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim()

// a CSS cubic-bezier as a function of 0..1 (Newton on x, then bisection)
export function bezier(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx, cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by
  const X = (t) => ((ax * t + bx) * t + cx) * t, Y = (t) => ((ay * t + by) * t + cy) * t, DX = (t) => (3 * ax * t + 2 * bx) * t + cx
  return (x) => {
    if (x <= 0) return 0
    if (x >= 1) return 1
    let t = x
    for (let i = 0; i < 6; i++) { const d = DX(t); if (Math.abs(d) < 1e-6) break; t -= (X(t) - x) / d }
    if (t < 0 || t > 1 || Math.abs(X(t) - x) > 1e-4) { let lo = 0, hi = 1; for (let i = 0; i < 24; i++) { t = (lo + hi) / 2; X(t) < x ? (lo = t) : (hi = t) } }
    return Y(t)
  }
}
// a curve token ("--m-cam") as a function; a time token ("--m-cam-near") in milliseconds
export function curve(name) {
  if (!cache.has(name)) {
    const m = /cubic-bezier\(([^)]+)\)/.exec(css(name)), v = m ? m[1].split(',').map(Number) : [0.8, 0, 0.2, 1]
    cache.set(name, bezier(v[0], v[1], v[2], v[3]))
  }
  return cache.get(name)
}
export function ms(name, fallback = 300) {
  if (!cache.has(name)) { const v = css(name), n = parseFloat(v); cache.set(name, Number.isFinite(n) ? (/ms$/.test(v) ? n : n * 1000) : fallback) }
  return cache.get(name)
}

// A value that follows its target with weight and never overshoots or twitches: critically damped, exact for any
// frame time. `time` is roughly how long it takes to arrive.
export class Damp {
  constructor(x = 0, time = 0.3) { this.x = x; this.v = 0; this.to = x; this.time = time }
  step(dt) {
    const w = 2 / Math.max(1e-4, this.time), k = w * dt, e = 1 / (1 + k + 0.48 * k * k + 0.235 * k * k * k)
    const d = this.x - this.to, tmp = (this.v + w * d) * dt
    this.v = (this.v - w * tmp) * e
    this.x = this.to + (d + tmp) * e
    return this.x
  }
  set(x) { this.x = this.to = x; this.v = 0 }
  get still() { return Math.abs(this.x - this.to) < 1e-4 && Math.abs(this.v) < 1e-4 }
}
// A value that swings past and comes back (a flower stem): an underdamped spring, stepped in small slices.
export class Sway {
  constructor(freq = 7, damping = 0.25) { this.x = 0; this.v = 0; this.w = freq; this.z = damping }
  step(dt) {
    for (let left = dt; left > 0; left -= 1 / 240) {
      const h = Math.min(left, 1 / 240)
      this.v += (-this.w * this.w * this.x - 2 * this.z * this.w * this.v) * h
      this.x += this.v * h
    }
    return this.x
  }
}

// Timed moves run on the render loop's clock (stage.js calls tick), so a move and the picture never disagree.
const running = new Set()
export function tween(duration, ease, fn) {
  let done
  const p = new Promise((r) => { done = r })
  const job = { t: 0, duration: Math.max(1, duration), ease, fn, done }
  running.add(job)
  p.cancel = () => { if (running.delete(job)) done(false) }
  fn(ease(0), 0)
  return p
}
export function tick(dtMs) {
  for (const job of [...running]) {
    job.t += dtMs
    const k = Math.min(1, job.t / job.duration)
    job.fn(job.ease(k), k)
    if (k >= 1) { running.delete(job); job.done(true) }
  }
}
export const moving = () => running.size > 0
