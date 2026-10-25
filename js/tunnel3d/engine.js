// The film's tunnel of scales (shot P1), drawn live. Everything here is a function of one number: the reference
// frame f (92 .. 133), so a flight can be played forwards, backwards, or held on any frame.
// three.js is handed in (THREE) so this file never imports it by name.
import { NA, NB, sampleFlight, hex3, PAL_A, PAL_A_E, PAL_A_D, PAL_B, PAL_B_EXIT, CARD, TRAILS } from './data.js'
import { THUMB, FIRE, PARTY, SPARK, CURSOR } from './tracks.js'

const AX = 0.498, AY = 0.497 // tunnel axis in the film frame
const HT = 0.5625 // film height / width

// ------------------------------------------------------------------------------------------------ shaders
const SRGB = `
vec3 s2l(vec3 c){ return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), c)); }
`
const WALL_VERT = `
#define MAXR ${Math.max(NA, NB)}
uniform vec4 uRing[MAXR];
uniform float uVis[MAXR];
uniform float uLeanK[MAXR];
uniform float uPitch, uHalfW, uCapA, uCapExtra, uHRoot, uHDome, uDomePow, uScale;
attribute vec2 aInst;
varying vec4 vShape;
varying float vLam;
varying vec2 vDir;
void main() {
  int ri = int(aInst.x + 0.5);
  if (uVis[ri] < 0.5) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); vShape = vec4(0.0); vLam = 0.0; vDir = vec2(1.0, 0.0); return; }
  vec4 R = uRing[ri];
  float sl = uLeanK[ri];
  float cb = inversesqrt(1.0 + sl * sl), sb = sl * cb;
  float lnTb = R.x + uCapExtra;
  float Lw = (lnTb - R.y) / cb;
  float wP = uHalfW * cb;
  float aP = min(uCapA * wP, 0.45 * Lw);
  float p = position.x;
  float t = position.y;
  float sigma, hw, nu, cphi;
  if (p <= 0.5) {
    sigma = -Lw + (p / 0.5) * (Lw - aP);
    hw = wP; nu = abs(t); cphi = 1.0;
  } else {
    float phi = (p - 0.5) / 0.5 * 1.5707963;
    float c = cos(phi), sn = sin(phi);
    sigma = -aP + aP * sn;
    hw = wP * c; cphi = c;
    nu = sqrt(t * t * c * c + sn * sn);
  }
  float psi = t * hw;
  float lam = lnTb + sigma * cb - psi * sb;
  float dth = sigma * sb + psi * cb;
  float sph = clamp((sigma + Lw) / Lw, 0.0, 1.0);
  float x = psi / wP;
  float cc = max(0.0, (sigma + aP) / aP);
  float v = max(0.0, 1.0 - x * x - cc * cc);
  float rho = 1.0 + uHRoot * (1.0 - sph) - uHDome * pow(v, uDomePow);
  float theta = R.z + aInst.y * uPitch + dth;
  vec3 P = vec3(rho * cos(theta), -rho * sin(theta), -exp(lam)) * uScale;
  vShape = vec4(t, nu, sph, cphi);
  vLam = lam;
  vDir = vec2(cos(theta), sin(theta));
  gl_Position = projectionMatrix * modelViewMatrix * vec4(P, 1.0);
}`
const WALL_FRAG = `
precision highp float;
uniform vec3 uPal[24];
uniform vec3 uPalX[24];
uniform vec3 uPalY[24];
uniform float uXm, uYm;
uniform float uSec, uLnClip, uTau, uGlowK, uLift, uWhite, uPx, uVW;
uniform vec2 uCtr;
uniform vec3 uSky, uGlowBlue, uGlowViolet;
varying vec4 vShape;
varying float vLam;
varying vec2 vDir;
${SRGB}
vec3 pick3(int i0, int i1, float fr, int o) {
  vec3 m = mix(uPal[i0*3+o], uPal[i1*3+o], fr);
  vec3 x = mix(uPalX[i0*3+o], uPalX[i1*3+o], fr);
  vec3 y = mix(uPalY[i0*3+o], uPalY[i1*3+o], fr);
  return mix(mix(m, x, uXm), y, uYm);
}
vec3 rampAt(float ang, float L) {
  float x = ang / 0.7853982;
  int i0 = int(floor(x));
  float fr = x - float(i0);
  i0 = i0 - (i0 / 8) * 8;
  int i1 = i0 + 1; if (i1 > 7) i1 = 0;
  fr = fr * fr * (3.0 - 2.0 * fr);
  vec3 sh = pick3(i0, i1, fr, 0), md = pick3(i0, i1, fr, 1), lt = pick3(i0, i1, fr, 2);
  return L < 0.5 ? mix(sh, md, L * 2.0) : mix(md, lt, L * 2.0 - 1.0);
}
void main() {
  if (vLam > uLnClip) discard;
  float t = vShape.x, nu = vShape.y, sph = vShape.z;
  float ang = atan(vDir.y, vDir.x); if (ang < 0.0) ang += 6.2831853;
  float glow = uGlowK * exp(-(uLnClip - vLam) / uTau);
  float rS = length(gl_FragCoord.xy - uCtr) / uVW;
  float edgeD = 1.0 - nu;
  // a round cross-section lit from the top of the screen: the lit flank depends on where the wall is, not on the scale
  vec2 eT = vec2(-vDir.y, vDir.x);
  float k = dot(eT, normalize(vec2(-0.45, -0.9)));
  vec3 Ld = normalize(vec3(k * 0.9, 0.0, 0.62));
  float sx = clamp(t, -1.0, 1.0);
  float nz = sqrt(max(0.0, 1.0 - sx * sx));
  float diff = clamp(sx * Ld.x + nz * Ld.z, 0.0, 1.0);
  vec3 hv = normalize(Ld + vec3(0.0, 0.0, 1.0));
  float spec = pow(clamp(sx * hv.x + nz * hv.z, 0.0, 1.0), 14.0);
  float under = mix(0.20, 1.0, smoothstep(0.50, 0.70, sph));
  float L, ao;
  if (uSec < 0.5) {
    L = (0.02 + 0.62 * diff) * under + 0.40 * spec * under + 0.30 * glow;
    L += 0.55 * smoothstep(0.70, 0.98, nu) * smoothstep(0.78, 0.95, sph) * (0.35 + diff);
    ao = mix(0.45, 1.0, smoothstep(0.0, 0.15, edgeD));
  } else {
    float pz = smoothstep(-0.1, 0.9, dot(vDir, normalize(vec2(-0.75, -0.65))));
    float nearL = smoothstep(0.24, 0.50, rS) * (0.18 + 0.82 * pz) * (1.0 - clamp(uLift * 1.4, 0.0, 1.0));
    L = (0.10 + 0.26 * diff) * under + 0.10 * spec + 0.50 * glow + 0.50 * nearL * (0.35 + 0.65 * diff);
    L += (0.20 + 0.45 * glow) * smoothstep(0.55, 0.97, nu) * smoothstep(0.70, 0.95, sph) * (0.4 + diff);
    ao = mix(0.74, 1.0, smoothstep(0.0, 0.20, edgeD));
  }
  L = clamp(L * ao, 0.0, 1.0);
  vec3 col = rampAt(ang, L);
  float violet = smoothstep(-0.1, 0.8, sin(ang + 0.15));
  vec3 gc = mix(uGlowBlue, uGlowViolet, violet);
  col = mix(col, gc * (0.88 + 0.40 * diff), clamp(glow * 1.25, 0.0, 1.0) * (uSec > 0.5 ? 1.0 : 0.5));
  if (uSec > 0.5) {
    float pz2 = smoothstep(-0.1, 0.9, dot(vDir, normalize(vec2(-0.75, -0.65))));
    float nr2 = smoothstep(0.24, 0.50, rS) * (0.15 + 0.85 * pz2) * (1.0 - clamp(uLift * 1.4, 0.0, 1.0));
    col = mix(col, vec3(0.33, 0.56, 0.85) * (0.75 + 0.35 * diff), 0.62 * nr2 * (0.4 + 0.6 * diff));
    float lw = (1.5 + 10.0 * rS) * uPx;
    float ed = edgeD / max(fwidth(nu), 1e-5);
    float line = 1.0 - smoothstep(lw * 0.30, lw * 0.95, ed);
    float la = 0.95 * mix(1.0, 0.22 + 0.78 * uLift, smoothstep(0.22, 0.40, rS));
    vec3 lc = mix(vec3(0.40, 0.50, 0.88), vec3(0.88, 0.94, 1.0), clamp(0.35 + glow * 1.0 + uLift * 0.6, 0.0, 1.0));
    col = mix(col, lc, line * la * mix(0.45, 1.0, smoothstep(0.62, 0.88, sph)));
  }
  col = mix(col, uSky, uWhite * exp(-(uLnClip - vLam) / 0.16));
  gl_FragColor = vec4(s2l(clamp(col, 0.0, 1.0)), 1.0);
  #include <colorspace_fragment>
}`
const SKY_VERT = `varying vec2 vUv; void main(){ gl_Position = vec4(position.xy, 0.99995, 1.0); vUv = position.xy * 0.5 + 0.5; }`
const SKY_FRAG = `precision highp float; uniform vec3 uUL, uLR; varying vec2 vUv; ${SRGB}
void main(){ float t = clamp((vUv.x - vUv.y + 1.0) * 0.5, 0.0, 1.0); vec3 c = mix(uUL, uLR, smoothstep(0.1, 0.9, t));
  gl_FragColor = vec4(s2l(c), 1.0);
  #include <colorspace_fragment>
}`
const POST_VERT = `varying vec2 vUv; void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); vUv = position.xy * 0.5 + 0.5; }`
const POST_FRAG = `precision highp float; uniform sampler2D tDiffuse; uniform float uK; uniform vec2 uCtr; varying vec2 vUv;
void main(){
  vec2 d = vUv - uCtr; vec3 acc = vec3(0.0);
  for (int i = 0; i < 18; i++) { float s = float(i) / 17.0 - 0.5; acc += texture2D(tDiffuse, clamp(uCtr + d * (1.0 + uK * s), 0.001, 0.999)).rgb; }
  gl_FragColor = vec4(acc / 18.0, 1.0);
  #include <colorspace_fragment>
}`
const TRAIL_VERT = `varying vec2 vV; attribute vec2 aV; void main(){ vV = aV; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`
const TRAIL_FRAG = `precision highp float; uniform float uA; uniform vec3 uCore, uEdge; varying vec2 vV; ${SRGB}
void main(){ float d = abs(vV.x); float a = smoothstep(1.0, 0.35, d) * uA * vV.y;
  vec3 c = mix(uCore, uEdge, smoothstep(0.2, 1.0, d));
  gl_FragColor = vec4(s2l(c), a);
  #include <colorspace_fragment>
}`

// ------------------------------------------------------------------------------------------------ small helpers
const lerp = (a, b, t) => a + (b - a) * t
const clamp01 = (x) => Math.min(1, Math.max(0, x))
const smooth = (e0, e1, x) => { const t = clamp01((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t) }
function rowAt(rows, f, n) { // rows: [[f, a, b, c...]]; returns lerped array or null outside the range
  if (f < rows[0][0] || f > rows[rows.length - 1][0]) return null
  let i = 1
  while (i < rows.length - 1 && rows[i][0] < f) i++
  const r0 = rows[i - 1], r1 = rows[i]
  const t = clamp01((f - r0[0]) / (r1[0] - r0[0]))
  const out = []
  for (let k = 1; k <= n; k++) out.push(lerp(r0[k], r1[k], t))
  return out
}

function chaikin(pts, n) {
  let p = pts
  for (let it = 0; it < n; it++) {
    const q = [p[0]]
    for (let i = 0; i + 1 < p.length; i++) {
      q.push([p[i][0] * 0.75 + p[i + 1][0] * 0.25, p[i][1] * 0.75 + p[i + 1][1] * 0.25])
      q.push([p[i][0] * 0.25 + p[i + 1][0] * 0.75, p[i][1] * 0.25 + p[i + 1][1] * 0.75])
    }
    q.push(p[p.length - 1])
    p = q
  }
  return p
}
function resample(pts, n) {
  const d = [0]
  for (let i = 1; i < pts.length; i++) d.push(d[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]))
  const L = d[d.length - 1] || 1e-6
  const out = []
  let j = 1
  for (let i = 0; i < n; i++) {
    const s = (i / (n - 1)) * L
    while (j < d.length - 1 && d[j] < s) j++
    const t = (s - d[j - 1]) / Math.max(1e-9, d[j] - d[j - 1])
    out.push([lerp(pts[j - 1][0], pts[j][0], t), lerp(pts[j - 1][1], pts[j][1], t)])
  }
  return out
}
const TRAIL_N = 56
const trailPre = TRAILS.map((piece) => piece.map(([f, wpx, a, pts]) => ({ f, wpx, a, pts: resample(chaikin(pts, 2), TRAIL_N) })))

// ------------------------------------------------------------------------------------------------ images
const imgCache = {}
function loadImage(name) {
  if (!imgCache[name]) imgCache[name] = new Promise((res, rej) => {
    const im = new Image()
    im.onload = () => res(im)
    im.onerror = () => rej(new Error('tunnel3d: cannot load ' + name))
    im.src = new URL('./assets/' + name, import.meta.url).href
  })
  return imgCache[name]
}
// bounding box (as fractions of the picture) of the opaque warm pixels: that is how the film's boxes were measured
function warmBox(im, warmOnly) {
  const c = document.createElement('canvas'); c.width = c.height = 128
  const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(im, 0, 0, 128, 128)
  const d = g.getImageData(0, 0, 128, 128).data
  let x0 = 128, y0 = 128, x1 = -1, y1 = -1
  for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
    const i = (y * 128 + x) * 4, r = d[i], gg = d[i + 1], b = d[i + 2], a = d[i + 3]
    if (a < 100) continue
    if (warmOnly && !(r > 180 && b < 150 && r > b + 60)) continue
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y
  }
  return { x0: x0 / 128, y0: y0 / 128, x1: (x1 + 1) / 128, y1: (y1 + 1) / 128 }
}
export function preloadAssets() {
  return Promise.all(['fire_3d.png', 'partying_face_3d.png', 'thumbs_up_3d_default.png'].map(loadImage))
}

// ------------------------------------------------------------------------------------------------ the engine
export async function createEngine(THREE, canvas, opts = {}) {
  const [imFire, imParty, imThumb] = await preloadAssets()
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance', preserveDrawingBuffer: !!opts.preserve })
  renderer.setClearColor(0x000000, 0)
  renderer.autoClear = false
  renderer.transmissionResolutionScale = 0.5
  const gl = renderer.getContext()

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.08, 90)
  const oScene = new THREE.Scene()
  const oCam = new THREE.OrthographicCamera(-0.5, 0.5, 0.28, -0.28, -10, 10)
  const disposables = []
  const track = (o) => { disposables.push(o); return o }

  // ---- sky
  const skyMat = track(new THREE.ShaderMaterial({ vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, depthWrite: false,
    uniforms: { uUL: { value: new THREE.Vector3() }, uLR: { value: new THREE.Vector3() } } }))
  const sky = new THREE.Mesh(track(new THREE.PlaneGeometry(2, 2)), skyMat)
  sky.frustumCulled = false; sky.renderOrder = -10
  scene.add(sky)

  // ---- walls
  const ROWS_S = 3, ROWS_C = 12, COLS = 10
  function scaleGrid() {
    const pos = [], idx = []
    const rows = ROWS_S + ROWS_C + 1
    for (let r = 0; r < rows; r++) {
      const p = r <= ROWS_S ? 0.5 * r / ROWS_S : 0.5 + 0.5 * (r - ROWS_S) / ROWS_C
      for (let c = 0; c <= COLS; c++) pos.push(p, -1 + 2 * c / COLS, 0)
    }
    for (let r = 0; r + 1 < rows; r++) for (let c = 0; c < COLS; c++) {
      const a = r * (COLS + 1) + c, b = a + 1, d = a + COLS + 1, e = d + 1
      idx.push(a, b, d, b, e, d)
    }
    return { pos: new Float32Array(pos), idx: new Uint16Array(idx) }
  }
  const grid = scaleGrid()
  const palVec = (list) => list.map((h) => new THREE.Vector3(...hex3(h)))
  const palA = palVec(PAL_A), palAE = palVec(PAL_A_E), palAD = palVec(PAL_A_D), palB = palVec(PAL_B), palX = palVec(PAL_B_EXIT)
  function makeWall(sec, nRings, nScales, cfg) {
    const g = track(new THREE.InstancedBufferGeometry())
    g.setAttribute('position', new THREE.BufferAttribute(grid.pos, 3))
    g.setIndex(new THREE.BufferAttribute(grid.idx, 1))
    const inst = new Float32Array(nRings * nScales * 2)
    for (let r = 0; r < nRings; r++) for (let s = 0; s < nScales; s++) { inst[(r * nScales + s) * 2] = r; inst[(r * nScales + s) * 2 + 1] = s }
    g.setAttribute('aInst', new THREE.InstancedBufferAttribute(inst, 2))
    g.instanceCount = nRings * nScales
    const ring = Array.from({ length: Math.max(NA, NB) }, () => new THREE.Vector4(0, 0, 0, 0.2))
    const mat = track(new THREE.ShaderMaterial({
      vertexShader: WALL_VERT, fragmentShader: WALL_FRAG, side: THREE.DoubleSide,
      extensions: { derivatives: true },
      uniforms: {
        uRing: { value: ring }, uVis: { value: new Float32Array(Math.max(NA, NB)) },
        uPitch: { value: (Math.PI * 2) / nScales }, uHalfW: { value: cfg.halfW }, uCapA: { value: cfg.cap }, uCapExtra: { value: cfg.capExtra },
        uLeanK: { value: new Float32Array(Math.max(NA, NB)) }, uHRoot: { value: cfg.hRoot }, uHDome: { value: cfg.hDome }, uDomePow: { value: cfg.domePow }, uScale: { value: cfg.scale },
        uPal: { value: sec === 0 ? palA : palB }, uPalX: { value: sec === 0 ? palAE : palX }, uPalY: { value: sec === 0 ? palAD : palB }, uXm: { value: 0 }, uYm: { value: 0 }, uSec: { value: sec }, uLnClip: { value: 5 }, uTau: { value: cfg.tau },
        uGlowK: { value: 0 }, uLift: { value: 0 }, uWhite: { value: 0 }, uPx: { value: 1 }, uVW: { value: 1920 }, uCtr: { value: new THREE.Vector2() },
        uSky: { value: new THREE.Vector3(0.9, 0.9, 1) }, uGlowBlue: { value: new THREE.Vector3(...hex3(cfg.glowBlue)) }, uGlowViolet: { value: new THREE.Vector3(...hex3(cfg.glowViolet)) },
      },
    }))
    const mesh = new THREE.Mesh(g, mat)
    mesh.frustumCulled = false
    scene.add(mesh)
    return { mesh, mat, n: nRings, ring }
  }
  const wallA = makeWall(0, NA, 48, { halfW: (Math.PI / 48) * 1.04, cap: 1.0, capExtra: 0.035, lean: 0, hRoot: 0.045, hDome: 0.05, domePow: 0.5, scale: 0.94, tau: 0.5, glowBlue: '#5AC0F0', glowViolet: '#9CA0F2' })
  const wallB = makeWall(1, NB, 24, { halfW: (Math.PI / 24) * 1.06, cap: 0.62, capExtra: 0.052, lean: 0, hRoot: 0.025, hDome: 0.012, domePow: 1.0, scale: 1.0, tau: 0.42, glowBlue: '#3A7ED8', glowViolet: '#6C62DC' })

  function updateWall(w, u, ang, rimU, glowK, leanFn, bodyLn) {
    const n = w.n
    for (let k = 0; k < n; k++) {
      const lnTip = Math.log(0.5 * u[k])
      const ratio = k > 0 ? u[k] / u[k - 1] : u[1] / u[0]
      const rowLn = Math.max(0.08, Math.log(Math.max(1.05, ratio)))
      const lnRoot = bodyLn ? lnTip - Math.max(bodyLn, 1.3 * rowLn) : (k >= 2 ? Math.log(0.5 * u[k - 2]) : lnTip - 2 * rowLn) - 0.012
      w.ring[k].set(lnTip, lnRoot, Array.isArray(ang) || ang.length ? ang[k] : ang, rowLn)
    }
    const lnClip = Math.log(0.5 * rimU)
    for (let k = 0; k < n; k++) w.mat.uniforms.uVis.value[k] = u[k] > 1.62 && w.ring[k].y < lnClip + 0.01 ? 1 : 0
    for (let k = 0; k < n; k++) w.mat.uniforms.uLeanK.value[k] = leanFn(u[k])
    w.mat.uniforms.uLnClip.value = lnClip
    w.mat.uniforms.uGlowK.value = glowK
  }

  // ---- the glass cursor
  const envScene = new THREE.Scene()
  {
    const sg = new THREE.SphereGeometry(20, 32, 16)
    const sm = new THREE.ShaderMaterial({ side: THREE.BackSide, uniforms: {},
      vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `varying vec3 vP; void main(){ float h = normalize(vP).y; vec3 top = vec3(0.80,0.88,1.0); vec3 mid = vec3(0.30,0.40,0.80); vec3 bot = vec3(0.10,0.14,0.45);
        vec3 c = h > 0.0 ? mix(mid, top, pow(h, 0.7)) : mix(mid, bot, pow(-h, 0.6)); gl_FragColor = vec4(c, 1.0); }` })
    envScene.add(new THREE.Mesh(sg, sm))
    const lampMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(7, 7.6, 8.4), side: THREE.DoubleSide })
    for (const [x, y, z, rx, ry, w, h] of [[0, 9, 0, Math.PI / 2, 0, 12, 12], [-9, 2, 3, 0, Math.PI / 2, 4, 14], [9, 1, -3, 0, -Math.PI / 2, 3, 12], [0, 2, -10, 0, 0, 14, 3]]) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), lampMat); m.position.set(x, y, z); m.rotation.set(rx, ry, 0); envScene.add(m)
    }
  }
  const pmrem = new THREE.PMREMGenerator(renderer)
  const envTex = pmrem.fromScene(envScene, 0.03).texture
  pmrem.dispose()
  function roundedShape(pts, r) {
    const sh = new THREE.Shape(), n = pts.length
    for (let i = 0; i < n; i++) {
      const p0 = pts[(i + n - 1) % n], p1 = pts[i], p2 = pts[(i + 1) % n]
      const d1 = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]), d2 = Math.hypot(p2[0] - p1[0], p2[1] - p1[1])
      const a = [p1[0] + (p0[0] - p1[0]) * Math.min(0.5, r / d1), p1[1] + (p0[1] - p1[1]) * Math.min(0.5, r / d1)]
      const b = [p1[0] + (p2[0] - p1[0]) * Math.min(0.5, r / d2), p1[1] + (p2[1] - p1[1]) * Math.min(0.5, r / d2)]
      if (i === 0) sh.moveTo(a[0], a[1]); else sh.lineTo(a[0], a[1])
      sh.quadraticCurveTo(p1[0], p1[1], b[0], b[1])
    }
    sh.closePath()
    return sh
  }
  const arrowShape = roundedShape([[0.5, 0], [-0.46, 0.43], [-0.27, 0], [-0.46, -0.43]], 0.07)
  const cursorGeo = track(new THREE.ExtrudeGeometry(arrowShape, { depth: 0.07, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.025, bevelSegments: 4, curveSegments: 10 }))
  cursorGeo.translate(0, 0, -0.035)
  const cursorMat = track(new THREE.MeshPhysicalMaterial({ color: 0xffffff, transmission: 1, thickness: 0.5, ior: 1.45, roughness: 0.03,
    attenuationColor: new THREE.Color(0x6b78f5), attenuationDistance: 0.3, envMap: envTex, envMapIntensity: 1.5, clearcoat: 1, clearcoatRoughness: 0.03 }))
  const cursor = new THREE.Mesh(cursorGeo, cursorMat)
  cursor.visible = false
  scene.add(cursor)
  const CURSOR_LEN = 0.3
  const SPIN = [[88, -1.9], [93, -1.57], [101, 0], [104.5, 0.35], [107.5, 1.57], [116.5, 3.14], [122, 4.71], [130, 7]]
  function spinAt(f) {
    for (let i = 1; i < SPIN.length; i++) if (f <= SPIN[i][0]) return lerp(SPIN[i - 1][1], SPIN[i][1], (f - SPIN[i - 1][0]) / (SPIN[i][0] - SPIN[i - 1][0]))
    return SPIN[SPIN.length - 1][1]
  }

  // ---- overlay: emoji, sparks, card, trail (screen space, in frame widths from the axis)
  function tex(im) { const t = new THREE.Texture(im); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.needsUpdate = true; return track(t) }
  const sprites = {}
  function makeSprite(name, im, warmOnly) {
    const m = new THREE.MeshBasicMaterial({ map: tex(im), transparent: true, depthTest: false, depthWrite: false })
    track(m)
    const mesh = new THREE.Mesh(track(new THREE.PlaneGeometry(1, 1)), m)
    mesh.visible = false; mesh.renderOrder = 5
    oScene.add(mesh)
    sprites[name] = { mesh, box: warmBox(im, warmOnly) }
  }
  makeSprite('thumb', imThumb, false)
  makeSprite('fire', imFire, false)
  makeSprite('party', imParty, true)
  function dotTexture(inner, outer) {
    const c = document.createElement('canvas'); c.width = c.height = 64
    const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 30)
    gr.addColorStop(0, inner); gr.addColorStop(0.55, outer); gr.addColorStop(1, 'rgba(0,0,0,0)')
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64)
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return track(t)
  }
  const sparkMats = [new THREE.MeshBasicMaterial({ map: dotTexture('#ffd0a0', '#e9704f'), transparent: true, depthTest: false, depthWrite: false }),
    new THREE.MeshBasicMaterial({ map: dotTexture('#fff0a0', '#f2b84b'), transparent: true, depthTest: false, depthWrite: false })]
  const sparks = sparkMats.map((m) => { track(m); const mesh = new THREE.Mesh(track(new THREE.PlaneGeometry(1, 1)), m); mesh.visible = false; mesh.renderOrder = 5; oScene.add(mesh); return mesh })
  // card
  const cardTex = (() => {
    const c = document.createElement('canvas'); c.width = 256; c.height = 180
    const g = c.getContext('2d'); const gr = g.createLinearGradient(0, 0, 256, 180)
    gr.addColorStop(0, '#3F66D0'); gr.addColorStop(0.55, '#5A6FE0'); gr.addColorStop(1, '#7B5BE0')
    g.fillStyle = gr; g.beginPath(); g.roundRect(2, 2, 252, 176, 14); g.fill()
    const lg = g.createLinearGradient(0, 0, 0, 180); lg.addColorStop(0, 'rgba(255,255,255,0.22)'); lg.addColorStop(0.5, 'rgba(255,255,255,0)')
    g.fillStyle = lg; g.beginPath(); g.roundRect(2, 2, 252, 176, 14); g.fill()
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return track(t)
  })()
  const card = new THREE.Mesh(track(new THREE.PlaneGeometry(1, 0.7)), track(new THREE.MeshBasicMaterial({ map: cardTex, transparent: true, depthTest: false, depthWrite: false })))
  card.visible = false; card.renderOrder = 6; oScene.add(card)
  // trail ribbon
  const trailGeo = track(new THREE.BufferGeometry())
  const trailPos = new Float32Array(TRAIL_N * 2 * 3), trailV = new Float32Array(TRAIL_N * 2 * 2)
  const trailIdx = []
  for (let i = 0; i + 1 < TRAIL_N; i++) { const a = i * 2; trailIdx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2) }
  trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3))
  trailGeo.setAttribute('aV', new THREE.BufferAttribute(trailV, 2))
  trailGeo.setIndex(trailIdx)
  const trailMat = track(new THREE.ShaderMaterial({ vertexShader: TRAIL_VERT, fragmentShader: TRAIL_FRAG, transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { uA: { value: 1 }, uCore: { value: new THREE.Vector3(1, 1, 1) }, uEdge: { value: new THREE.Vector3(...hex3('#C9DFFA')) } } }))
  const trail = new THREE.Mesh(trailGeo, trailMat)
  trail.frustumCulled = false; trail.renderOrder = 4
  oScene.add(trail)

  // ---- state
  const view = { x: 0, y: 0, w: 1, h: 1, tanH: 1, W: 1, H: 1, dpr: 1 }
  const post = {
    rt: null,
    mat: track(new THREE.ShaderMaterial({ vertexShader: POST_VERT, fragmentShader: POST_FRAG, depthTest: false, depthWrite: false,
      uniforms: { tDiffuse: { value: null }, uK: { value: 0 }, uCtr: { value: new THREE.Vector2(0.5, 0.5) } } })),
  }
  post.quad = new THREE.Mesh(track(new THREE.PlaneGeometry(2, 2)), post.mat)
  post.quad.frustumCulled = false
  post.scene = new THREE.Scene(); post.scene.add(post.quad)
  post.cam = new THREE.Camera()

  function resize(cssW, cssH, dpr) {
    view.W = cssW; view.H = cssH; view.dpr = dpr
    renderer.setPixelRatio(dpr)
    renderer.setSize(cssW, cssH, false)
    if (post.rt) { post.rt.dispose(); post.rt = null }
  }
  function applyView(x, y, w, h) { // css px, origin top-left
    view.x = x; view.y = y; view.w = w; view.h = h
    const aspect = w / h
    const tanH = aspect >= 1.25 ? 1.0 : Math.max(0.35, aspect / 1.25)
    view.tanH = tanH
    camera.aspect = aspect
    camera.fov = (2 * Math.atan(tanH / aspect) * 180) / Math.PI
    camera.updateProjectionMatrix()
    oCam.left = -0.5 * tanH; oCam.right = 0.5 * tanH; oCam.top = (0.5 * tanH) / aspect; oCam.bottom = (-0.5 * tanH) / aspect
    oCam.updateProjectionMatrix()
  }

  function place(sp, box, cxF, cyF, wF, hF, rot) { // a sprite so that its picture's box lands on the film-frame box
    const b = sp.box
    const Wq = wF / (b.x1 - b.x0), Hq = (hF * HT) / (b.y1 - b.y0)
    const bcx = (b.x0 + b.x1) / 2, bcy = (b.y0 + b.y1) / 2
    const x = cxF - AX, y = -(cyF - AY) * HT
    sp.mesh.scale.set(Wq, Hq, 1)
    sp.mesh.rotation.z = rot || 0
    const ox = (bcx - 0.5) * Wq, oy = -(bcy - 0.5) * Hq
    const c = Math.cos(rot || 0), s = Math.sin(rot || 0)
    sp.mesh.position.set(x - (ox * c - oy * s), y - (ox * s + oy * c), 0)
    sp.mesh.visible = true
  }
  const track5 = (rows, f, n) => rowAt(rows, f, n)
  function cursorState(f) {
    const r = rowAt(CURSOR, f, 4)
    if (!r) return null
    return r
  }
  let zSmooth = null
  function cursorZ(f) {
    const at = (ff) => { const r = rowAt(CURSOR, Math.min(128, Math.max(88, ff)), 4); return Math.max(r[2], r[3] * HT) * 1.05 }
    let s = 0, n = 0
    for (let d = -2; d <= 2; d += 0.5) { s += at(f + d); n++ }
    return (0.5 * CURSOR_LEN) / (s / n)
  }

  const sparkRight = SPARK.filter((r) => r[1] > 0.6 && !(r[0] === 122 && r[1] < 0.8))
  function frameBox(rows, f) { return rowAt(rows, f, 4) }

  function setOverlay(f, S) {
    // emoji
    const th = frameBox(THUMB, f)
    if (th && f <= 111) place(sprites.thumb, null, th[0], th[1], th[2], th[3], f >= 103 && f <= 110 ? -0.2 : 0); else sprites.thumb.mesh.visible = false
    const fi = frameBox(FIRE, f)
    if (fi) place(sprites.fire, null, fi[0], fi[1], fi[2], fi[3], 0.0); else sprites.fire.mesh.visible = false
    const pa = frameBox(PARTY, f)
    if (pa) place(sprites.party, null, pa[0], pa[1], pa[2], pa[3], 0.17); else sprites.party.mesh.visible = false
    // sparks
    const sr = rowAt(sparkRight, f, 4)
    if (sr && f >= 114) { const h = Math.max(0.012, sr[3] * 1.4) * HT; sparks[0].position.set(sr[0] - AX, -(sr[1] - AY) * HT, 0); sparks[0].scale.set(h, h, 1); sparks[0].visible = true } else sparks[0].visible = false
    if (f >= 116 && f <= 123) {
      const t = (f - 116) / 6
      const sx = lerp(0.594, 0.719, t), sy = lerp(0.41, 0.298, t), h = 0.012 * HT * (f > 122 ? 1 - (f - 122) : 1)
      sparks[1].position.set(sx - AX, -(sy - AY) * HT, 0); sparks[1].scale.set(h, h, 1); sparks[1].visible = h > 0
    } else sparks[1].visible = false
    // card
    let cd = null
    const keys = Object.keys(CARD).map(Number)
    if (f >= 120 && f <= keys[keys.length - 1]) {
      const k0 = Math.floor(f), k1 = Math.min(k0 + 1, keys[keys.length - 1]), q = f - k0
      cd = [lerp(CARD[k0][0], CARD[k1][0], q), lerp(CARD[k0][1], CARD[k1][1], q)]
    }
    if (cd) {
      const L = cd[0]
      card.scale.set(L, L, 1)
      card.rotation.z = (cd[1] * Math.PI) / 180
      card.position.set(0.502 - AX, -(0.49 - AY) * HT, 0)
      card.visible = true
    } else card.visible = false
    // trail
    let drawn = false
    for (let pi = 0; pi < trailPre.length && !drawn; pi++) {
      const ks = trailPre[pi]
      if (f < ks[0].f - 0.001 || f > ks[ks.length - 1].f + 0.001) continue
      let i = 1
      while (i < ks.length - 1 && ks[i].f < f) i++
      const k0 = ks[i - 1], k1 = ks[i]
      const q = clamp01((f - k0.f) / (k1.f - k0.f))
      let alpha = lerp(k0.a, k1.a, q)
      if (pi === 0) alpha *= 1 - smooth(96.2, 97.0, f)
      if (pi === 1) alpha *= smooth(97.3, 98.0, f)
      if (alpha <= 0.01) continue
      const wW = lerp(k0.wpx, k1.wpx, q) / 1920
      for (let j = 0; j < TRAIL_N; j++) {
        const px = lerp(k0.pts[j][0], k1.pts[j][0], q) - AX, py = -(lerp(k0.pts[j][1], k1.pts[j][1], q) - AY) * HT
        const jp = Math.max(0, j - 1), jn = Math.min(TRAIL_N - 1, j + 1)
        const dx = lerp(k0.pts[jn][0], k1.pts[jn][0], q) - lerp(k0.pts[jp][0], k1.pts[jp][0], q)
        const dy = -(lerp(k0.pts[jn][1], k1.pts[jn][1], q) - lerp(k0.pts[jp][1], k1.pts[jp][1], q)) * HT
        const l = Math.hypot(dx, dy) || 1
        const nx = -dy / l, ny = dx / l
        const u = j / (TRAIL_N - 1)
        const hw = wW * 0.5 * (0.15 + 0.85 * smooth(0, 0.30, u)) * 1.35
        trailPos.set([px + nx * hw, py + ny * hw, 0, px - nx * hw, py - ny * hw, 0], j * 6)
        trailV.set([1, 1, -1, 1], j * 4)
      }
      trailGeo.attributes.position.needsUpdate = true
      trailGeo.attributes.aV.needsUpdate = true
      const fade = f > 113 ? 0.85 : 1
      trailMat.uniforms.uA.value = alpha * fade
      trail.visible = true
      drawn = true
    }
    if (!drawn) trail.visible = false
  }

  function setCursor(f) {
    const r = rowAt(CURSOR, f, 4)
    if (!r || f > 129) { cursor.visible = false; return }
    const Z = cursorZ(f)
    const X = 2 * Z * (r[0] - AX), Y = -2 * Z * HT * (r[1] - AY)
    cursor.position.set(X, Y, -Z)
    const alpha = Math.atan2(-Y, -X)
    const spin = spinAt(f)
    cursor.quaternion.setFromEuler(new THREE.Euler(spin, 0.18, alpha, 'ZXY'))
    cursor.scale.setScalar(CURSOR_LEN)
    cursor.visible = true
  }

  function setViewportCss(x, y, w, h) {
    renderer.setViewport(x, view.H - y - h, w, h)
    renderer.setScissor(x, view.H - y - h, w, h)
  }

  const mainTint = { sky: new THREE.Vector3() }
  function draw(f, rect, o = {}) {
    const S = sampleFlight(f)
    const full = !rect || (rect.x <= 0.5 && rect.y <= 0.5 && Math.abs(rect.w - view.W) < 1 && Math.abs(rect.h - view.H) < 1)
    const rx = full ? 0 : rect.x, ry = full ? 0 : rect.y, rw = full ? view.W : rect.w, rh = full ? view.H : rect.h
    applyView(rx, ry, rw, rh)
    // uniforms
    skyMat.uniforms.uUL.value.set(...S.skyUL); skyMat.uniforms.uLR.value.set(...S.skyLR)
    const skyMid = [(S.skyUL[0] + S.skyLR[0]) / 2, (S.skyUL[1] + S.skyLR[1]) / 2, (S.skyUL[2] + S.skyLR[2]) / 2]
    const slopeA = 0.82 + (0.60 - 0.82) * smooth(93, 100, f) + (0.78 - 0.60) * smooth(101, 107, f)
    const bodyA = 0.55 + (0.90 - 0.55) * smooth(93, 100, f) + (1.15 - 0.90) * smooth(100, 108, f)
    updateWall(wallA, S.A, S.angA, S.rimAU, 0.6, () => slopeA, bodyA)
    updateWall(wallB, S.B, new Float32Array(NB).fill(S.angB), S.rimBU, 0.25 + 0.75 * S.glowB, (u) => 0.73 * (1 + 0.9 * smooth(4.6, 2.3, u)))
    const pxScale = (rw * view.dpr) / 1920
    for (const w of [wallA, wallB]) {
      const u = w.mat.uniforms
      u.uLift.value = S.lift; u.uWhite.value = S.white; u.uPx.value = pxScale; u.uVW.value = rw * view.dpr
      u.uCtr.value.set((rx + rw / 2) * view.dpr, (view.H - ry - rh / 2) * view.dpr)
      u.uSky.value.set(...skyMid)
    }
    wallA.mat.uniforms.uXm.value = 1 - smooth(94.5, 99, f)
    wallA.mat.uniforms.uYm.value = smooth(100.5, 105, f)
    wallB.mat.uniforms.uXm.value = S.lift
    wallA.mesh.visible = S.A[7] > 1.2 && f < 114
    setOverlay(f, S)
    setCursor(f)
    const useBlur = full && S.blur > 0.012 && !o.noBlur
    // render
    renderer.setRenderTarget(null)
    renderer.setScissorTest(false)
    renderer.setViewport(0, 0, view.W, view.H)
    renderer.clear()
    if (useBlur) {
      const bw = Math.round(view.W * view.dpr), bh = Math.round(view.H * view.dpr)
      if (!post.rt || post.rt.width !== bw || post.rt.height !== bh) {
        if (post.rt) post.rt.dispose()
        post.rt = new THREE.WebGLRenderTarget(bw, bh, { type: THREE.HalfFloatType, samples: 4, depthBuffer: true })
      }
      renderer.setRenderTarget(post.rt)
      renderer.setViewport(0, 0, bw, bh)
      renderer.clear()
      renderer.render(scene, camera)
      renderer.render(oScene, oCam)
      renderer.setRenderTarget(null)
      renderer.setViewport(0, 0, view.W, view.H)
      post.mat.uniforms.tDiffuse.value = post.rt.texture
      post.mat.uniforms.uK.value = S.blur
      renderer.render(post.scene, post.cam)
    } else {
      renderer.setScissorTest(true)
      setViewportCss(rx, ry, rw, rh)
      renderer.render(scene, camera)
      renderer.render(oScene, oCam)
      renderer.setScissorTest(false)
    }
    return S
  }

  function dispose() {
    for (const d of disposables) { try { d.dispose() } catch (e) { /* ignore */ } }
    envTex.dispose()
    if (post.rt) post.rt.dispose()
    renderer.dispose()
    try { renderer.forceContextLoss() } catch (e) { /* ignore */ }
  }
  async function warm() { try { await renderer.compileAsync(scene, camera) } catch (e) { renderer.compile(scene, camera) } }
  function finish() { gl.finish() }
  return { renderer, resize, draw, dispose, warm, finish, view }
}
