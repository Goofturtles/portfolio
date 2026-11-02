// The guide (the realistic tortoise, character/turtle.py), where the live room cannot hold him (Arjun, 2026-11-01: "I want the arjun character to be 3d
// too"): on the mini desktop (its one-time tip) and on a device that shows the still picture of the room. The same
// model as the figure on the desk (media/room3d/arjun.glb, made by character/arjun.py), in its own small canvas, lit
// like a studio shot: a soft sky, a key from the front left, the room's lavender and pink from behind.
//
// The same face to js/guide.js as the drawing it stands in for (js/guide/arjun.js):
//   const g = createArjun3d()        // null where WebGL is missing: keep the drawing there
//   g.el                             // sized by --ga-h (its height), feet on its bottom edge, centred
//   g.pose('idle'|'walk'|'point'|'wave'|'cheer'|'talk')   g.face(1 | -1)   g.point(deg)   g.mouth(0..1)
//   g.walkSpeed (px/s), g.stepMs, g.stride (heights a step): walked at that speed, the planted shoe does not slide
// It draws only while it is on the page and seen; it lets go of its WebGL context in destroy().
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { reduced } from '../config.js'

const SRC = 'media/room3d/turtle.glb'
const FRAME = 0.9                       // the canvas is this many units tall (his carapace is 1 unit long, his shell's top 0.52 up)
const ASPECT = 1.7                      // its width over its height: room for him side on, head out
const WALK_UNITS = 0.1882, WALK_RATE = 2.6, STEP_S = 0.25 / WALK_RATE    // character/turtle.py: a cycle of four footfalls

export function createArjun3d() {
  const el = document.createElement('div')
  el.className = 'ga ga3'
  el.setAttribute('aria-hidden', 'true')
  const canvas = el.appendChild(document.createElement('canvas'))
  let renderer
  try { renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' }) } catch (e) { return null }
  if (!renderer.getContext()) return null
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.setClearColor(0x000000, 0)
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(16, ASPECT, 0.5, 20)
  const dist = FRAME / 2 / Math.tan(THREE.MathUtils.degToRad(8))
  camera.position.set(0, FRAME / 2 + dist * 0.12, dist); camera.lookAt(0, FRAME / 2 - 0.08, 0)
  scene.add(new THREE.HemisphereLight(0xe6ecff, 0x6d6078, 1.35))
  const key = new THREE.DirectionalLight(0xfff4ea, 1.9); key.position.set(-1.2, 2.2, 2.4); scene.add(key)
  const rimA = new THREE.DirectionalLight(0xb2a8f4, 1.4); rimA.position.set(-2, 1.4, -2); scene.add(rimA)
  const rimB = new THREE.DirectionalLight(0xff9bd2, 1.1); rimB.position.set(2, 1.2, -1.6); scene.add(rimB)
  const holder = new THREE.Group(); scene.add(holder)

  let failed = false
  let model = null, mixer = null, clips = {}, base = null, baseName = '', once = null
  let yaw = 0, yawTo = 0, facing = 1, mouthV = 0, blinkT = 2, blink = 0, eyes = [], jaw = null, walking = false
  new GLTFLoader().loadAsync(SRC).then((g) => {
    model = g.scene
    model.traverse((m) => {
      if (!m.isMesh) return
      if (/^m_eye/.test(m.name)) eyes.push(m)
      if (m.material && /shine/.test(m.material.name)) { m.material.emissive = new THREE.Color(1, 1, 1); m.material.emissiveIntensity = 0.9 }
    })
    holder.add(model)
    jaw = model.getObjectByName('jaw')
    mixer = new THREE.AnimationMixer(model)
    for (const c of g.animations) clips[c.name] = c
    setBase(want)
  }).catch(() => { failed = true })

  let want = 'idle'
  // with reduced motion he holds still poses (the drawing did): each clip shown at one frame, nothing playing
  function still(a, name) { a.time = name === 'point' ? a.getClip().duration : a.getClip().duration * 0.25; a.paused = true }
  function setBase(name) {
    want = name
    if (!mixer || !clips[name]) return
    if (reduced()) { mixer.stopAllAction(); const a = mixer.clipAction(clips[name]); a.reset().play(); still(a, name); mixer.update(0); base = a; baseName = name; once = null; return }
    if (once) { once.fadeOut(0.2); once = null }
    if (baseName === name && base) { base.reset(); base.fadeIn(0.2).play(); return }
    const a = mixer.clipAction(clips[name])
    a.reset(); a.setLoop(THREE.LoopRepeat, Infinity); a.setEffectiveTimeScale(name === 'walk' ? WALK_RATE : 1); a.setEffectiveWeight(1)
    if (base) { a.play(); base.crossFadeTo(a, 0.22, false) } else a.play()
    base = a; baseName = name
  }
  function hold(name) {
    if (!mixer || !clips[name]) return
    if (reduced()) return setBase(name)
    const a = mixer.clipAction(clips[name])
    if (once && once !== a) once.fadeOut(0.18)
    a.reset(); a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; a.setEffectiveWeight(1)
    a.fadeIn(0.18).play()
    if (base) base.fadeOut(0.18)
    once = a
  }

  // drawn while on the page and seen
  let raf = 0, last = 0, w = 0, h = 0
  function frame(now) {
    raf = 0
    const cw = el.clientWidth, ch = el.clientHeight
    if (!el.isConnected || !cw || !ch) { last = 0; return }          // hidden: the loop stops; the size watcher starts it again
    raf = requestAnimationFrame(frame)
    if (document.hidden) { last = 0; return }
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016
    last = now
    if (cw !== w || ch !== h) { w = cw; h = ch; renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1)); renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix() }
    yaw += (yawTo - yaw) * (1 - Math.exp(-dt * 10))
    holder.rotation.y = yaw
    if (mixer && !reduced()) mixer.update(dt)
    blinkT -= dt
    if (blinkT < 0) { blink = 0.16; blinkT = 2 + Math.random() * 4 }
    blink = Math.max(0, blink - dt)
    const shut = blink > 0 ? Math.sin(Math.PI * (1 - blink / 0.16)) : 0
    for (const e of eyes) e.scale.y = 1 - 0.88 * shut
    if (jaw && mouthV > 0.001) {                 // his voice opens his jaw, about his head's side axis
      jaw.updateWorldMatrix(true, false)
      const qa = jaw.parent.getWorldQuaternion(new THREE.Quaternion()).invert(), qb = jaw.getWorldQuaternion(new THREE.Quaternion())
      const ax = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw))
      jaw.quaternion.copy(qa.multiply(new THREE.Quaternion().setFromAxisAngle(ax, 0.42 * mouthV).multiply(qb)))
    }
    renderer.render(scene, camera)
  }
  const wake = () => { if (!raf) raf = requestAnimationFrame(frame) }
  const watch = new ResizeObserver(wake); watch.observe(el)
  wake()
  const turn = () => { yawTo = facing * (walking ? Math.PI / 2 : 0.6) }

  return {
    el,
    solo: true,
    get failed() { return failed },
    pose(name) {
      walking = name === 'walk'; turn()
      if (name === 'point') return hold('point')
      setBase(clips[name] || !mixer ? name : 'idle')
    },
    face(d) { facing = d < 0 ? -1 : 1; turn() },
    point() {},                                   // the point clip's own arm; he turns toward what he shows
    mouth(v) { mouthV = Math.max(0, Math.min(1, v)) },
    look() {},
    get stride() { return WALK_UNITS * WALK_RATE * STEP_S / FRAME },
    get stepMs() { return STEP_S * 1000 },
    get walkSpeed() { return (WALK_UNITS * WALK_RATE / FRAME) * el.clientHeight },
    destroy() { cancelAnimationFrame(raf); watch.disconnect(); renderer.dispose(); renderer.forceContextLoss(); el.remove() },
  }
}
