// The room, live: the Blender desk scene itself, drawn by the graphics card every frame. Reference: film/SPEC.md,
// "The room is real-time 3D" (the test for every feature: could it be faked with one picture and a filter?), his two
// sites (ohzi.io: ../ohzi-study/README.md; why.zero.university: ../webgl-story-template/docs/BREAKDOWN.md, whose
// adaptive quality tiers, section 3.6, are the model for the ones here), and the film for how it looks and moves.
// This module only puts the parts together: contract.js (what Blender exported), look.js (materials), mirror.js (the
// desk top), post.js (glow), rig.js (the camera), things.js (the objects), input.js (hand, finger, tilt).
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { retry } from '../config.js'
import { still as wallpaper } from '../bloom.js'
import { loadContract } from './contract.js'
import { createLook } from './look.js'
import { createMirror } from './mirror.js'
import { createBloom, GLOW_LAYER, GLASS_LAYER } from './post.js'
import { createRig, RIM } from './rig.js'
import { createThings } from './things.js'
import { createInput } from './input.js'
import { createWall } from './wall.js'
import { tick, Damp } from './motion.js'

const WALL_LOOP = 16                                            // js/bloom.js turns its wallpaper once in this many seconds; the laptop's screen keeps the same time
// what a slow screen gives up, in this order: the lens's depth of field and a little sharpness, then the glow and more sharpness
const TIERS = [{ scale: 1, mirror: 0.5, bloom: true, lens: true }, { scale: 0.85, mirror: 0.4, bloom: true, lens: false }, { scale: 0.64, mirror: 0.33, bloom: false, lens: false }]

export function supported() {
  try { return !!document.createElement('canvas').getContext('webgl2') } catch (e) { return false }
}

// the screen quad as the camera needs it: its middle, which way it faces, which way is up in its picture (from its UVs)
function screenFrame(mesh) {
  const p = mesh.geometry.attributes.position, uv = mesh.geometry.attributes.uv
  const local = [[0, 0], [1, 0], [0, 1], [1, 1]].map(([u, v], n) => {
    let at = n, best = 1e9
    if (uv) for (let i = 0; i < uv.count; i++) { const d = (uv.getX(i) - u) ** 2 + (uv.getY(i) - v) ** 2; if (d < best) { best = d; at = i } }
    return new THREE.Vector3().fromBufferAttribute(p, at)
  })
  const f = { center: new THREE.Vector3(), normal: new THREE.Vector3(), up: new THREE.Vector3(), width: 1, height: 1, vis: new THREE.Vector2(1, 1) }
  const w = local.map(() => new THREE.Vector3()), right = f.right = new THREE.Vector3()
  f.refresh = () => {
    w.forEach((v, i) => v.copy(local[i]).applyMatrix4(mesh.matrixWorld))
    right.subVectors(w[1], w[0]); f.up.subVectors(w[0], w[2])     // glTF: v = 0 is the top of the picture
    f.width = right.length(); f.height = f.up.length()
    f.center.copy(w[0]).add(w[1]).add(w[2]).add(w[3]).multiplyScalar(0.25)
    f.normal.crossVectors(right.normalize(), f.up.normalize()).normalize()
  }
  f.refresh()
  return f
}

// A WORKAROUND FOR ONE EXPORT FAULT, to be deleted when the export is right: room.glb of 2026-10-10 09:32 carries
// the screen quad with a transform that cancels its parents, so it lies face-up on the desk at the world origin
// instead of on the lid (room3d.json says the same: screen.centre [0, 0, 0], normal [0, 1, 0]). Its vertices are the
// lid's own flat frame, so when it is found lying on the desk it is seated on the flat part beside it that it fits
// on (the lid's glass), a hair above it. A screen that already stands on the laptop is never touched.
function reseatScreen(mesh, deskY) {
  const f = screenFrame(mesh)
  if (f.normal.y < 0.99 || Math.abs(f.center.y - deskY) > 0.003 || !mesh.parent) return false
  const inv = new THREE.Matrix4().copy(mesh.parent.matrixWorld).invert(), m = new THREE.Matrix4()
  mesh.geometry.computeBoundingBox()
  const quad = mesh.geometry.boundingBox
  let top = null
  for (const sib of mesh.parent.children) {
    if (sib === mesh) continue
    const box = new THREE.Box3()
    sib.traverse((o) => { if (o.isMesh) { o.geometry.computeBoundingBox(); box.union(o.geometry.boundingBox.clone().applyMatrix4(m.multiplyMatrices(inv, o.matrixWorld))) } })
    if (!box.isEmpty() && box.min.x <= quad.min.x && box.max.x >= quad.max.x && box.min.z <= quad.min.z && box.max.z >= quad.max.z && (top == null || box.max.y > top)) top = box.max.y
  }
  if (top == null) return false
  mesh.position.set(0, top + 0.0003, 0); mesh.quaternion.identity(); mesh.scale.set(1, 1, 1)
  mesh.updateWorldMatrix(true, true)
  return true
}

export async function mount(root, { theme, onHover, onPick, onLost }) {
  const contract = await loadContract()
  const small = matchMedia('(max-width: 1023px), (hover: none) and (pointer: coarse)').matches
  const canvas = document.createElement('canvas')
  canvas.className = 'r3d'; canvas.setAttribute('aria-hidden', 'true')
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, stencil: false, powerPreference: 'high-performance' })
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace          // the atlases are already the film's display values: nothing is converted or tone-mapped after them
  renderer.toneMapping = THREE.NoToneMapping
  const gltf = await retry(() => new GLTFLoader().loadAsync(contract.glb))
  const scene = new THREE.Scene()
  scene.add(gltf.scene)
  scene.updateMatrixWorld(true)
  scene.matrixWorldAutoUpdate = false                             // the loop updates it once a frame, not once for each of the four pictures drawn
  const camera = new THREE.PerspectiveCamera(17, 16 / 9, 0.05, 300)
  camera.layers.enable(GLOW_LAYER); camera.layers.enable(GLASS_LAYER)

  const things = createThings(scene, camera, contract)
  const look = createLook(renderer, contract, small)
  // which mesh is the laptop's screen and which is the desk top: by name from the json, else by material kind
  const kindOf = (m) => m.material && (m.material.userData.kind || (contract.materials[m.material.userData.src] || contract.materials[m.material.name] || {}).kind)
  const meshIn = (name, kind) => {
    const n = name && scene.getObjectByName(name)
    let hit = null, any = null
    if (n) n.traverse((m) => { if (!m.isMesh) return; any ||= m; if (!hit && kindOf(m) === kind) hit = m })
    return hit || any
  }
  const firstOf = (kind) => { let found = null; scene.traverse((m) => { if (!found && m.isMesh && kindOf(m) === kind) found = m }); return found }
  const screenMesh = meshIn(contract.screen.node, 'screen') || firstOf('screen'), mirrorMesh = meshIn(contract.mirror.node, 'mirror') || firstOf('mirror')
  scene.traverse((m) => {
    if (!m.isMesh) return
    const kind = look.dress(m, things.groupOf(m), m === screenMesh ? 'screen' : m === mirrorMesh ? 'mirror' : null)
    if (kind === 'glow' || kind === 'screen') m.layers.set(GLOW_LAYER)      // drawn alone into the bloom's picture
    if (kind === 'glass') m.layers.set(GLASS_LAYER)                        // never hides a glow
  })
  const reseated = !!screenMesh && reseatScreen(screenMesh, contract.mirror.height ?? 0)
  const wall = createWall(scene, look, things, contract, camera)  // his pictures on the wall and the lamp's word (wall.js): lit by the same atlases, so the theme blends move them too
  const screen = screenMesh ? screenFrame(screenMesh) : null
  const rig = createRig(camera, contract, scene, screen)
  const mirrorY = contract.mirror.height ?? (mirrorMesh ? new THREE.Box3().setFromObject(mirrorMesh).max.y : 0)
  const mirror = mirrorMesh ? createMirror(renderer, scene, look, mirrorMesh, mirrorY) : null
  const bloom = createBloom(renderer, scene, look)
  // depth of field: the film's own lens (its focal length over its f-number is the opening), focused on the laptop's
  // screen, on whatever the pointer is on, and on the screen all the way down the dive. Computers only until it has
  // been measured on a real tablet; ?lens=1 turns it on anywhere and ?lens=0 off.
  const cam0 = Object.values(contract.cameras)[0] || {}
  const aperture = (cam0.lens && cam0.fstop ? cam0.lens / 1000 / cam0.fstop : 0.0121) * 1.25      // a little wider than the film's: a blur made of soft copies under-reads at edges beside a true disc
  const lensWanted = /[?&]lens=0/.test(location.search) ? false : !small || /[?&]lens=1/.test(location.search)
  const focus = new Damp(2.8, 0.35)
  let focused = false
  const lamp = things.by('themes'), egg = things.records.find((r) => r.node.name === contract.ball.node)
  if (lamp) look.U.uLampPos.value.copy(lamp.centre)

  // the laptop shows the site's own desktop wallpaper, cropped as the desktop itself will crop it
  let picAspect = 16 / 9
  const cover = (box, scale, off) => { const sx = box < picAspect ? box / picAspect : 1, sy = box < picAspect ? 1 : picAspect / box; scale.set(sx, sy); off.set((1 - sx) / 2, (1 - sy) / 2) }
  const pictures = !screen ? Promise.resolve() : Promise.all([look.picture(wallpaper()), look.picture('media/wallpaper/bloom-map.png', { mips: false })]).then(([img, fold]) => {
    picAspect = img.image.width / img.image.height
    look.U.uImg.value = img; look.U.uFold.value = fold
    cover(screen.width / screen.height, look.U.uCoverQ.value, look.U.uOffQ.value)
    resize()
  }).catch(() => {})                                            // without the picture the screen is a dark glass, not a broken room
  if (screen) look.U.uVis.value = screen.vis

  // ---- size and quality ---------------------------------------------------------------------------------
  let tier = 0, W = 0, H = 0
  function resize() {
    const w = root.clientWidth, h = root.clientHeight
    if (!w || !h) return
    const budget = small ? 4.4e6 : 5.6e6                         // real pixels drawn a frame: 2560 x 1440 at 1:1 on a computer, a dense tablet a little under its own
    const ratio = Math.min(devicePixelRatio || 1, 2, Math.sqrt(budget / (w * h))) * TIERS[tier].scale
    renderer.setPixelRatio(ratio)
    renderer.setSize(w, h, false)
    W = canvas.width; H = canvas.height
    rig.resize(w / h)
    if (mirror) mirror.resize(W, H, TIERS[tier].mirror)
    bloom.resize(W, H)
    cover(w / h, look.U.uCoverV.value, look.U.uOffV.value)
  }
  const watcher = new ResizeObserver(resize)
  watcher.observe(root)

  // ---- the loop -----------------------------------------------------------------------------------------
  let raf = 0, last = 0, running = false, flying = null, dead = false, current = theme, wanted = theme, relighting = null
  const times = new Float32Array(120)
  let ti = 0, filled = 0, cool = 240, drawn = 0
  const waiting = []
  function frame(now) {
    raf = requestAnimationFrame(frame)
    if (document.hidden || root.hidden) { last = 0; return }
    const ms = last ? now - last : 16.7, dt = Math.min(0.05, ms / 1000)
    last = now
    tick(dt * 1000)
    input.frame(dt)
    things.update(dt, input.ptr, flying)
    wall.update(dt)
    scene.updateMatrixWorld()
    if (screen) { screen.refresh(); look.seeScreen(screen) }
    if (egg) look.seeBall(egg.centre, contract.ball.radius || egg.bound)
    rig.update(dt)
    look.U.uTurn.value = ((now / 1000) % WALL_LOOP) / WALL_LOOP
    const docked = rig.fill < 1 ? rig.dive : 0
    look.U.uDive.value = rig.fill < 1 ? 0 : rig.dive                // docked, the lid keeps its black edge and its own picture
    look.U.uWake.value = docked                                    // the glass at full brightness while the desktop is on it
    look.U.uSpill.value = docked                                   // and its light on the keys and the desk
    if (glue && screen) glue(glass())
    if (mirror) mirror.render(camera)
    const glow = TIERS[tier].bloom
    if (glow) bloom.render(camera)
    if (lensWanted && TIERS[tier].lens) {
      const hot = things.hot, sharp = hot ? hot.centre : flying && flying !== things.laptop ? flying.centre : screen ? screen.center : rig.homes[rig.theme].target
      focus.to = camera.position.distanceTo(sharp)
      if (!focused || rig.dive > 0) { focus.set(focus.to); focused = true } else focus.step(dt)      // down the dive the screen is held sharp exactly, and the room round it melts
      bloom.throughLens(camera, focus.x, aperture * (1 + 0.6 * docked), glow)      // docked: the room round the laptop a little softer
    } else {
      renderer.setRenderTarget(null)
      renderer.render(scene, camera)
      if (glow) bloom.compose()
    }
    drawn++
    while (waiting.length) waiting.pop()()
    // too slow for this screen: step the quality down once, and stay there (BREAKDOWN.md 3.6)
    times[ti] = ms; ti = (ti + 1) % times.length; filled = Math.min(times.length, filled + 1)
    if (--cool < 0 && filled === times.length && tier < TIERS.length - 1) {
      let sum = 0
      for (const t of times) sum += t
      if (sum / times.length > 21) { tier++; cool = 240; filled = 0; resize() }
    }
  }
  const nextFrame = () => new Promise((r) => waiting.push(r))

  // ---- the desktop on the glass (js/laptop.js) ---------------------------------------------------------------
  // Every frame, from the live camera: the lit glass's four corners on the page (CSS px: top-left, top-right,
  // bottom-right, bottom-left of the picture), how square on the eye is, and where the lamp's reflection falls on it
  // (0..1 across and down the glass, and whether the lamp is in front of the glass at all), and the eye's offset
  // from the glass's middle (in glass widths across, heights down).
  let glue = null
  const G = new Float64Array(14), cv = new THREE.Vector3(), lampAt = new THREE.Vector3(), ray = new THREE.Vector3(), SX = [-1, 1, 1, -1], SY = [1, 1, -1, -1]
  function glass() {
    const hw = (screen.width - 2 * RIM) / 2, hh = (screen.height - 2 * RIM) / 2, cw = root.clientWidth, ch = root.clientHeight
    for (let i = 0; i < 4; i++) {
      cv.copy(screen.center).addScaledVector(screen.right, SX[i] * hw).addScaledVector(screen.up, SY[i] * hh).project(camera)
      G[i * 2] = (cv.x + 1) / 2 * cw; G[i * 2 + 1] = (1 - cv.y) / 2 * ch
    }
    cv.copy(camera.position).sub(screen.center)
    G[8] = Math.max(0, cv.dot(screen.normal) / cv.length())
    G[12] = cv.dot(screen.right) / (2 * hw); G[13] = -cv.dot(screen.up) / (2 * hh)
    G[11] = 0
    if (lamp) {
      const front = lampAt.copy(lamp.centre).sub(screen.center).dot(screen.normal)
      if (front > 0) {
        lampAt.copy(lamp.centre).addScaledVector(screen.normal, -2 * front)       // the lamp seen in the glass: its mirror image behind it
        ray.copy(lampAt).sub(camera.position)
        const t = cv.copy(screen.center).sub(camera.position).dot(screen.normal) / ray.dot(screen.normal)
        cv.copy(camera.position).addScaledVector(ray, t).sub(screen.center)
        G[9] = cv.dot(screen.right) / (2 * hw) + 0.5; G[10] = 0.5 - cv.dot(screen.up) / (2 * hh); G[11] = 1
      }
    }
    return G
  }
  function start() { if (running || dead) return; running = true; last = 0; cool = 240; filled = 0; raf = requestAnimationFrame(frame) }
  function stop() { running = false; cancelAnimationFrame(raf) }

  const input = createInput(canvas, root, { rig, things, onHover: (rec) => onHover(rec ? rec.id : null, rec), onPick: (rec) => onPick(rec.opens, rec.id) })
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); dead = true; stop(); onLost && onLost() })

  await look.setPair(theme, theme)
  look.setMix(0)
  rig.place(theme)
  root.querySelector('.frame').after(canvas)
  resize()
  await Promise.all([pictures, wall.ready])
  renderer.compile(scene, camera)
  start()
  await nextFrame()
  setTimeout(() => warmNext(), 1500)

  // ---- a theme change: the light blends while the camera travels the film's path to that theme's home -----
  async function relight() {
    while (wanted !== current && !dead) {
      const to = wanted, from = current
      await look.loadTheme(to)                                  // decoded and uploaded before anything moves
      if (root.hidden || !running) { await look.setPair(to, to); look.setMix(0); rig.place(to); current = to; continue }
      await look.setPair(from, to)
      look.setMix(0)
      await rig.travel(to, (k) => look.setMix(k))
      await look.setPair(to, to)
      look.setMix(0)
      current = to
    }
    warmNext()
  }
  // the theme the lamp gives next is fetched, decoded and uploaded while the room rests, so a click on the lamp moves at once
  // (a computer only: a phone keeps two themes in memory)
  function warmNext() {
    if (small || dead) return
    const ids = Object.keys(contract.themes).filter((id) => rig.homes[id]), next = ids[(ids.indexOf(current) + 1) % ids.length]
    const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 600))
    setTimeout(() => idle(() => { if (dead || relighting) return; if (rig.busy || rig.dive > 0 || !input.enabled) return warmNext(); look.loadTheme(next).catch(() => {}) }, { timeout: 2500 }), 900)      // not in the breath after a move: the upload costs a few frames
  }

  const api = {
    contract, canvas, camera, rig, things, look,
    start, stop,
    tag: () => (contract.standin ? 'Stand-in 3D scene: plain shapes until the real export is here' : !contract.baked ? 'Live 3D, first pass: the baked light has not arrived yet' : ''),
    set live(v) { input.enabled = v; if (!v) { things.calm(); onHover(null, null) } },
    get live() { return input.enabled },
    setTheme(id) {
      if (!contract.themes[id] || !rig.homes[id]) return Promise.resolve()
      wanted = id
      if (!relighting) relighting = relight().finally(() => { relighting = null; if (wanted !== current && !dead) api.setTheme(wanted) })
      return relighting
    },
    light(id, on) { things.force(id, on) },
    sweep() { things.sweep() },
    // into the laptop: resolves when the screen exactly fills the view and that frame is on the glass
    async dive() {
      api.live = false
      flying = things.laptop || null
      rig.setFill(1)
      await rig.fly(1)
      await nextFrame()
    },
    // to the laptop and no further: the screen's glass `fill` of the view's height, the room still round it.
    // onGlass(fn): fn(G) is called every frame with the glass on the page (glass() above); null stops it.
    glassSize: () => (screen ? [screen.width - 2 * RIM, screen.height - 2 * RIM] : [3, 2]),
    onGlass(fn) { glue = fn; if (fn && screen) fn(glass()) },
    // the desktop's glass panels, frosted and bent on the screen itself (look.js): up to five boxes in the desktop's
    // own pixels [x0, y0, x1, y1, corner radius, how much it shows], and the desktop's size
    panels(list, w, h) {
      look.U.uDesk.value.set(w, h)
      for (let i = 0; i < 5; i++) { const p = list[i]; look.U.uPanel.value[i].set(p ? p[0] : 0, p ? p[1] : 0, p ? p[2] : 0, p ? p[3] : 0); look.U.uPanelK.value[i].set(p ? p[4] : 0, p ? p[5] : 0, 0, 0) }
    },
    async dock(fill) {
      api.live = false
      flying = things.laptop || null
      rig.setFill(fill)
      await rig.fly(1)
    },
    async undock() {
      flying = things.laptop || null
      rig.lean(0, 0)
      start()
      await rig.fly(0)
      rig.setFill(1)
      flying = null
      api.live = true
    },
    lean(x, y) { rig.lean(x, y) },
    // the top middle of an object as the camera sees it, in CSS px of the stage: where its name tip stands
    top(id) {
      const rec = things.by(id)
      if (!rec) return null
      const box = new THREE.Box3().setFromObject(rec.node), v = new THREE.Vector3(), c = rec.centre.clone().project(camera)
      let y = Infinity
      for (let i = 0; i < 8; i++) { v.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).project(camera); y = Math.min(y, (1 - v.y) / 2 * root.clientHeight) }
      return [(c.x + 1) / 2 * root.clientWidth, y]
    },
    // back out: the room appears already inside the screen, then the camera pulls away
    async rise() {
      rig.setDive(1); rig.setApproach(0); rig.setFill(1)
      flying = things.laptop || null
      start()
      await nextFrame()
      await new Promise((r) => setTimeout(r, 160))
      await rig.fly(0)
      flying = null
      api.live = true
    },
    // toward an object whose place opens over the room, and back from it
    async approach(id) {
      const rec = things.by(id)
      api.live = false
      if (!rec) return
      flying = rec
      await rig.approachTo(rec.centre, rec.bound, 1)
    },
    async retreat() {
      start()
      await rig.approachTo(null, 0, 0)
      flying = null
      api.live = true
    },
    reset() { rig.setDive(0); rig.setApproach(0); rig.setFill(1); flying = null },
    stats: () => { let sum = 0, worst = 0; for (let i = 0; i < filled; i++) { sum += times[i]; worst = Math.max(worst, times[i]) } return { fps: filled ? 1000 / (sum / filled) : 0, worst, frames: drawn, tier, lens: lensWanted && TIERS[tier].lens, width: W, height: H, baked: contract.baked, standin: contract.standin, reseated, triangles: renderer.info.render.triangles, calls: renderer.info.render.calls } },
    destroy() { dead = true; stop(); watcher.disconnect(); input.dispose(); if (mirror) mirror.dispose(); bloom.dispose(); canvas.remove(); renderer.dispose() },
  }
  window.__r3d = api                                            // for site/tools checks (frames a second, state); nothing on the page reads it
  return api
}
