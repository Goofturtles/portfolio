// Hand, finger and tilt. Reference: film/SPEC.md, "The room is real-time 3D" items 1 and 3, and the brief's reach
// rules (touch works everything: tap = hover then go, drag = swing, and two things never fight);
// why.zero.university's rig for the tilt (gyro within about 20 degrees, smoothed, BREAKDOWN.md 3.4).
// One press is one thing: it starts as a possible click; past a few pixels it becomes a drag of what was under it
// (the chair swivels, anything else swings the camera along the film's arc) and can no longer be a click.

const clamp = (v, lo = -1, hi = 1) => Math.max(lo, Math.min(hi, v))

export function createInput(canvas, root, { rig, things, onHover, onPick }) {
  const ptr = { x: 0, y: 0, vx: 0, vy: 0, inside: false, pushes: false }      // where the pointer is, -1..1 (y up), and how fast it moves
  const fine = matchMedia('(hover: hover) and (pointer: fine)')
  let enabled = false, press = null, px = 0, py = 0, shown = null, lastMouse = -1e9, tiltAsked = false, tiltBase = null, goTimer = 0, off = 0
  const at = (e) => { const r = canvas.getBoundingClientRect(); return [((e.clientX - r.left) / r.width) * 2 - 1, 1 - ((e.clientY - r.top) / r.height) * 2] }
  const show = (rec) => { if (rec === shown) return; shown = rec; things.setHot(rec); onHover(rec); root.classList.toggle('point', !!rec) }

  function move(e) {
    if (!enabled) return
    const [x, y] = at(e)
    ptr.x = x; ptr.y = y
    if (e.pointerType !== 'touch') { ptr.inside = true; lastMouse = performance.now(); if (!press || !press.mode) rig.lean(x, -y) }
    if (!press || e.pointerId !== press.id) return
    const dx = e.clientX - press.lx, w = canvas.clientWidth || 1
    press.lx = e.clientX
    if (!press.mode && Math.hypot(e.clientX - press.x, e.clientY - press.y) > (press.touch ? 10 : 6)) {
      clearTimeout(goTimer)
      if (press.hit && things.isChair(press.hit.rec)) { press.mode = 'chair'; things.grabChair() } else if (rig.dragStart()) press.mode = 'swing'
      if (press.mode) { root.classList.add('grab'); if (press.mode === 'swing') show(null) }
    }
    if (press.mode === 'swing') rig.dragBy(dx / w)
    if (press.mode === 'chair') things.turnChair((dx / w) * 3.4)
  }
  function down(e) {
    if (!enabled || press || (e.pointerType === 'mouse' && e.button !== 0)) return
    const [x, y] = at(e)
    ptr.x = x; ptr.y = y
    press = { id: e.pointerId, x: e.clientX, y: e.clientY, lx: e.clientX, touch: e.pointerType === 'touch', mode: null, hit: things.pick(x, y) }
    try { canvas.setPointerCapture(e.pointerId) } catch (err) { /* a pointer that is already gone */ }
  }
  function up(e, cancelled) {
    if (!press || e.pointerId !== press.id) return
    const was = press
    press = null
    root.classList.remove('grab')
    if (was.mode === 'swing') rig.dragEnd()
    if (was.mode === 'chair') things.dropChair()
    if (was.touch) askTilt()
    if (was.mode || cancelled || !enabled) return
    const [x, y] = at(e), hit = things.pick(x, y)
    if (!hit) { show(null); return }
    if (things.press(hit)) return                                // the ball: flicked, nothing opens
    if (!hit.rec.opens) return
    if (was.touch) { show(hit.rec); goTimer = setTimeout(() => { show(null); onPick(hit.rec) }, 260) }      // a finger has no hover: the object lights, then it opens
    else onPick(hit.rec)
  }
  function leave(e) { if (e.pointerType === 'touch') return; ptr.inside = false; if (!press) { rig.lean(0, 0); show(null) } }

  // a tablet's tilt swings the camera as the pointer does. iPadOS asks first, and only from a tap.
  function tilt(e) {
    if (!enabled || e.beta == null || e.gamma == null || performance.now() - lastMouse < 3000) return
    const a = (screen.orientation && screen.orientation.angle) || 0
    let gx = e.gamma, gy = e.beta
    if (a === 90) { gx = e.beta; gy = -e.gamma } else if (a === 270 || a === -90) { gx = -e.beta; gy = e.gamma } else if (a === 180) { gx = -e.gamma; gy = -e.beta }
    if (!tiltBase) tiltBase = [gx, gy]
    tiltBase[0] += (gx - tiltBase[0]) * 0.01; tiltBase[1] += (gy - tiltBase[1]) * 0.01      // how it is being held drifts in as "level"
    if (!press) rig.lean(clamp((gx - tiltBase[0]) / 14), clamp((gy - tiltBase[1]) / 14))
  }
  function askTilt() {
    if (tiltAsked) return
    tiltAsked = true
    const D = window.DeviceOrientationEvent
    if (!D) return
    if (typeof D.requestPermission === 'function') D.requestPermission().then((s) => { if (s === 'granted') addEventListener('deviceorientation', tilt) }).catch(() => {})
  }
  if (window.DeviceOrientationEvent && typeof window.DeviceOrientationEvent.requestPermission !== 'function') addEventListener('deviceorientation', tilt)

  const cancel = (e) => up(e, true)
  canvas.addEventListener('pointermove', move); canvas.addEventListener('pointerdown', down); canvas.addEventListener('pointerup', up)
  canvas.addEventListener('pointercancel', cancel); canvas.addEventListener('pointerleave', leave)
  canvas.addEventListener('contextmenu', (e) => e.preventDefault())

  return {
    ptr,
    // once a frame: the pointer's speed, and what is under it (a mouse only: a finger shows it by tapping)
    frame(dt) {
      ptr.vx += ((ptr.x - px) / dt - ptr.vx) * 0.5; ptr.vy += ((ptr.y - py) / dt - ptr.vy) * 0.5
      px = ptr.x; py = ptr.y
      ptr.pushes = enabled && ptr.inside && !press
      if (!enabled || !ptr.inside || (press && press.mode) || rig.busy || !fine.matches) return
      const hit = things.pick(ptr.x, ptr.y)
      // an object keeps the pointer for a moment after it slips off (a swaying flower, a thin ring): no flicker at edges
      if (hit) { off = 0; show(hit.rec) } else if (shown && things.holds(shown, ptr.x, ptr.y)) off = 0; else if ((off += dt) > 0.14) show(null)
    },
    set enabled(v) { enabled = v; if (!v) { clearTimeout(goTimer); if (press && press.mode === 'swing') rig.dragEnd(); if (press && press.mode === 'chair') things.dropChair(); press = null; root.classList.remove('grab', 'point'); shown = null; ptr.inside = false; rig.lean(0, 0) } },
    get enabled() { return enabled },
    dispose() { removeEventListener('deviceorientation', tilt); clearTimeout(goTimer) },
  }
}
