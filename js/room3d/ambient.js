// The room at rest is never still (film/SPEC.md "Never static"). What moves on its own, so the desk feels lived in
// even when nobody touches it:
//   dust      a few hundred motes drifting through the air over the desk, brighter where the lamp lights them, wider
//             and softer where the lens has them out of focus (the same lens as post.js). Drawn on the glass layer:
//             added to the light that is there, never hiding a glow, and mirrored by the desk like everything else.
//   the ring  AI Arjun's ring wakes now and then: a soft light runs once round it, as an assistant's does when it
//             listens; pointed at, it keeps running.
//   idle      after a while with no hand on the room, the light sweeps across the objects again (they are the
//             buttons), and the egg is given a small nudge now and then, rolls a few centimetres and settles.
// (The flowers' breeze and the ring's slow turn are in things.js; the lamp and the tube breathing in look.js; the
// résumé frame's light in wall.js.) Everything here runs on the graphics card or costs a few multiplications a frame.
import * as THREE from 'three'
import { GLASS_LAYER } from './post.js'

const DUST_VERT = `
precision highp float;
uniform mat4 modelViewMatrix, projectionMatrix;
uniform float uTime, uPx, uFocus, uAperture, uMix, uFade;
uniform vec3 uLo, uSize, uLampPos, uLampA, uLampB, uSkyA, uSkyB;
in vec3 position;                 // where in the box, 0..1 on each axis
in vec4 seed;                     // x: size, y and z: phases, w: speed (0..1 each)
out vec3 vC; out float vSoft;
const float TAU = 6.28318530718;
void main() {
  float t = uTime;
  // a slow draught across the desk, a lazy rise or fall, and a little curl of its own
  vec3 drift = vec3(.0045 * (.6 + seed.w), (.0012 + .002 * seed.w) * (seed.y > .5 ? 1. : -.8), .0011 * (seed.z - .5)) * t;
  vec3 curl = .011 * vec3(sin(t * (.21 + .17 * seed.w) + TAU * seed.y), sin(t * (.17 + .13 * seed.z) + TAU * seed.z), cos(t * (.19 + .11 * seed.y) + TAU * seed.w));
  vec3 f = fract(position + (drift + curl) / uSize);
  vec3 e = smoothstep(0., .1, f) * smoothstep(1., .9, f);            // it fades where the box wraps round: nothing pops
  vec3 p = uLo + f * uSize;
  vec4 mv = modelViewMatrix * vec4(p, 1.);
  float d = max(-mv.z, .05);
  float s = (.0022 + .0034 * seed.x) * uPx / d;                       // its own size on the screen, in pixels
  float coc = abs(1. / d - 1. / uFocus) * uPx * uAperture;             // out of focus: the lens's disc
  float size = clamp(sqrt(s * s + coc * coc), 1.5, 26.);
  vSoft = clamp(coc / size, 0., 1.);
  vec3 L = uLampPos - p;
  float lamp = .025 / (dot(L, L) + .025);
  vec3 lit = mix(uSkyA, uSkyB, uMix) * .3 + mix(uLampA, uLampB, uMix) * lamp * .9;
  float tw = .4 + .6 * pow(.5 + .5 * sin(t * (.5 + 1.2 * seed.z) + TAU * seed.y), 2.);      // it turns and catches the light
  vC = lit * tw * e.x * e.y * e.z * uFade * min(1., s * s / (size * size) * 1.6 + .22);      // a wide soft disc spreads the same light thinner
  gl_Position = projectionMatrix * mv;
  gl_PointSize = size;
}`
const DUST_FRAG = `
precision highp float;
in vec3 vC; in float vSoft;
out vec4 frag;
void main() {
  float r = length(gl_PointCoord - .5) * 2.;
  float a = mix(pow(max(1. - r, 0.), 1.7), smoothstep(1., .72, r) * .75, vSoft);
  if (a <= .002) discard;
  frag = vec4(vC * a, 0.);                                            // colour added; alpha (the distance post.js reads) kept
}`

export function createAmbient({ scene, camera, look, things, contract, small }) {
  const U = look.U, deskY = contract.mirror.height ?? 0
  let time = 0, fade = 0, lastSweep = -1e9, nudgeAt = 18, quiet = false

  // ---- dust: a box over the desk, a little in front of it, up to about the top of the wall pictures ----
  const out = contract.desk.outline && contract.desk.outline.length > 2 ? contract.desk.outline : [[-0.6, -0.4], [0.9, -0.4], [0.9, 0.45], [-0.6, 0.45]]
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity
  for (const [x, z] of out) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z) }
  const lo = new THREE.Vector3(x0 - 0.08, deskY + 0.01, z0), size = new THREE.Vector3(x1 - x0 + 0.16, 0.56, z1 - z0 + 0.32)
  const N = small ? 150 : 300, pos = new Float32Array(N * 3), seed = new Float32Array(N * 4)
  for (let i = 0; i < N; i++) {
    pos.set([Math.random(), Math.pow(Math.random(), 1.35), Math.random()], i * 3)      // a few more low down, where the lamp is
    seed.set([Math.random(), Math.random(), Math.random(), Math.random()], i * 4)
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.setAttribute('seed', new THREE.BufferAttribute(seed, 4))
  const dustU = { uTime: { value: 0 }, uPx: { value: 1000 }, uFocus: { value: 2.7 }, uAperture: { value: 0 }, uFade: { value: 0 }, uLo: { value: lo }, uSize: { value: size },
    uMix: U.uMix, uLampPos: U.uLampPos, uLampA: U.uLampA, uLampB: U.uLampB, uSkyA: U.uSkyA, uSkyB: U.uSkyB }
  const mat = new THREE.RawShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: DUST_VERT, fragmentShader: DUST_FRAG, uniforms: dustU, transparent: true, depthWrite: false,
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor })
  const dust = new THREE.Points(geo, mat)
  dust.name = 'ambient_dust'; dust.frustumCulled = false; dust.renderOrder = 3
  dust.layers.set(GLASS_LAYER)
  scene.add(dust)
  dust.updateMatrixWorld(true)

  // ---- the ring's light: its meshes' glow shaders take a pulse (look.js); its plane is read off the ring itself ----
  const ring = things.by('ai'), pulses = []
  let ringMesh = null
  const rc = new THREE.Vector3(), ra = new THREE.Vector3(), rb = new THREE.Vector3(), lc = new THREE.Vector3(), la = new THREE.Vector3(), lb = new THREE.Vector3()
  if (ring) {
    ring.node.traverse((m) => {
      if (!m.isMesh || !m.material.uniforms || !m.material.uniforms.uPulse) return
      pulses.push(m.material.uniforms)
      if (!ringMesh || /ring$/i.test(m.name)) ringMesh = m
    })
    if (ringMesh) {
      ringMesh.geometry.computeBoundingBox()
      const b = ringMesh.geometry.boundingBox, ext = b.getSize(new THREE.Vector3()).toArray(), thin = ext.indexOf(Math.min(...ext))
      b.getCenter(lc)
      const axes = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)].filter((_, i) => i !== thin)
      la.copy(axes[0]); lb.copy(axes[1])
    }
  }
  const PULSE_EVERY = 7.5, PULSE_RUN = 1.9
  let pulseT = -3, pulsing = false

  function ringLight(dt, hot) {
    if (!pulses.length || !ringMesh) return
    pulseT += dt
    const every = hot ? 1.5 : PULSE_EVERY
    if (pulseT > every) pulseT = 0
    const k = Math.min(1, Math.max(0, pulseT / PULSE_RUN))
    const env = pulseT < PULSE_RUN ? Math.sin(Math.PI * k) ** 0.8 : 0                // in, round once, out
    pulsing = env > 0
    rc.copy(lc).applyMatrix4(ringMesh.matrixWorld)
    ra.copy(la).transformDirection(ringMesh.matrixWorld); rb.copy(lb).transformDirection(ringMesh.matrixWorld)
    const head = -Math.PI / 2 + 2 * Math.PI * (1 - (1 - k) * (1 - k))              // from the foot, round, easing out
    for (const u of pulses) { u.uPulse.value.set(head, env * (hot ? 0.9 : 0.75), 0, 0); u.uRingC.value.copy(rc); u.uRingA.value.copy(ra); u.uRingB.value.copy(rb) }
  }

  // ---- idle: the sweep of light and the egg's nudge ----
  function idle(dt, { idleFor, live, busy }) {
    if (quiet || !live || busy) { if (!live || busy) nudgeAt = Math.max(nudgeAt, time + 8); return }
    if (idleFor > 14 && time - lastSweep > 34) { things.sweep(); lastSweep = time }
    if (idleFor > 6 && time > nudgeAt) {
      things.nudge()
      nudgeAt = time + 22 + Math.random() * 16
    }
  }

  return {
    dust,
    get pulsing() { return pulsing },
    // quiet: the guide is showing the room round (js/guide.js): no sweeps, no nudges under him
    set quiet(v) { quiet = !!v },
    update(dt, { focus, aperture, px, dive, live, busy, idleFor }) {
      time += dt
      fade = Math.min(1, fade + dt / 2.5)                                            // the dust settles in over the first seconds
      dustU.uTime.value = time
      dustU.uPx.value = px; dustU.uFocus.value = Math.max(0.3, focus); dustU.uAperture.value = aperture
      dustU.uFade.value = fade * (1 - THREE.MathUtils.smoothstep(dive, 0, 0.35))       // flying into the laptop, the air in front of the lens clears
      ringLight(dt, things.hot === ring || (ring && ring.forced > 0))
      idle(dt, { idleFor, live, busy })
    },
    dispose() { scene.remove(dust); geo.dispose(); mat.dispose() },
  }
}
