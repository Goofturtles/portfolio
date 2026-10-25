// What a lens adds to the room: the glow of the lamp, the tube light, the ring and the lit screen (a restrained
// bloom), and depth of field. Reference: the film's lamp at f362 and after (film/research/P2.md: a soft lavender halo
// about the shade, never a white flare); the film's own lens (room3d.json cameras: 67.8 mm at f/5.6 on 36 mm, focused
// on the laptop's screen, so the chair in front and the alcove behind are a little soft); film/SPEC.md "What only 3D
// can do" item 4 (the dive pulls focus as it goes); and the usual small blur chains (why.zero.university keeps its
// post passes small the same way, BREAKDOWN.md 3.7).
// Bloom: only the glowing things are drawn into a small picture (everything else as black, so a thing in front still
// hides the glow), blurred at a quarter and an eighth of the screen, and added over the finished frame.
// Depth of field (computers only, and dropped first if the screen is slow): the room is drawn into a multisampled
// picture whose alpha holds 0.3 / distance (look.js far()). Blur out of focus is linear in one over the distance, so
// the blur of a pixel is |alpha - focus| x one number. Two soft copies are made (half and quarter size), each pixel
// weighted by its own blur so that what is sharp never leaks into what is soft, and the frame is the sharp picture
// mixed toward them by each pixel's blur. Without depth of field the room is drawn straight to the screen, as before.
import * as THREE from 'three'

const VERT = `in vec3 position; out vec2 v; void main() { v = position.xy * .5 + .5; gl_Position = vec4(position.xy, 0., 1.); }`
const BLUR = `precision highp float; uniform sampler2D t; uniform vec2 step; in vec2 v; out vec4 frag;
void main() {
  frag = texture(t, v) * .227027 + (texture(t, v + step * 1.3846) + texture(t, v - step * 1.3846)) * .316216 + (texture(t, v + step * 3.2308) + texture(t, v - step * 3.2308)) * .070270;
}`
const ADD = `precision highp float; uniform sampler2D a, b; uniform float strength; in vec2 v; out vec4 frag;
void main() { frag = vec4((texture(a, v).rgb * .55 + texture(b, v).rgb * .75) * strength, 1.); }`
// half size: each of the four pixels under this one, weighted by how far out of focus it is (and a little, so a sharp place still has a colour)
const SOFT = `precision highp float; uniform sampler2D t; uniform vec2 px; uniform float focus, k; in vec2 v; out vec4 frag;
vec4 one(vec2 o) { vec4 c = texture(t, v + o * px); float w = clamp(abs(c.a - focus) * k / 10., 0., 1.) + .02; return vec4(c.rgb * w, w); }
void main() { frag = (one(vec2(-.5, -.5)) + one(vec2(.5, -.5)) + one(vec2(-.5, .5)) + one(vec2(.5, .5))) * .25; }`
// how much of what is NEARER than the focus lies round each pixel: a soft thing in front spreads over the sharp thing behind it
const FRONT = `precision highp float; uniform sampler2D t; uniform vec2 px; uniform float focus, k; in vec2 v; out vec4 frag;
float one(vec2 o) { return clamp((texture(t, v + o * px).a - focus) * k / 10., 0., 1.); }
void main() { frag = vec4((one(vec2(-.5, -.5)) + one(vec2(.5, -.5)) + one(vec2(-.5, .5)) + one(vec2(.5, .5))) * .25); }`
// the frame: sharp where in focus, toward the half-size copy up to 10 pixels of blur, toward the quarter-size one beyond; then the glow
const LENS = `precision highp float; uniform sampler2D t, half_, quarter, front, a, b; uniform float focus, k, strength; in vec2 v; out vec4 frag;
void main() {
  vec4 m = texture(t, v), h = texture(half_, v), q = texture(quarter, v);
  float coc = abs(m.a - focus) * k;
  vec3 c = mix(m.rgb, h.rgb / max(h.a, .001), clamp(max(coc / 10., texture(front, v).r * 1.7 - .1), 0., 1.));
  c = mix(c, q.rgb / max(q.a, .001), clamp((coc - 10.) / 24., 0., 1.));
  frag = vec4(c + (texture(a, v).rgb * .55 + texture(b, v).rgb * .75) * strength, 1.);
}`

export const GLOW_LAYER = 1, GLASS_LAYER = 2
export const NEAR = 0.3                                          // the distance that alpha 1 stands for, in metres (look.js far())

export function createBloom(renderer, scene, look) {
  const opts = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false }
  const src = new THREE.WebGLRenderTarget(4, 4, { ...opts, depthBuffer: true }), a1 = new THREE.WebGLRenderTarget(4, 4, opts), a2 = new THREE.WebGLRenderTarget(4, 4, opts)
  const b1 = new THREE.WebGLRenderTarget(4, 4, opts), b2 = new THREE.WebGLRenderTarget(4, 4, opts)
  const black = new THREE.MeshBasicMaterial({ color: 0x000000 })
  const tri = new THREE.Mesh(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3)))
  tri.frustumCulled = false
  const flat = new THREE.Camera(), quad = new THREE.Scene()
  quad.add(tri)
  const raw = (frag, uniforms, extra = {}) => new THREE.RawShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: VERT, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false, ...extra })
  const blur = raw(BLUR, { t: { value: null }, step: { value: new THREE.Vector2() } })
  const add = raw(ADD, { a: { value: a1.texture }, b: { value: b1.texture }, strength: { value: 0.27 } }, { blending: THREE.AdditiveBlending, transparent: true })
  const zero = new THREE.Color(0, 0, 0), keep = new THREE.Color()

  // ---- depth of field: made only when it is first asked for ------------------------------------------------
  let lens = null, W = 4, H = 4
  function makeLens() {
    const type = renderer.extensions.has('EXT_color_buffer_float') || renderer.extensions.has('EXT_color_buffer_half_float') ? THREE.HalfFloatType : THREE.UnsignedByteType
    const main = new THREE.WebGLRenderTarget(W, H, { ...opts, depthBuffer: true, samples: 4 })
    const soft = { ...opts, type }
    const h1 = new THREE.WebGLRenderTarget(4, 4, soft), h2 = new THREE.WebGLRenderTarget(4, 4, soft), q1 = new THREE.WebGLRenderTarget(4, 4, soft), q2 = new THREE.WebGLRenderTarget(4, 4, soft)
    const n1 = new THREE.WebGLRenderTarget(4, 4, opts), n2 = new THREE.WebGLRenderTarget(4, 4, opts)
    const near = raw(FRONT, { t: { value: main.texture }, px: { value: new THREE.Vector2() }, focus: { value: 0 }, k: { value: 0 } })
    const pre = raw(SOFT, { t: { value: main.texture }, px: { value: new THREE.Vector2() }, focus: { value: 0 }, k: { value: 0 } })
    const out = raw(LENS, { t: { value: main.texture }, half_: { value: h1.texture }, quarter: { value: q1.texture }, front: { value: n1.texture }, a: { value: a1.texture }, b: { value: b1.texture }, focus: { value: 0 }, k: { value: 0 }, strength: { value: 0 } })
    lens = { main, h1, h2, q1, q2, n1, n2, pre, near, out }
    sizeLens()
  }
  function sizeLens() {
    if (!lens) return
    lens.main.setSize(W, H)
    const w = Math.max(2, W >> 1), h = Math.max(2, H >> 1)
    lens.h1.setSize(w, h); lens.h2.setSize(w, h); lens.n1.setSize(w, h); lens.n2.setSize(w, h); lens.near.uniforms.px.value.set(1 / W, 1 / H); lens.q1.setSize(Math.max(2, w >> 1), Math.max(2, h >> 1)); lens.q2.setSize(Math.max(2, w >> 1), Math.max(2, h >> 1))
    lens.pre.uniforms.px.value.set(1 / W, 1 / H)
  }

  function resize(w, h) {
    W = w; H = h
    sizeLens()
    const qw = Math.max(4, Math.round(w / 4)), qh = Math.max(4, Math.round(h / 4))
    if (src.width === qw && src.height === qh) return
    for (const t of [src, a1, a2]) t.setSize(qw, qh)
    for (const t of [b1, b2]) t.setSize(Math.max(2, qw >> 1), Math.max(2, qh >> 1))
  }
  function pass(material, from, to, sx, sy) {
    if (material === blur) { blur.uniforms.t.value = from.texture; blur.uniforms.step.value.set(sx / from.width, sy / from.height) }
    tri.material = material
    renderer.setRenderTarget(to)
    renderer.render(quad, flat)
  }
  // 1. the glowing things alone, hidden where something stands in front   2. two sizes of blur
  function render(camera) {
    const mask = camera.layers.mask, alpha = renderer.getClearAlpha()
    renderer.getClearColor(keep)
    renderer.setClearColor(zero, 1)
    renderer.setRenderTarget(src)
    renderer.clear()
    camera.layers.set(0)
    scene.overrideMaterial = black
    renderer.render(scene, camera)
    scene.overrideMaterial = null
    camera.layers.set(GLOW_LAYER)
    look.U.uBloomPass.value = 1
    renderer.autoClear = false
    renderer.render(scene, camera)
    renderer.autoClear = true
    look.U.uBloomPass.value = 0
    camera.layers.mask = mask
    pass(blur, src, a2, 1, 0); pass(blur, a2, a1, 0, 1)
    pass(blur, a1, b2, 1, 0); pass(blur, b2, b1, 0, 1)
    renderer.setRenderTarget(null)
    renderer.setClearColor(keep, alpha)
  }
  // 3. added over the finished frame
  function compose() {
    tri.material = add
    renderer.autoClear = false
    renderer.render(quad, flat)
    renderer.autoClear = true
  }
  // The whole frame through the lens. focus: metres to what is sharp. aperture: the lens opening in metres (focal
  // length over the f-number). glow: whether the bloom's pictures are fresh this frame.
  function throughLens(camera, focus, aperture, glow) {
    if (!lens) makeLens()
    const f = NEAR / Math.max(NEAR, focus), k = (H / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2))) * aperture / NEAR      // pixels of blur for each unit of alpha away from focus
    look.U.uDepth.value.set(0, NEAR)
    renderer.setRenderTarget(lens.main)
    renderer.render(scene, camera)
    look.U.uDepth.value.set(0, 0)
    lens.pre.uniforms.focus.value = lens.near.uniforms.focus.value = lens.out.uniforms.focus.value = f
    lens.pre.uniforms.k.value = lens.near.uniforms.k.value = lens.out.uniforms.k.value = k
    lens.out.uniforms.strength.value = glow ? add.uniforms.strength.value : 0
    pass(lens.pre, lens.main, lens.h2)
    pass(lens.near, lens.main, lens.n2); pass(blur, lens.n2, lens.n1, 1.5, 0); pass(blur, lens.n1, lens.n2, 0, 1.5)
    pass(blur, lens.h2, lens.q2, 2, 0); pass(blur, lens.q2, lens.q1, 0, 1)      // the quarter-size copy first (a step of 2 half-size pixels is one of its own), blurred twice; then the half-size one
    pass(blur, lens.q1, lens.q2, 1, 0); pass(blur, lens.q2, lens.q1, 0, 1)
    pass(blur, lens.h2, lens.h1, 1, 0); pass(blur, lens.h1, lens.h2, 0, 1)
    lens.out.uniforms.half_.value = lens.h2.texture; lens.out.uniforms.front.value = lens.n2.texture
    pass(lens.out, null, null)
  }
  return { resize, render, compose, throughLens, dispose: () => [src, a1, a2, b1, b2, ...(lens ? [lens.main, lens.h1, lens.h2, lens.q1, lens.q2, lens.n1, lens.n2] : [])].forEach((t) => t.dispose()) }
}
