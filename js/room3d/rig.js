// The living camera. Reference: the film's own camera (film/research/P2.md section 2: a 68 mm lens orbiting the desk
// from f307 to f417, about 80 degrees, the homes at f320, f362, f378 and f405; all of it arrives through room3d.json)
// and why.zero.university's CameraRig (webgl-story-template/docs/BREAKDOWN.md 3.4: pointer or gyro offsets the camera
// with a smoothed follow). At rest it sits on the theme's film camera and breathes; the pointer or a tablet's tilt
// swings it a few degrees round the point it looks at, so near things cross far ones; a drag carries it along the
// film's arc with weight and lets it settle home; a theme change travels the arc; the dive ends square on the
// laptop's screen with the screen exactly filling the view. One pose is composed each frame, in that order.
import * as THREE from 'three'
import { Damp, tween, curve, ms } from './motion.js'

const FILM_ASPECT = 16 / 9
const MIN_COVER = 0.5          // a narrow screen still sees this much of the film frame's width: below it the lens widens instead of cropping
export const RIM = 0.0072      // the lid's black glass edge round the lit picture, in metres (look.js, the screen shader)
const rad = THREE.MathUtils.degToRad

export function createRig(camera, contract, scene, screen) {
  // ---- the film's path, and where each theme rests on it ------------------------------------------------
  const homes = {}
  for (const [id, c] of Object.entries(contract.cameras)) {
    const node = scene.getObjectByName(c.node)
    let position = c.position && new THREE.Vector3(...c.position), target = c.target && new THREE.Vector3(...c.target), fovH = c.fovH
    if (node) {                                                 // the glb's own camera fills what the json leaves out
      node.updateWorldMatrix(true, false)
      position ||= node.getWorldPosition(new THREE.Vector3())
      if (!target) { const d = node.getWorldDirection(new THREE.Vector3()).negate(); target = position.clone().addScaledVector(d, position.length()) }
      if (!fovH && !c.fovV && !c.lens && node.isPerspectiveCamera) fovH = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(rad(node.fov) / 2) * FILM_ASPECT))
    }
    if (!fovH) fovH = c.lens ? THREE.MathUtils.radToDeg(2 * Math.atan(c.sensor / (2 * c.lens))) : THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(rad(c.fovV || 17) / 2) * FILM_ASPECT))
    if (position && target) homes[id] = { position, target, fovH, frame: c.frame ?? (contract.themes[id] || {}).frame, index: c.index }
  }
  const ids = Object.keys(homes)
  if (!ids.length) throw new Error('room3d: no cameras in the export')
  const P = contract.path
  let pos, aim, last
  if (P) {
    pos = new THREE.CatmullRomCurve3(P.positions.map((p) => new THREE.Vector3(...p)))
    aim = new THREE.CatmullRomCurve3((P.targets.length === P.positions.length ? P.targets : P.positions.map(() => homes[ids[0]].target.toArray())).map((p) => new THREE.Vector3(...p)))
    last = P.positions.length - 1
  } else {                                                      // no path in the export: the arc is the homes themselves, in order
    pos = new THREE.CatmullRomCurve3(ids.map((id) => homes[id].position)); aim = new THREE.CatmullRomCurve3(ids.map((id) => homes[id].target)); last = Math.max(1, ids.length - 1)
  }
  const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3()
  for (const [i, id] of ids.entries()) {
    const h = homes[id]
    if (!P) { h.s = ids.length > 1 ? i : 0; continue }
    h.s = h.index != null ? THREE.MathUtils.clamp(h.index, 0, last) : h.frame != null ? THREE.MathUtils.clamp(h.frame - P.first, 0, last) : 0
    if (h.index == null && h.frame == null) { let best = 1e9; for (let k = 0; k <= last; k++) { const d = pos.getPoint(k / last, tmpA).distanceToSquared(h.position); if (d < best) { best = d; h.s = k } } }
  }
  // the json's home cameras are the truth: where the path passes a little beside one, the difference is carried
  const order = ids.slice().sort((a, b) => homes[a].s - homes[b].s)
  for (const id of ids) { const h = homes[id]; h.dp = h.position.clone().sub(pos.getPoint(h.s / last, tmpA)); h.dt = h.target.clone().sub(aim.getPoint(h.s / last, tmpA)) }
  function onPath(s, outP, outT) {
    const u = THREE.MathUtils.clamp(s / last, 0, 1)
    pos.getPoint(u, outP); aim.getPoint(u, outT)
    let a = homes[order[0]], b = a
    for (const id of order) { if (homes[id].s <= s) a = b = homes[id]; else { b = homes[id]; break } }
    const k = b === a || b.s === a.s ? 0 : THREE.MathUtils.clamp((s - a.s) / (b.s - a.s), 0, 1)
    outP.add(tmpA.copy(a.dp).lerp(b.dp, k)); outT.add(tmpA.copy(a.dt).lerp(b.dt, k))
  }
  const limits = P ? [contract.swing.from ?? 0, contract.swing.to ?? last] : [0, last], slack = contract.swing.over ?? 3
  const pivot = contract.swing.pivot ? new THREE.Vector3(...contract.swing.pivot) : null      // what the pointer swings the camera about: the middle of the desk

  // ---- state --------------------------------------------------------------------------------------------
  let theme = ids[0], aspect = FILM_ASPECT, time = 0, dragging = false, travelling = null, flight = null
  const along = new Damp(homes[theme].s, 0.5), swingX = new Damp(0, 0.35), swingY = new Damp(0, 0.35)
  let dive = 0, approach = 0, calm = 1                          // dive: 0 the room, 1 inside the screen. calm: how much of the swing and the breath is left
  // fill: 1 = the dive ends with the screen exactly over the view (a phone's flight, before its own desktop); below 1 =
  // the camera stops square on with the screen's lit glass this share of the view's height, and the laptop round it
  // (the desktop on the laptop, js/laptop.js), where it keeps a small breath and a little of the pointer's lean
  let fill = 1
  const target = new THREE.Vector3(), tmpO = new THREE.Vector3(), tmpR = new THREE.Vector3()
  const near = { position: new THREE.Vector3(), target: new THREE.Vector3() }
  const eye = new THREE.Vector3(), look = new THREE.Vector3(), off = new THREE.Vector3(), right = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0)
  const qA = new THREE.Quaternion(), qB = new THREE.Quaternion(), m4 = new THREE.Matrix4(), endEye = new THREE.Vector3()
  const fovH = () => homes[theme].fovH

  function lens() {
    // the film's vertical view while the screen is wide enough; on a tall screen the lens widens so the desk stays in
    const half = Math.tan(rad(fovH()) / 2), seen = Math.min(1, aspect / FILM_ASPECT)
    return 2 * Math.atan(seen >= MIN_COVER ? half / FILM_ASPECT : half * MIN_COVER / aspect)
  }
  // the pose that puts the screen square on and exactly over the view (the part of it with the view's shape)
  function screenPose(fov) {
    if (fill < 1) {
      // docked: the lit glass (inside the lid's black rim) fills `fill` of the view's height, or 90% of its width on a
      // narrow window; the glass sits a touch above the middle so the keyboard's edge shows under the bezel
      const gw = screen.width - 2 * RIM, gh = screen.height - 2 * RIM, k = Math.min(fill, 0.9 * aspect * gh / gw), visH = gh / k
      target.copy(screen.center).addScaledVector(screen.up, -0.01 * visH)
      endEye.copy(target).addScaledVector(screen.normal, (visH / 2) / Math.tan(fov / 2))
      // the room still breathes round it, and leans a little after the pointer (a fifth of the room's lean)
      const yaw = rad(contract.swing.yaw) * 0.2 * swingX.x + rad(0.1) * Math.sin(time * 0.31)
      const pitch = rad(contract.swing.pitch) * 0.2 * swingY.x + rad(0.05) * Math.sin(time * 0.23 + 1.3)
      tmpO.copy(endEye).sub(target).applyAxisAngle(up, yaw)
      tmpR.crossVectors(up, tmpO).normalize()
      endEye.copy(target).add(tmpO.applyAxisAngle(tmpR, -pitch))
      m4.lookAt(endEye, target, screen.up)
      qB.setFromRotationMatrix(m4)
      return
    }
    const as = screen.width / screen.height, visH = aspect >= as ? screen.width / aspect : screen.height
    target.copy(screen.center)
    endEye.copy(screen.center).addScaledVector(screen.normal, (visH / 2) / Math.tan(fov / 2))
    m4.lookAt(endEye, screen.center, screen.up)
    qB.setFromRotationMatrix(m4)
    screen.vis.set(aspect >= as ? 1 : (screen.height * aspect) / screen.width, aspect >= as ? visH / screen.height : 1)
  }

  function update(dt) {
    time += dt
    if (!travelling) { if (!dragging) along.to = homes[theme].s; along.step(dt) }
    swingX.step(dt); swingY.step(dt)
    onPath(along.x, eye, look)
    if (aspect < 1 && screen) look.lerp(screen.center, 0.45 * (1 - aspect))      // a tall screen is aimed at the laptop
    // the swing: the camera really moves round the point it looks at, a few degrees, plus a slow breath
    const live = calm * (1 - dive)
    const yaw = rad(contract.swing.yaw) * swingX.x * live + rad(0.22) * Math.sin(time * 0.31) * live
    const pitch = rad(contract.swing.pitch) * swingY.x * live + rad(0.1) * Math.sin(time * 0.23 + 1.3) * live
    const about = pivot || look
    off.copy(eye).sub(about)
    off.applyAxisAngle(up, yaw)
    right.crossVectors(up, off).normalize()
    off.applyAxisAngle(right, -pitch)
    off.multiplyScalar(1 + 0.004 * Math.sin(time * 0.19 + 0.6) * live)
    eye.copy(about).add(off)
    if (approach > 0) { eye.lerp(near.position, approach); look.lerp(near.target, approach) }
    const fov = lens()
    camera.fov = THREE.MathUtils.radToDeg(fov)
    if (dive > 0 && screen) {
      // the flight in: the eye finds the screen early and keeps it in the middle all the way, and the last stretch
      // squares up, so it lands exactly on the screen's axis with the screen's own "up"
      screenPose(fov)
      // a move toward something reads as even when its SIZE grows evenly, not when the distance shrinks evenly:
      // the distance to the screen falls by the same share in every step (a straight lerp crawls, then lunges)
      const rho = endEye.distanceTo(target) / Math.max(eye.distanceTo(target), 1e-6)
      eye.lerp(endEye, rho < 0.98 ? (1 - Math.pow(rho, dive)) / (1 - rho) : dive)
      look.lerp(target, THREE.MathUtils.smoothstep(dive, 0, 0.25))
    }
    m4.lookAt(eye, look, up)
    qA.setFromRotationMatrix(m4)
    if (dive > 0 && screen) {
      qA.slerp(qB, THREE.MathUtils.smootherstep(dive, 0.5, 1))
      if (dive >= 1) { eye.copy(endEye); qA.copy(qB) }
    }
    camera.position.copy(eye); camera.quaternion.copy(qA)
    camera.updateProjectionMatrix(); camera.updateMatrixWorld()
  }

  // ---- what moves it ------------------------------------------------------------------------------------
  return {
    update, homes,
    get theme() { return theme }, get dive() { return dive }, get along() { return along.x }, get busy() { return !!travelling || !!flight },
    get fill() { return fill }, setFill(v) { fill = v },
    resize(a) { aspect = a; camera.aspect = a },
    // pointer or tilt, -1..1 each way: toward the pointer, as a head leaning to look round something
    lean(x, y) { swingX.to = THREE.MathUtils.clamp(x, -1, 1); swingY.to = THREE.MathUtils.clamp(-y, -1, 1) },
    dragStart() { if (travelling || flight) return false; dragging = true; along.time = 0.28; return true },
    // dx as a fraction of the stage's width: the scene follows the hand, the camera goes the other way round the desk
    dragBy(dx) {
      if (!dragging) return
      let to = along.to + dx * (limits[1] - limits[0]) * 0.75
      const over = to < limits[0] ? to - limits[0] : to > limits[1] ? to - limits[1] : 0
      if (over) to = THREE.MathUtils.clamp(to - over * 0.7, limits[0] - slack, limits[1] + slack)      // past the end of the film's arc it resists, then stops
      along.to = to
    },
    dragEnd() { if (!dragging) return; dragging = false; along.time = ms('--m-settle-ms', 900) / 1000 * 0.6 },
    place(id) { if (homes[id]) { theme = id; along.set(homes[id].s) } },
    // a theme change: along the film's path to that theme's home, on the film's own ease. fn(k) is told how far.
    travel(id, fn) {
      if (!homes[id]) return Promise.resolve()
      if (travelling) travelling.cancel()
      const from = along.x, to = homes[id].s, a = order.indexOf(theme), b = order.indexOf(id), gap = Math.abs(a - b)
      theme = id; dragging = false
      const job = tween(ms(gap <= 1 ? '--m-cam-near' : gap === 2 ? '--m-cam-mid' : '--m-cam-far', 1400), curve('--m-cam'), (k) => { along.set(from + (to - from) * k); fn && fn(k) })
      travelling = job
      return job.then((done) => { if (travelling === job) travelling = null; return done })
    },
    // into the laptop's screen (to = 1) or back out (to = 0)
    fly(to, fn) {
      if (flight) flight.cancel()
      const from = dive, out = to < from
      const job = tween(ms(out ? '--m-rise-ms' : '--m-dive-ms', 1200) * Math.abs(to - from), curve(out ? '--m-rise' : '--m-dive'), (k) => { dive = from + (to - from) * k; fn && fn(dive) })
      flight = job
      return job.then((done) => { if (flight === job) flight = null; return done })
    },
    setDive(v) { dive = v },
    // toward an object whose place opens over the room: part of the way, looking at it
    approachTo(center, radius, to, fn) {
      if (to > 0) {
        const fov = lens(), dist = radius / Math.tan(fov / 2) * 2.1
        near.target.copy(center)
        near.position.copy(camera.position).sub(center).setLength(dist).add(center)
      }
      const from = approach
      return tween(ms('--m-approach-ms', 620), curve('--m-std'), (k) => { approach = from + (to - from) * k; fn && fn(k) })
    },
    setApproach(v) { approach = v },
    quiet(v) { calm = v },
  }
}
