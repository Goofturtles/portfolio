// Mini Arjun in the room itself (Arjun, 2026-11-01: "I want the arjun character to be 3d", "make the arjun character
// like actually animated and cool use blender ... for real 3d effect", then "make it like a turtle instead coz i like
// turtles", "make it a realistic turtle not cartoon realistic, like on 4 legs and all", then "USE A REAL TURTLE MODEL"
// with the one he chose: "Tortoise - turtle" by Daniel Zuleta Art, CC BY 4.0, https://skfb.ly/ouHBU). The guide is that
// textured tortoise, rigged and animated for the room (character/real/rig.py), about 21 cm snout to tail, ON the desk: lit by the room's own light in every theme, mirrored by the lacquer, hidden by what stands
// in front of him, his shadow on the desk. Made in Blender from code (character/arjun.py -> media/room3d/arjun.glb):
// rigid rounded parts on an armature, eight clips (idle walk hop wave point cheer talk react). What the site adds live:
//   moving   he finds his way round the things on the desk (a grid over the desk, the same footprints the egg rolls
//            round), walks short trips at his own stride (the planted shoe does not slide) and hops longer ones
//   face     his mouth opens with his voice and he blinks (both squash a part along his head's own up, in the shader);
//   look     he looks like a person does: his eyes get there first, then his head follows on a soft spring with his
//            neck and chest each taking a share of the turn, tilting a little into it; what is too far round for his
//            neck he turns his whole body to. He looks at what he talks about, else the pointer, else you (the camera),
//            his eyes wandering a little now and then
//   reacts   press him and he startles; the egg rolling into him makes him jump, and he kicks it on his way past;
//            his head follows the pointer round the room when nothing else holds his eye
//   sound    his voice and his steps come from where he stands (Web Audio, HRTF, the listener at the camera), once a
//            press has let audio in; landing a hop he puffs up the dust (ambient.js) and a little of his own
// js/guide.js tells him where to go and what to do; this file only knows the room.
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { GLASS_LAYER } from './post.js'

const SRC = 'media/room3d/tortoise.glb'
const S = 0.14                            // metres a unit: he is 1.5 units snout to tail (character/real/prep.py)
const HEIGHT = 0.71 * S                   // to the top of his shell
const WALK_UNITS = 0.2252                 // the walk clip's own speed, units a second (character/real/rig.py prints it)
const WALK_RATE = 1.9, RUN_RATE = 2.5     // the clip played a little brisker, faster on long trips; the root moves to match
const CELL = 0.02
const WALK_CLEAR = 0.085, WALK_EDGE = 0.07       // walking he faces the way he goes: half his width and a margin keep him off things
const STAND_CLEAR = 0.125, STAND_EDGE = 0.11     // where he stops he turns and faces things: half his length (0.21 m) and a grid cell's slack
const TAU = Math.PI * 2

const VERT = `
precision highp float;
uniform mat4 modelMatrix, viewMatrix, projectionMatrix;
uniform vec4 uSquash;   // xyz: the centre (world), w: 0 as made, >0 flatter, <0 taller
uniform vec3 uUp;       // his head's up, in the world
in vec3 position, normal;
#ifdef VCOL
in vec4 color;
out vec3 vCol;
#endif
#if defined(MAP) || defined(NMAP)
in vec2 uv;
out vec2 vUv;
#endif
#ifdef NMAP
in vec4 tangent;
out vec4 vT;
#endif
#ifdef SKIN
uniform mat4 bindMatrix, bindMatrixInverse;
uniform highp sampler2D boneTexture;
in vec4 skinIndex, skinWeight;
mat4 bone(const in float i) {
  int size = textureSize(boneTexture, 0).x, j = int(i) * 4, x = j % size, y = j / size;
  return mat4(texelFetch(boneTexture, ivec2(x, y), 0), texelFetch(boneTexture, ivec2(x + 1, y), 0), texelFetch(boneTexture, ivec2(x + 2, y), 0), texelFetch(boneTexture, ivec2(x + 3, y), 0));
}
#endif
out vec3 vW, vN;
void main() {
  vec4 p = vec4(position, 1.); vec3 n = normal;
#ifdef SKIN
  mat4 sk = bindMatrixInverse * (skinWeight.x * bone(skinIndex.x) + skinWeight.y * bone(skinIndex.y) + skinWeight.z * bone(skinIndex.z) + skinWeight.w * bone(skinIndex.w)) * bindMatrix;
  p = sk * p; n = mat3(sk) * n;
#endif
#ifdef VCOL
  vCol = pow(max(color.rgb, 0.), vec3(1. / 2.2));      // vertex colours, from linear
#endif
#if defined(MAP) || defined(NMAP)
  vUv = uv;
#endif
#ifdef NMAP
  vec3 tg = tangent.xyz;
  #ifdef SKIN
  tg = mat3(sk) * tg;
  #endif
  vT = vec4(mat3(modelMatrix) * tg, tangent.w);
#endif
  vec4 w = modelMatrix * p;
  if (uSquash.w != 0.) w.xyz -= uUp * dot(w.xyz - uSquash.xyz, uUp) * uSquash.w;
  vW = w.xyz; vN = mat3(modelMatrix) * n;
  gl_Position = projectionMatrix * viewMatrix * w;
}`
// lit the way the room lights what it did not bake (look.js UNBAKED): the theme's sky from above, its sun, the lamp
// close by; then the room itself round him (the panorama) as soft fill and as reflection, by how rough each part is,
// and the room's light catching his outline, so a small figure still reads against the desk
const FRAG = `
precision highp float;
uniform vec3 cameraPosition;
uniform sampler2D uEnvA, uEnvB;
uniform float uMix, uEnvYaw, uBloomPass, uHover, uFade, uRough, uEmit;
uniform vec2 uDepth;
uniform vec3 uColor, uSkyA, uSkyB, uSunA, uSunB, uSunDir, uLampPos, uLampA, uLampB;
in vec3 vW, vN;
#ifdef VCOL
in vec3 vCol;
#endif
#if defined(MAP) || defined(NMAP)
in vec2 vUv;
#endif
#ifdef MAP
uniform sampler2D uMap;
#endif
#ifdef NMAP
uniform sampler2D uNMap;
in vec4 vT;
#endif
out vec4 frag;
vec3 env(vec3 d, float lod) {
  vec2 e = vec2(atan(d.x, -d.z) / 6.28318530718 + .5 + uEnvYaw, .5 - asin(clamp(d.y, -1., 1.)) / 3.14159265359);
  return mix(textureLod(uEnvA, e, lod).rgb, textureLod(uEnvB, e, lod).rgb, uMix);
}
float far() { float d = length(vW - cameraPosition); return uDepth.x > 0. ? clamp(d * uDepth.x, 0., 1.) : clamp(uDepth.y / max(d, .001), 0., 1.); }
void main() {
  vec3 albedo = uColor;
#ifdef VCOL
  albedo *= vCol;
#endif
#ifdef MAP
  albedo *= pow(texture(uMap, vUv).rgb, vec3(1. / 2.2));      // the colour map (sRGB, read as linear), as display values
#endif
  if (uFade < .999 && fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(.06711056, .00583715)))) > uFade) discard;
  vec3 N = normalize(vN); if (!gl_FrontFacing) N = -N;
#ifdef NMAP
  vec3 T = normalize(vT.xyz - N * dot(N, vT.xyz)), Bt = cross(N, T) * vT.w;
  N = normalize(mat3(T, Bt, N) * (texture(uNMap, vUv).xyz * 2. - 1.));      // the scales and wrinkles of the scan
#endif
  vec3 V = normalize(cameraPosition - vW);
  vec3 sky = mix(uSkyA, uSkyB, uMix), sun = mix(uSunA, uSunB, uMix), lampC = mix(uLampA, uLampB, uMix);
  vec3 L = uLampPos - vW; float d2 = dot(L, L); vec3 Ld = L * inversesqrt(d2);
  float near = .02 / (d2 + .02);
  vec3 lamp = min(lampC * max((dot(N, Ld) + .3) / 1.3, 0.) * near, vec3(.7));
  float hemi = mix(.62, 1.08, N.y * .5 + .5);
  vec3 lit = sky * hemi * 1.25 + sun * max((dot(N, uSunDir) + .3) / 1.3, 0.) + lamp;
  lit = mix(lit, env(N, 6.5) * 1.3, .45);                                          // the room round him: it is bright, so is he
  vec3 c = albedo * lit;
  float nv = max(dot(N, V), 0.), f = .04 + .96 * pow(1. - nv, 5.);
  vec3 R = reflect(-V, N);
  c += env(R, uRough * 7.) * f * (1. - uRough) * .9;                               // the room in his hair, his shoes
  vec3 H = normalize(Ld + V);
  c += lampC * pow(max(dot(N, H), 0.), mix(6., 80., 1. - uRough)) * (1. - uRough) * near * .6;
  c += env(normalize(N - V * .5), 5.) * pow(1. - nv, 2.5) * .34;                  // the light behind him round his edge
  c += albedo * uEmit;
  c *= 1. + .1 * uHover;
  frag = vec4(c * (1. - uBloomPass), far());
}`
// his shadow on the desk: soft and darkest right under him, fainter as he leaves the desk in a hop. Not in the mirror.
const SHADOW_FRAG = `
precision highp float;
uniform vec2 uDepth;
uniform float uDark;
in vec2 vUv;
out vec4 frag;
void main() {
  if (uDepth.x > 0.) discard;
  float r = length(vUv - .5) * 2.;
  float k = (1. - smoothstep(0., .9, r)) * (1. - smoothstep(0., .9, r)) * uDark * 1.6;
  frag = vec4(vec3(1. - k), 1.);
}`
const SHADOW_VERT = `
precision highp float;
uniform mat4 modelViewMatrix, projectionMatrix;
in vec3 position; in vec2 uv;
out vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`

// the little puff where he lands: a ring of motes thrown out low over the desk, slowing, rising a hair, gone in 0.7 s
const PUFF_VERT = `
precision highp float;
uniform mat4 modelViewMatrix, projectionMatrix;
uniform vec3 uAt; uniform float uT, uPx;
in vec3 position; in vec4 seed;
out float vA;
void main() {
  float a = seed.x * 6.28318530718, k = 1. - exp(-uT * 5.);
  vec3 p = uAt + vec3(cos(a), .25 + .5 * seed.y, sin(a)) * (.012 + .03 * seed.z) * k + vec3(0., .006 * uT, 0.);
  vec4 mv = modelViewMatrix * vec4(p, 1.);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = clamp((.0022 + .002 * seed.w) * uPx / max(-mv.z, .05), 1., 18.);
  vA = max(0., 1. - uT / .7) * (.6 + .4 * seed.w);
}`
const PUFF_FRAG = `
precision highp float;
uniform vec3 uSkyA, uSkyB; uniform float uMix;
in float vA;
out vec4 frag;
void main() {
  float r = length(gl_PointCoord - .5) * 2., a = (1. - smoothstep(.2, 1., r)) * vA;
  if (a < .003) discard;
  frag = vec4(mix(uSkyA, uSkyB, uMix) * a * .55, 0.);
}`

export function createGuide3d({ scene, camera, canvas, look, things, contract, ambient }) {
  const U = look.U, deskY = contract.mirror.height ?? 0
  const display = (c) => { const k = c.clone().convertLinearToSRGB(); return new THREE.Vector3(k.r, k.g, k.b) }
  let model = null, mixer = null, clips = {}, base = null, baseName = '', once = null, loaded = null
  const actor = new THREE.Group()
  actor.name = 'guide3d'
  actor.visible = false
  actor.scale.setScalar(S)
  scene.add(actor)
  const pos = new THREE.Vector3(0, deskY, 0)
  let yaw = 0, yawTo = 0, lift = 0, fade = 0, fadeTo = 0, hover = 0, hoverTo = 0
  const flat = () => ({ value: new THREE.Vector4(0, 0, 0, 0) })      // (a Vector4 starts with w = 1: that would flatten him)
  const squashEyes = flat(), squashEyeR = flat(), squashMouth = flat()
  const up = { value: new THREE.Vector3(0, 1, 0) }
  const uFade = { value: 0 }, uHover = { value: 0 }
  let head = null, eyeL = null, eyeR = null, mouthNode = null, headUpLocal = new THREE.Vector3(0, 1, 0)
  let lookAt = null, look3 = new THREE.Vector3(), lookYaw = 0, lookPitch = 0, mouthV = 0, blinkT = 2 + Math.random() * 3, blink = 0
  let onPress = null, busyHop = false, warm = 0, moving = false

  // ---- his shadow ----
  const shadowU = { uDepth: U.uDepth, uDark: { value: 0 } }
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3, vertexShader: SHADOW_VERT, fragmentShader: SHADOW_FRAG, uniforms: shadowU, depthWrite: false, transparent: true,
    blending: THREE.CustomBlending, blendSrc: THREE.ZeroFactor, blendDst: THREE.SrcColorFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -6 }))
  shadow.name = 'guide3d_shadow'; shadow.renderOrder = 2; shadow.visible = false; shadow.frustumCulled = false
  scene.add(shadow)

  // ---- his puff of dust ----
  const PN = 26, pseed = new Float32Array(PN * 4)
  for (let i = 0; i < PN * 4; i++) pseed[i] = Math.random()
  const pgeo = new THREE.BufferGeometry()
  pgeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(PN * 3), 3))
  pgeo.setAttribute('seed', new THREE.BufferAttribute(pseed, 4))
  const puffU = { uAt: { value: new THREE.Vector3() }, uT: { value: 9 }, uPx: { value: 1000 }, uSkyA: U.uSkyA, uSkyB: U.uSkyB, uMix: U.uMix }
  const puffs = new THREE.Points(pgeo, new THREE.RawShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: PUFF_VERT, fragmentShader: PUFF_FRAG, uniforms: puffU, transparent: true, depthWrite: false,
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor }))
  puffs.name = 'guide3d_puff'; puffs.frustumCulled = false; puffs.visible = false; puffs.renderOrder = 3
  puffs.layers.set(GLASS_LAYER)
  scene.add(puffs)
  function landed(k = 1) {
    puffU.uAt.value.set(pos.x, deskY + 0.003, pos.z); puffU.uT.value = 0; puffs.visible = true
    if (ambient && ambient.puff) ambient.puff(pos, k)
    blip('land', 0.45 * k, 1.7)
  }

  // ---- his sound in the room ----
  const SFX = { step: ['footstep_wood_000', 'footstep_wood_001', 'footstep_wood_002', 'footstep_wood_003'], land: ['impactSoft_medium_000'] }
  let actx = null, panner = null, lastPhase = -1
  const sfx = {}
  function audio(ctx, out) {
    if (actx === ctx && panner) return panner
    actx = ctx
    panner = ctx.createPanner()
    panner.panningModel = 'HRTF'; panner.distanceModel = 'inverse'; panner.refDistance = 2.6; panner.rolloffFactor = 1
    panner.connect(out)
    for (const k of Object.values(SFX).flat()) {
      fetch(`media/sfx/${k}.mp3`).then((r) => r.arrayBuffer()).then((b) => new Promise((ok, no) => ctx.decodeAudioData(b, ok, no))).then((buf) => { sfx[k] = buf }).catch(() => {})
    }
    return panner
  }
  function blip(kind, gain = 1, rate = 1.5) {
    if (!actx || !panner || actx.state !== 'running' || !actor.visible) return
    const list = SFX[kind], buf = sfx[list[Math.floor(Math.random() * list.length)]]
    if (!buf) return
    const s = actx.createBufferSource(), g = actx.createGain()
    s.buffer = buf; s.playbackRate.value = rate * (0.94 + Math.random() * 0.12); g.gain.value = gain
    s.connect(g); g.connect(panner); s.start()
  }
  const setP = (param, v, t) => { if (param) param.setTargetAtTime(v, t, 0.02) }
  const camF = new THREE.Vector3(), camU = new THREE.Vector3()
  function hear() {
    if (!panner || !actx || actx.state !== 'running') return
    const t = actx.currentTime, L = actx.listener
    if (head) head.getWorldPosition(va); else va.copy(pos)
    if (panner.positionX) { setP(panner.positionX, va.x, t); setP(panner.positionY, va.y, t); setP(panner.positionZ, va.z, t) } else panner.setPosition(va.x, va.y, va.z)
    camera.getWorldDirection(camF); camU.copy(camera.up).applyQuaternion(camera.quaternion)
    const c = camera.position
    if (L.positionX) {
      setP(L.positionX, c.x, t); setP(L.positionY, c.y, t); setP(L.positionZ, c.z, t)
      setP(L.forwardX, camF.x, t); setP(L.forwardY, camF.y, t); setP(L.forwardZ, camF.z, t)
      setP(L.upX, camU.x, t); setP(L.upY, camU.y, t); setP(L.upZ, camU.z, t)
    } else { L.setPosition(c.x, c.y, c.z); L.setOrientation(camF.x, camF.y, camF.z, camU.x, camU.y, camU.z) }
  }
  // his steps: each time a foot lands in the walk (the clip's 0 and its half)
  // his steps: each time one of his four feet comes down (the walk clip plants them at these points of its cycle)
  const PLANTS = [0, 0.25, 0.5, 0.75]
  function steps() {
    if (baseName !== 'walk' || !base || !clips.walk) { lastPhase = -1; return }
    const ph = (base.time / clips.walk.duration) % 1
    if (lastPhase >= 0) for (const k of PLANTS) { if ((lastPhase < k && ph >= k) || (lastPhase > ph && (k > lastPhase || k <= ph))) { blip('step', 0.2, 1.2); break } }
    lastPhase = ph
  }

  function dress(m) {
    const src = m.material, name = (src && src.name) || ''
    const rough = src && src.roughness != null ? src.roughness : 0.6
    const color = src && src.color ? display(src.color) : new THREE.Vector3(0.7, 0.7, 0.7)
    const uni = { uColor: { value: color }, uRough: { value: rough }, uEmit: { value: /shine/.test(name) ? 0.9 : 0 }, uFade, uHover,
      uSquash: /^m_(eye|iris|pupil|shine2?|lash)R$/.test(m.name) ? squashEyeR : /^m_(eye|iris|pupil|shine2?|lash)L$/.test(m.name) ? squashEyes : /^m_(mouth|teeth|tongue)$/.test(m.name) ? squashMouth : flat(), uUp: up,
      cameraPosition: { value: camera.position }, uEnvA: U.uEnvA, uEnvB: U.uEnvB, uMix: U.uMix, uEnvYaw: U.uEnvYaw, uBloomPass: U.uBloomPass, uDepth: U.uDepth,
      uSkyA: U.uSkyA, uSkyB: U.uSkyB, uSunA: U.uSunA, uSunB: U.uSunB, uSunDir: U.uSunDir, uLampPos: U.uLampPos, uLampA: U.uLampA, uLampB: U.uLampB }
    const defines = {}
    if (m.isSkinnedMesh) defines.SKIN = 1
    if (m.geometry.attributes.color) { defines.VCOL = 1; uni.uColor.value.set(1, 1, 1) }
    if (src && src.map && m.geometry.attributes.uv) { defines.MAP = 1; uni.uMap = { value: src.map } }
    if (src && src.normalMap && m.geometry.attributes.uv && m.geometry.attributes.tangent) { defines.NMAP = 1; uni.uNMap = { value: src.normalMap } }
    m.material = new THREE.RawShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: VERT, fragmentShader: FRAG, uniforms: uni, defines })
    m.frustumCulled = false
  }

  function load() {
    if (loaded) return loaded
    loaded = new GLTFLoader().loadAsync(SRC).then((gltf) => {
      model = gltf.scene
      model.traverse((m) => { if (m.isMesh) dress(m) })
      actor.add(model)
      head = model.getObjectByName('head'); eyeL = model.getObjectByName('m_eyeL'); eyeR = model.getObjectByName('m_eyeR'); mouthNode = model.getObjectByName('m_mouth')
      for (const n of ['neck1', 'neck2', 'head']) { const b = model.getObjectByName(n); if (b) lookBones.push([b, LOOK_SHARE[n]]) }
      jaw = model.getObjectByName('jaw')
      for (const n of ['m_irisL', 'm_irisR']) { const o = model.getObjectByName(n); if (o) irises.push([o, o.position.clone()]) }
      actor.updateMatrixWorld(true)
      if (head) headUpLocal = new THREE.Vector3(0, 1, 0).applyQuaternion(head.getWorldQuaternion(new THREE.Quaternion()).invert())
      mixer = new THREE.AnimationMixer(model)
      for (const c of gltf.animations) clips[c.name] = c
      setBase('idle', 0)
      warm = 2                                   // drawn twice unseen, far under the desk, so his shader is built before he is needed
      return api
    }).catch((e) => { console.warn('guide3d:', e); loaded = null; return null })
    return loaded
  }

  // ---- the clips ----
  function setBase(name, fadeS = 0.25) {
    if (!mixer || !clips[name]) return
    if (once) { once.fadeOut(fadeS); once = null; if (base && baseName === name) { base.reset(); base.fadeIn(fadeS).play(); return } }
    if (baseName === name && base) return
    const a = mixer.clipAction(clips[name])
    a.reset(); a.setLoop(THREE.LoopRepeat, Infinity); a.clampWhenFinished = false; a.enabled = true
    a.setEffectiveTimeScale(name === 'walk' ? WALK_RATE : 1); a.setEffectiveWeight(1)
    if (base && fadeS > 0) { a.play(); base.crossFadeTo(a, fadeS, false) } else { if (base) base.stop(); a.play() }
    base = a; baseName = name
  }
  // a clip played through once over the base (hop, react) or to its end and held (point); resolves when it ends
  let pending = null                       // the promise of the one-shot clip playing: settled when it ends or is replaced
  function settle() { if (pending) { const p = pending; pending = null; p() } }
  function playOnce(name, { hold = false, fadeS = 0.12, rate = 1 } = {}) {
    if (!mixer || !clips[name]) return Promise.resolve()
    const a = mixer.clipAction(clips[name])
    settle()
    if (once && once !== a) once.fadeOut(fadeS)
    a.reset(); a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; a.setEffectiveTimeScale(rate); a.setEffectiveWeight(1)
    a.fadeIn(fadeS).play()
    once = a
    if (base) base.fadeOut(fadeS)
    return new Promise((done) => {
      const end = (e) => {
        if (e && e.action !== a) return
        mixer.removeEventListener('finished', end)
        if (pending === finish) pending = null
        if (e && !hold) release(0.2)
        done()
      }
      const finish = () => end(null)
      pending = finish
      mixer.addEventListener('finished', end)
    })
  }
  function release(fadeS = 0.25) {
    if (once) { once.fadeOut(fadeS); once = null }
    if (base) { base.reset(); base.fadeIn(fadeS).play() }
  }

  // ---- where he can stand: a grid over the desk, clear of everything that stands on it ----
  let grid = null
  const outline = (contract.desk.outline || []).map((e) => [e[0], e[1]])
  function inside(poly, x, z) {
    let c = false
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, zi] = poly[i], [xj, zj] = poly[j]
      if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c
    }
    return c
  }
  function edgeDist(poly, x, z) {
    let d = Infinity
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [ax, az] = poly[j], [bx, bz] = poly[i], ex = bx - ax, ez = bz - az, L = ex * ex + ez * ez || 1
      const t = Math.max(0, Math.min(1, ((x - ax) * ex + (z - az) * ez) / L)), dx = ax + ex * t - x, dz = az + ez * t - z
      d = Math.min(d, Math.hypot(dx, dz))
    }
    return d
  }
  function makeGrid() {
    const feet = (things.footprintsFor ? things.footprintsFor(HEIGHT + 0.015) : things.feet) || []      // all that stands on the desk up to his height
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity
    for (const [x, z] of outline) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z) }
    const nx = Math.ceil((x1 - x0) / CELL), nz = Math.ceil((z1 - z0) / CELL), free = new Uint8Array(nx * nz)
    for (let i = 0; i < nx; i++) for (let k = 0; k < nz; k++) {
      const x = x0 + (i + 0.5) * CELL, z = z0 + (k + 0.5) * CELL
      if (!inside(outline, x, z)) continue
      const edge = edgeDist(outline, x, z)
      if (edge < WALK_EDGE) continue
      let d = Infinity
      for (const f of feet) {
        if (Math.hypot(x - f.x, z - f.z) > f.reach + STAND_CLEAR) continue
        d = Math.min(d, inside(f.poly, x, z) ? -1 : edgeDist(f.poly, x, z))
      }
      if (d >= WALK_CLEAR) free[i + k * nx] = d >= STAND_CLEAR && edge >= STAND_EDGE ? 2 : 1      // 1: he can walk here, 2: and stop here
    }
    grid = { x0, z0, nx, nz, free }
  }
  const cellOf = (x, z) => [Math.floor((x - grid.x0) / CELL), Math.floor((z - grid.z0) / CELL)]
  const centreOf = (i, k) => [grid.x0 + (i + 0.5) * CELL, grid.z0 + (k + 0.5) * CELL]
  const isFree = (i, k) => i >= 0 && k >= 0 && i < grid.nx && k < grid.nz && grid.free[i + k * grid.nx] >= 1
  const isStand = (i, k) => i >= 0 && k >= 0 && i < grid.nx && k < grid.nz && grid.free[i + k * grid.nx] === 2
  function nearestFree(x, z) {
    if (!grid) makeGrid()
    const [ci, ck] = cellOf(x, z)
    let best = null, bd = Infinity
    for (let r = 0; r < 40 && !best; r++) for (let i = ci - r; i <= ci + r; i++) for (let k = ck - r; k <= ck + r; k++) {
      if (Math.max(Math.abs(i - ci), Math.abs(k - ck)) !== r || !isFree(i, k)) continue
      const [cx, cz] = centreOf(i, k), d = Math.hypot(cx - x, cz - z)
      if (d < bd) { bd = d; best = [cx, cz] }
    }
    return best || [x, z]
  }
  function clearLine(ax, az, bx, bz) {
    const n = Math.ceil(Math.hypot(bx - ax, bz - az) / (CELL * 0.5))
    for (let s = 0; s <= n; s++) { const t = s / Math.max(1, n), [i, k] = cellOf(ax + (bx - ax) * t, az + (bz - az) * t); if (!isFree(i, k)) return false }
    return true
  }
  // which free cells he can walk to from where he stands (the free desk can fall into islands between the things on it)
  function reachable() {
    if (!grid) makeGrid()
    const seen = new Uint8Array(grid.nx * grid.nz), [si, sk] = cellOf(...nearestFree(pos.x, pos.z)), q = [si + sk * grid.nx]
    if (!isFree(si, sk)) return seen
    seen[q[0]] = 1
    for (let h = 0; h < q.length; h++) {
      const c = q[h], ci = c % grid.nx, ck = Math.floor(c / grid.nx)
      for (const [di, dk] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const i = ci + di, k = ck + dk, n = i + k * grid.nx; if (isFree(i, k) && !seen[n]) { seen[n] = 1; q.push(n) } }
    }
    return seen
  }
  const canReach = (seen, x, z) => { const [i, k] = cellOf(x, z); return i >= 0 && k >= 0 && i < grid.nx && k < grid.nz && seen[i + k * grid.nx] === 1 }
  function nearestReachable(seen, x, z) {
    let best = null, bd = Infinity
    for (let c = 0; c < seen.length; c++) { if (!seen[c] || grid.free[c] !== 2) continue; const [cx, cz] = centreOf(c % grid.nx, Math.floor(c / grid.nx)), d = Math.hypot(cx - x, cz - z); if (d < bd) { bd = d; best = [cx, cz] } }
    return best
  }
  // A* over the grid, then pulled tight (each corner dropped that a straight line can skip). A place he cannot get to
  // is swapped for the nearest one he can: he never walks straight through anything.
  function route(ax, az, bx, bz) {
    if (!grid) makeGrid()
    const seen = reachable()
    if (!canReach(seen, bx, bz)) { const n = nearestReachable(seen, bx, bz); if (!n) return []; [bx, bz] = n }
    if (clearLine(ax, az, bx, bz)) return [[bx, bz]]
    const [si, sk] = cellOf(...nearestFree(ax, az)), [ti, tk] = cellOf(bx, bz), N = grid.nx * grid.nz
    const g = new Float32Array(N).fill(Infinity), from = new Int32Array(N).fill(-1), shut = new Uint8Array(N), open = [si + sk * grid.nx]
    g[open[0]] = 0
    const h = (c) => Math.hypot((c % grid.nx) - ti, Math.floor(c / grid.nx) - tk)
    let found = -1
    while (open.length) {
      let bi = 0
      for (let j = 1; j < open.length; j++) if (g[open[j]] + h(open[j]) < g[open[bi]] + h(open[bi])) bi = j
      const c = open.splice(bi, 1)[0]
      if (c === ti + tk * grid.nx) { found = c; break }
      shut[c] = 1
      const ci = c % grid.nx, ck = Math.floor(c / grid.nx)
      for (let di = -1; di <= 1; di++) for (let dk = -1; dk <= 1; dk++) {
        if (!di && !dk) continue
        const i = ci + di, k = ck + dk
        if (!isFree(i, k)) continue
        const n = i + k * grid.nx
        if (shut[n]) continue
        const gn = g[c] + (di && dk ? 1.414 : 1)
        if (gn < g[n]) { g[n] = gn; from[n] = c; if (!open.includes(n)) open.push(n) }
      }
    }
    if (found < 0) return []
    const pts = []
    for (let c = found; c >= 0; c = from[c]) pts.unshift(centreOf(c % grid.nx, Math.floor(c / grid.nx)))
    pts[pts.length - 1] = [bx, bz]
    const tight = []
    let cur = [ax, az], j = 0
    while (j < pts.length) {
      let far_ = j
      for (let m = pts.length - 1; m > j; m--) if (clearLine(cur[0], cur[1], pts[m][0], pts[m][1])) { far_ = m; break }
      tight.push(pts[far_]); cur = pts[far_]; j = far_ + 1
    }
    return tight
  }

  // ---- where to stand for a thing: beside it, on the side the camera sees, never in front of it ----
  const camXZ = () => [camera.position.x, camera.position.z]
  function spotFor(id, opts = {}) {
    if (!grid) makeGrid()
    const rec = id && things.by(id)
    const [cx, cz] = camXZ()
    if (opts.screen) {             // a point on the page (the Tutorial pill): the free place on the desk that looks nearest it
      const [sx, sy] = opts.screen, w = canvas.clientWidth, h = canvas.clientHeight, v = new THREE.Vector3()
      let best = null, bd = Infinity
      for (let i = 0; i < grid.nx; i += 2) for (let k = 0; k < grid.nz; k += 2) {
        if (!isFree(i, k)) continue
        const [x, z] = centreOf(i, k)
        v.set(x, deskY, z).project(camera)
        const d = Math.hypot((v.x + 1) / 2 * w - sx, (1 - v.y) / 2 * h - sy)
        if (d < bd) { bd = d; best = [x, z] }
      }
      return best ? { x: best[0], z: best[1] } : null
    }
    if (!rec) return null
    const ox = rec.centre.x, oz = rec.centre.z
    const toCam = Math.atan2(cx - ox, cz - oz)
    const r0 = (rec.onDesk ? rec.radius : 0.05) + 0.115
    let best = null, bs = -Infinity
    const v = new THREE.Vector3(), ox2 = v.copy(rec.centre).project(camera).x
    for (const side of [1, -1]) for (let a = 40; a <= 100; a += 10) for (let dr = 0; dr < 0.12; dr += 0.02) {
      const ang = toCam + side * a * Math.PI / 180, x = ox + Math.sin(ang) * (r0 + dr), z = oz + Math.cos(ang) * (r0 + dr)
      const [i, k] = cellOf(x, z)
      if (!isStand(i, k)) continue
      const onLeft = v.set(x, deskY, z).project(camera).x < ox2      // left of the thing on the page
      const score = -Math.abs(a - 62) / 30 - dr * 12 - (opts.left !== undefined && onLeft !== opts.left ? 1.5 : 0)
      if (score > bs) { bs = score; best = { x, z } }
    }
    if (!best) { const [x, z] = nearestFree(ox, oz); best = { x, z } }
    return best
  }
  function seenSpot(id, opts = {}) {
    if (!grid) makeGrid()
    const rec = id && things.by(id)
    if (!rec || opts.screen) return spotFor(id, opts)
    const ox = rec.centre.x, oz = rec.centre.z, [cx, cz] = camXZ(), toCam = Math.atan2(cx - ox, cz - oz)
    const r0 = (rec.onDesk ? rec.radius : 0.05) + 0.115, v = new THREE.Vector3(), ox2 = v.copy(rec.centre).project(camera).x
    const cands = []
    for (const side of [1, -1]) for (let a = 30; a <= 110; a += 10) for (let dr = 0; dr < 0.2; dr += 0.02) {
      const ang = toCam + side * a * Math.PI / 180, x = ox + Math.sin(ang) * (r0 + dr), z = oz + Math.cos(ang) * (r0 + dr)
      const [i, k] = cellOf(x, z)
      if (!isStand(i, k)) continue
      const onLeft = v.set(x, deskY, z).project(camera).x < ox2
      cands.push({ x, z, score: -Math.abs(a - 62) / 30 - dr * 8 - (opts.left !== undefined && onLeft !== opts.left ? 1.5 : 0) })
    }
    const seen = reachable(), ok = cands.filter((c) => canReach(seen, c.x, c.z))
    ok.sort((p, q) => q.score - p.score)
    for (const c of ok.slice(0, 14)) { const s = seenFrom(c.x, c.z); if (s.on && !s.by) return { x: c.x, z: c.z } }
    if (ok[0]) return { x: ok[0].x, z: ok[0].z }
    const n = nearestReachable(seen, ox, oz)
    return n ? { x: n[0], z: n[1] } : spotFor(id, opts)
  }

  // ---- moving ----
  const yawTo2 = (x, z) => Math.atan2(x - pos.x, z - pos.z)
  const wrapA = (a) => { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a }
  function faceTo(x, z) { yawTo = yawTo2(x, z) }
  function faceCamera() { faceTo(camera.position.x, camera.position.z) }
  const frameP = () => new Promise((r) => requestAnimationFrame(r))
  async function turnTo(target, stop) {
    yawTo = target
    for (let t = 0; t < 40 && Math.abs(wrapA(yawTo - yaw)) > 0.05; t++) { if (stop && stop()) return; await frameP() }
  }
  async function walkTo(to, stop) {
    await load()
    if (!model) return
    const path = route(pos.x, pos.z, to.x, to.z)
    let total = 0, px = pos.x, pz = pos.z
    for (const [x, z] of path) { total += Math.hypot(x - px, z - pz); px = x; pz = z }
    if (total < 0.008) return
    const hopping = false, rate = total > 0.25 ? RUN_RATE : WALK_RATE
    moving = true
    if (lift < 0) lift = 0
    for (const [x, z] of path) {
      if (stop && stop()) return
      const d = Math.hypot(x - pos.x, z - pos.z)
      if (d < 0.004) continue
      await turnTo(yawTo2(x, z), stop)
      if (hopping) {
        const n = Math.max(1, Math.round(d / (HEIGHT * 1.9)))
        const sx = pos.x, sz = pos.z
        for (let j = 1; j <= n; j++) { if (stop && stop()) return; await hop(sx + (x - sx) * j / n, sz + (z - sz) * j / n, 0) }
      } else {
        lookAt = null
        setBase('walk', 0.18)
        if (base) base.setEffectiveTimeScale(rate)
        const speed = WALK_UNITS * S * rate, sx = pos.x, sz = pos.z, ms = d / speed * 1000, t0 = performance.now()
        await new Promise((done) => {
          const f = (now) => {
            if (stop && stop()) return done()
            const k = Math.min(1, (now - t0) / ms)
            pos.x = sx + (x - sx) * k; pos.z = sz + (z - sz) * k
            kick()
            if (k < 1) requestAnimationFrame(f); else done()
          }
          requestAnimationFrame(f)
        })
      }
    }
    moving = false
    setBase('idle', 0.25)
  }
  // up over the desk's edge (or down it): the climb clip while he moves to the point and rises (or sinks) to the desk
  async function climb(x, z, fromY, toY, down = false) {
    busyHop = true
    const sx = pos.x, sz = pos.z
    const clip = down ? null : playOnce('climb', { rate: 1.2 })
    if (down) setBase('walk', 0.15)
    const ms = down ? 900 : (clips.climb ? clips.climb.duration : 1.1) / 1.2 * 1000, t0 = performance.now()
    await new Promise((done) => {
      const f = (now) => {
        const k = Math.min(1, (now - t0) / ms), e = k * k * (3 - 2 * k)
        pos.x = sx + (x - sx) * e; pos.z = sz + (z - sz) * e
        lift = fromY + (toY - fromY) * (down ? k * k : 1 - (1 - k) * (1 - k))
        if (k < 1) requestAnimationFrame(f); else done()
      }
      requestAnimationFrame(f)
    })
    lift = toY
    if (clip) { await clip; landed(0.5) }
    busyHop = false
  }
  // one hop to a point, from y0 (the desk, or below its edge as he comes up onto it) to the desk
  async function hop(x, z, fromY = 0, toY = 0) {
    busyHop = true
    const sx = pos.x, sz = pos.z, d = Math.hypot(x - sx, z - sz), arc = 0.035 + 0.35 * d + Math.max(0, toY - fromY) * 0.6
    const clip = playOnce('hop', { rate: 1.15 })
    const air0 = 5 / 30 / 1.15, air1 = 15 / 30 / 1.15, t0 = performance.now()
    await new Promise((done) => {
      const f = (now) => {
        const t = (now - t0) / 1000, k = Math.min(1, Math.max(0, (t - air0) / (air1 - air0)))
        const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2
        pos.x = sx + (x - sx) * e; pos.z = sz + (z - sz) * e
        lift = fromY + (toY - fromY) * k + arc * 4 * k * (1 - k)
        if (k < 1) requestAnimationFrame(f); else done()
      }
      requestAnimationFrame(f)
    })
    lift = toY
    if (toY >= -0.001) landed(Math.min(1, 0.5 + d * 2))
    await clip
    busyHop = false
  }

  // ---- the egg: he kicks it on his way past; it rolling into him makes him jump ----
  let startled = 0
  function kick() {
    const egg = things.egg
    if (!egg) return
    const dx = egg.x - pos.x, dz = egg.z - pos.z, d = Math.hypot(dx, dz), reach = egg.r + 0.48 * S
    if (d < reach && d > 1e-4) {
      const s = Math.sin(yaw), c = Math.cos(yaw)
      egg.vx += (dx / d) * 0.12 + s * 0.08; egg.vz += (dz / d) * 0.12 + c * 0.08
    }
  }
  function struck(dt) {
    const egg = things.egg
    startled = Math.max(0, startled - dt)
    if (!egg || !actor.visible || startled > 0 || busyHop || lift > 0.002) return
    const dx = egg.x - pos.x, dz = egg.z - pos.z, d = Math.hypot(dx, dz), v = Math.hypot(egg.vx, egg.vz)
    if (d < egg.r + 0.46 * S && v > 0.06) {
      startled = 1.2
      const nx = dx / d, nz = dz / d, along = egg.vx * nx + egg.vz * nz
      if (along < 0) { egg.vx -= 1.6 * along * nx; egg.vz -= 1.6 * along * nz }      // it bounces off his shins
      yawTo = Math.atan2(dx, dz)
      playOnce('react')
    }
  }

  // ---- the face ----
  const qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), qc = new THREE.Quaternion(), va = new THREE.Vector3(), vb = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0)
  const LOOK_SHARE = { neck1: 0.35, neck2: 0.35, head: 0.3 }      // a long neck turns from its base
  const LOOK = false                       // off: his head moves only as his clips move it; he turns his whole body to face things
  let jaw = null
  const lookBones = [], irises = [], qd = new THREE.Quaternion(), side = new THREE.Vector3(), fwd = new THREE.Vector3()
  const L = { yaw: 0, vy: 0, pitch: 0, vp: 0 }, glance = new THREE.Vector2(), wander = new THREE.Vector2()
  let turnT = 0, wanderT = 2
  // a critically damped spring: smooth to start, no overshoot, no snapping
  function spring(o, x, v, to, dt, w) { const a = w * w * (to - o[x]) - 2 * w * o[v]; o[v] += a * dt; o[x] += o[v] * dt }
  function face(dt) {
    if (!head) return
    const live = performance.now() - pointerT < 2500
    head.getWorldPosition(va)
    // walking he looks where he is going; else at what he talks about, else (a little) at the pointer, else at you
    let wy = 0, wp = 0
    if (!moving && !busyHop) {
      const target = lookAt || (pointerAt && live ? pointerP : camera.position)
      vb.copy(target).sub(va)
      const want = wrapA(Math.atan2(vb.x, vb.z) - yaw), flat = Math.hypot(vb.x, vb.z)
      // too far round for his neck: standing still, after a moment he turns his body to it, as a tortoise does
      if (Math.abs(want) > 1.0 && !once) { turnT += dt; if (turnT > 0.6) { yawTo = yaw + want * 0.8; turnT = 0 } } else turnT = 0
      const k = lookAt ? 1 : 0.6                                       // the pointer and you only half turn him
      wy = THREE.MathUtils.clamp(want, -0.75, 0.75) * k
      wp = THREE.MathUtils.clamp(-Math.atan2(vb.y, flat) * 0.7, -0.3, 0.25) * k
    } else turnT = 0
    for (let i = 0, n = Math.max(1, Math.ceil(dt / 0.008)); i < n; i++) { spring(L, 'yaw', 'vy', wy, dt / n, 4.2); spring(L, 'pitch', 'vp', wp, dt / n, 4.2) }
    // the eyes lead the head: they are already where it is going, and drift a little on their own when nothing holds them
    wanderT -= dt
    if (wanderT < 0) { wander.set((Math.random() - 0.5) * 0.7, (Math.random() - 0.5) * 0.4); wanderT = lookAt ? 3 : 1.4 + Math.random() * 2.6; if (Math.random() < 0.45) wander.set(0, 0) }
    const lead = THREE.MathUtils.clamp((wy - L.yaw) * 1.3, -1, 1), leadP = THREE.MathUtils.clamp((wp - L.pitch) * 1.3, -1, 1)
    const g = 1 - Math.exp(-dt * 30)
    glance.x += (THREE.MathUtils.clamp(lead + wander.x, -1, 1) - glance.x) * g
    glance.y += (THREE.MathUtils.clamp(leadP + wander.y, -1, 1) - glance.y) * g
    // the turn shared down the chest, the neck and the head, each turned in the world (whatever its own axes are),
    // the head tipping a little into a quick turn
    side.set(Math.cos(yaw), 0, -Math.sin(yaw)); fwd.set(Math.sin(yaw), 0, Math.cos(yaw))
    for (const [b, share] of LOOK ? lookBones : []) {
      b.parent.getWorldQuaternion(qa); b.getWorldQuaternion(qb)
      qc.setFromAxisAngle(Y, L.yaw * share).multiply(qd.setFromAxisAngle(side, L.pitch * share))
      b.quaternion.copy(qa.invert().multiply(qc.multiply(qb)))
      b.updateMatrixWorld(true)
    }
    for (const [o, rest] of irises) { o.position.set(rest.x, rest.y - glance.y * 0.002, rest.z + glance.x * 0.0025) }
    // his voice opens his jaw (about his head's side axis, whatever the bone's own axes are)
    if (jaw) {
      jaw.parent.getWorldQuaternion(qa); jaw.getWorldQuaternion(qb)
      va.set(Math.cos(yaw + L.yaw), 0, -Math.sin(yaw + L.yaw))            // his head's side axis: turning about it tips the jaw down
      qd.setFromAxisAngle(va, 0.42 * mouthV)
      jaw.quaternion.copy(qa.invert().multiply(qd.multiply(qb)))
      jaw.updateMatrixWorld(true)
    }
    // blinks: every 2 to 6 s, now and then twice
    blinkT -= dt
    if (blinkT < 0) { blink = 0.16; blinkT = 2 + Math.random() * 4; if (Math.random() < 0.18) blinkT = 0.32 }
    blink = Math.max(0, blink - dt)
    const shut = blink > 0 ? Math.sin(Math.PI * (1 - blink / 0.16)) : 0
    head.getWorldQuaternion(qa)
    up.value.copy(headUpLocal).applyQuaternion(qa).normalize()
    if (eyeL) { eyeL.getWorldPosition(va); squashEyes.value.set(va.x, va.y, va.z, 0.88 * shut) }
    if (eyeR) { eyeR.getWorldPosition(va); squashEyeR.value.set(va.x, va.y, va.z, 0.88 * shut) }

  }

  // ---- pressing him ----
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), hits = []
  function hitAt(e) {
    if (!actor.visible || !model || fade < 0.5) return false
    const r = canvas.getBoundingClientRect()
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
    ray.setFromCamera(ndc, camera)
    va.copy(pos); va.y += lift + 0.32 * S
    if (ray.ray.distanceToPoint(va) > 0.8 * S) return false
    hits.length = 0
    ray.intersectObject(model, true, hits)
    return hits.length > 0
  }
  const root = canvas.parentElement || canvas
  // where the pointer is in the room, at his depth: what his eyes follow when nothing else holds them
  let pointerAt = false, pointerT = 0
  const pointerP = new THREE.Vector3()
  const onMove = (e) => {
    const h = hitAt(e); hoverTo = h ? 1 : 0; root.classList.toggle('on-guide', h)
    if (!actor.visible) return
    const r = canvas.getBoundingClientRect()
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
    ray.setFromCamera(ndc, camera)
    va.copy(pos); va.y += HEIGHT
    pointerP.copy(ray.ray.origin).addScaledVector(ray.ray.direction, camera.position.distanceTo(va))
    pointerAt = true; pointerT = performance.now()
  }
  const onDown = (e) => {
    if (!hitAt(e)) return
    e.stopPropagation(); e.preventDefault()
    if (startled <= 0 && !busyHop) { startled = 0.8; playOnce('react') }
    if (onPress) onPress()
  }
  root.addEventListener('pointermove', onMove, true)
  root.addEventListener('pointerdown', onDown, true)

  // ---- every frame ----
  const screenV = new THREE.Vector3()
  function update(dt) {
    if (warm > 0 && fadeTo === 0) { warm--; actor.visible = true; shadow.visible = false; uFade.value = 0; actor.position.set(pos.x, deskY - 4, pos.z); actor.updateMatrixWorld(true); return }
    fade += (fadeTo - fade) * (1 - Math.exp(-dt * 9))
    if (fadeTo === 0 && fade < 0.01) fade = 0
    actor.visible = shadow.visible = !!model && fade > 0.003
    if (!actor.visible) return
    uFade.value = Math.min(1, fade * 1.05)
    hover += (hoverTo - hover) * (1 - Math.exp(-dt * 10)); uHover.value = hover
    yaw += wrapA(yawTo - yaw) * (1 - Math.exp(-dt * 10))
    actor.position.set(pos.x, deskY + lift, pos.z)
    actor.rotation.set(0, yaw, 0)
    if (mixer) mixer.update(dt)
    actor.updateMatrixWorld(true)
    face(dt)
    struck(dt)
    halos_update(dt)
    const air = Math.max(0, lift)
    shadow.position.set(pos.x, deskY + 0.0004, pos.z)
    const sw = S * (1 + air * 2)
    shadow.scale.set(sw * 0.78, 1, sw * 1.05)
    shadow.rotation.y = yaw
    shadowU.uDark.value = 0.42 * fade * Math.max(0, 1 - air * 9) * (lift < -0.01 ? 0 : 1)
    if (puffs.visible) { puffU.uT.value += dt; puffU.uPx.value = canvas.height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)); if (puffU.uT.value > 0.8) puffs.visible = false }
    steps()
    hear()
  }

  // ---- what he is talking about, lit: a soft ring of light round it, breathing, seen over everything ----
  const HALO_VERT = `
precision highp float;
uniform mat4 modelViewMatrix, projectionMatrix;
in vec3 position; in vec2 uv;
out vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`
  const HALO_FRAG = `
precision highp float;
uniform float uOn, uT;
uniform vec3 uTint;
in vec2 vUv;
out vec4 frag;
void main() {
  float r = length(vUv - .5) * 2.;
  float ring = exp(-pow((r - .86) / .07, 2.)), glow = exp(-pow((r - .8) / .2, 2.)) * .35, fill = smoothstep(1., .2, r) * .05;
  float a = (ring * .8 + glow * .8 + fill) * uOn * (.7 + .3 * sin(uT * 3.6));
  frag = vec4(uTint * a, 0.);
}`
  const halos = new Map()
  function haloFor(id) {
    let h = halos.get(id)
    if (h) return h
    const rec = things.by(id)
    if (!rec) return null
    const u = { uOn: { value: 0 }, uT: { value: 0 }, uTint: { value: new THREE.Vector3(1.0, 0.96, 0.86) } }
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.RawShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: HALO_VERT, fragmentShader: HALO_FRAG, uniforms: u,
      transparent: true, depthTest: false, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor }))
    m.name = 'guide3d_halo_' + id; m.renderOrder = 20; m.frustumCulled = false; m.visible = false
    m.layers.set(GLASS_LAYER)
    scene.add(m)
    h = { rec, mesh: m, u, to: 0 }
    halos.set(id, h)
    return h
  }
  function halos_update(dt) {
    for (const h of halos.values()) {
      h.u.uOn.value += (h.to - h.u.uOn.value) * (1 - Math.exp(-dt * 6))
      h.mesh.visible = h.u.uOn.value > 0.01
      if (!h.mesh.visible) continue
      h.u.uT.value += dt
      h.mesh.position.copy(h.rec.centre)
      h.mesh.quaternion.copy(camera.quaternion)
      h.mesh.scale.setScalar(Math.max(0.12, Math.min(0.55, h.rec.bound * 2.05)))
    }
  }

  // ---- being seen: is his head on the page, and not behind something (glass does not hide him) ----
  const seenRay = new THREE.Raycaster(), seenHits = []
  const solid = () => things.records.filter((r) => r.meshes.some((m) => !m.mesh.layers.isEnabled(GLASS_LAYER)))
  function seenFrom(x, z, y = 0) {
    va.set(x, deskY + y + HEIGHT * 0.75, z)
    vb.copy(va).project(camera)
    if (Math.abs(vb.x) > 0.9 || Math.abs(vb.y) > 0.86 || vb.z > 1) return { on: false, by: null }
    const d = camera.position.distanceTo(va)
    seenRay.set(camera.position, vb.copy(va).sub(camera.position).normalize()); seenRay.far = d - 0.03
    for (const r of solid()) {
      seenHits.length = 0
      r.node.updateWorldMatrix(true, true)
      for (const m of r.meshes) { if (!m.mesh.layers.isEnabled(GLASS_LAYER)) m.mesh.raycast(seenRay, seenHits) }
      if (seenHits.length) return { on: true, by: r }
    }
    return { on: true, by: null }
  }
  // hidden behind something, he climbs up its back until his head and shoulders show over its top edge
  let peeked = 0
  async function peek(by) {
    const box = new THREE.Box3().setFromObject(by.node)
    const rise = Math.max(0, box.max.y - deskY - HEIGHT * 0.45)
    if (rise <= 0.005) return false
    peeked = rise
    playOnce('point', { hold: true })                      // his neck stretched up over the edge
    const from = lift, t0 = performance.now()
    await new Promise((done) => { const f = (now) => { const k = Math.min(1, (now - t0) / 650), e = 1 - (1 - k) * (1 - k); lift = from + (rise - from) * e; if (k < 1) requestAnimationFrame(f); else done() }; requestAnimationFrame(f) })
    faceCamera()
    return true
  }
  async function unpeek() {
    if (!peeked) return
    const from = lift, t0 = performance.now()
    peeked = 0
    await new Promise((done) => { const f = (now) => { const k = Math.min(1, (now - t0) / 500), e = k * k; lift = from * (1 - e); if (k < 1) requestAnimationFrame(f); else done() }; requestAnimationFrame(f) })
    lift = 0
    release(0.2)
  }

  const api = {
    load,
    get ready() { return !!model },
    get height() { return HEIGHT },
    get position() { return pos },
    show(v) { fadeTo = v ? 1 : 0 },
    get shown() { return fadeTo > 0 },
    hide() { for (const h of halos.values()) h.to = 0; peeked = 0; fadeTo = 0; fade = 0; actor.visible = shadow.visible = false; lookAt = null; mouthV = 0; busyHop = false; moving = false; settle(); setBase('idle', 0); release(0) },
    place(x, z, faceTarget) { pos.set(x, deskY, z); lift = 0; if (faceTarget) { faceTo(faceTarget.x, faceTarget.z); yaw = yawTo } },
    spot: seenSpot,
    // a thing of the room lit while he talks about it (js/guide.js light())
    highlight(id, on) { const h = haloFor(id); if (h) h.to = on ? 1 : 0 },
    // where he stands now: on the page, and what (if anything) hides him
    seen() { return seenFrom(pos.x, pos.z, lift) },
    peek, unpeek,
    get peeked() { return peeked > 0 },
    walkTo,
    // up onto the desk from below its front edge, near a spot (the first visit's entrance)
    async enter(to, stop) {
      await load()
      if (!model) return
      if (!grid) makeGrid()
      const [cx, cz] = camXZ(), ang = Math.atan2(to.x - cx, to.z - cz)
      let ex = to.x, ez = to.z
      for (let d = 0; d < 0.8; d += 0.01) { const x = to.x - Math.sin(ang) * d, z = to.z - Math.cos(ang) * d; if (!inside(outline, x, z)) { ex = x - Math.sin(ang) * 0.03; ez = z - Math.cos(ang) * 0.03; break } }
      pos.set(ex, deskY, ez); lift = -0.075
      faceTo(to.x, to.z); yaw = yawTo
      setBase('idle', 0); fadeTo = 1; fade = 1
      if (stop && stop()) return
      const [ix, iz] = nearestFree(ex + Math.sin(ang) * 0.12, ez + Math.cos(ang) * 0.12)
      await climb(ix, iz, -0.075, 0)
      if (stop && stop()) return
      await walkTo(to, stop)
    },
    // off the front of the desk, out of sight
    async exit(stop) {
      if (!model || !actor.visible) return api.hide()
      const [cx, cz] = camXZ(), ang = Math.atan2(pos.x - cx, pos.z - cz)
      let ex = pos.x, ez = pos.z
      for (let d = 0; d < 0.8; d += 0.01) { const x = pos.x - Math.sin(ang) * d, z = pos.z - Math.cos(ang) * d; if (!inside(outline, x, z)) { ex = x - Math.sin(ang) * 0.04; ez = z - Math.cos(ang) * 0.04; break } }
      await turnTo(yawTo2(ex, ez), stop)
      if (stop && stop()) return
      await walkTo({ x: pos.x + (ex - pos.x) * 0.6, z: pos.z + (ez - pos.z) * 0.6 }, stop)
      if (stop && stop()) return
      fadeTo = 0
      await climb(ex, ez, 0, -0.09, true)
      if (stop && stop()) return
      api.hide()
    },
    faceCamera() { faceCamera() },
    face(x, z) { faceTo(x, z) },
    pose(name) {
      if (name === 'cheer') name = 'happy'
      if (name === 'point' || name === 'climb' || name === 'react') return playOnce(name, { hold: name === 'point' })
      release(0.2); setBase(clips[name] ? name : 'idle', 0.25)
      return Promise.resolve()
    },
    // turn so his pointing arm (out to his right) lines up with a thing, and point
    pointAt(target) {
      const a = Math.atan2(target.x - pos.x, target.z - pos.z)
      yawTo = a
      lookAt = target.clone ? target.clone() : new THREE.Vector3(target.x, target.y, target.z)
      return playOnce('point', { hold: true, fadeS: 0.18 })
    },
    look(target) { lookAt = target ? (target.clone ? target.clone() : new THREE.Vector3(target.x, target.y, target.z)) : null },
    mouth(v) { mouthV = Math.max(0, Math.min(1, v)) },
    // his feet and the top of his head on the page (CSS px of the stage), for the bubble over him
    screen() {
      const w = canvas.clientWidth, h = canvas.clientHeight
      screenV.set(pos.x, deskY + lift, pos.z).project(camera)
      const fx = (screenV.x + 1) / 2 * w, fy = (1 - screenV.y) / 2 * h
      screenV.set(pos.x, deskY + lift + HEIGHT * 1.02, pos.z).project(camera)
      const hy = (1 - screenV.y) / 2 * h
      return { x: fx, y: fy, h: Math.max(10, fy - hy) }
    },
    set onPress(fn) { onPress = fn },
    // his voice through the room's sound: give the guide's AudioContext and where it should end up; returns the node to play into
    audio,
    get debug() { return { actor, model, mixer, clips, head, get yaw() { return yaw }, free: (x, z) => { if (!grid) makeGrid(); const [i, k] = cellOf(x, z); return isFree(i, k) } } },      // for site/tools checks only
    update,
    dispose() { root.removeEventListener('pointermove', onMove, true); root.removeEventListener('pointerdown', onDown, true); scene.remove(actor); scene.remove(shadow); scene.remove(puffs); for (const h of halos.values()) scene.remove(h.mesh); if (panner) panner.disconnect() },
  }
  return api
}
