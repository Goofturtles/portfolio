// The desktop wallpaper: the Windows 11 dark bloom, alive.
// The real picture (media/wallpaper/, made by tools/make_bloom.py) is drawn by the graphics card and moved a few
// pixels at a time: slow swells push the cloth across its folds and a soft sheen slides over it. Every frame is the
// picture itself at the screen's own size (up to two device pixels per CSS pixel) and frame rate, so there is no video
// to decode and nothing to compress. The loop is seamless by construction: everything turns a whole number of times
// in LOOP seconds, so the last frame leads into the first. With no WebGL, or for a visitor who asks for less motion,
// the plain picture set by makeWall in desktop.js stays.
import { retry } from './config.js'

const DIR = 'media/wallpaper/'
const LOOP = 16                 // seconds for one turn
const SWELL = 0.0052            // how far the cloth moves across its folds, as a fraction of the picture's width
const DRIFT = 0.0022            // a slower sideways drift of whole petals
const SHEEN = 0.075             // how much the sliding light brightens and dims the cloth
const LEAN = 0.003              // how far the bloom leans away from the pointer

export const still = () => DIR + (screen.width * devicePixelRatio > 2700 ? 'bloom-3840.jpg' : 'bloom-2560.jpg')
export const small = DIR + 'bloom-1280.jpg'

const VERT = 'attribute vec2 p; varying vec2 v; void main() { v = p * .5 + .5; gl_Position = vec4(p, 0., 1.); }'
const FRAG = `precision highp float;
uniform sampler2D img, map;
uniform vec2 scale, offset, lean;
uniform float turn;
varying vec2 v;
const float TAU = 6.28318530718;
void main() {
  vec2 uv = vec2(v.x, 1. - v.y) * scale + offset;                 // the picture covers the screen, cropped evenly
  vec3 m = texture2D(map, uv).rgb;
  vec2 fold = m.rg * 2. - 1.;
  float a = TAU * turn;
  float s1 = sin(a + TAU * (uv.x * .9 + uv.y * .6));
  float s2 = sin(2. * a + TAU * (uv.y * 1.3 - uv.x * .5) + 1.7);
  float s3 = sin(a - TAU * (uv.x * 1.6 + uv.y * .2) + 4.1);
  vec2 d = fold * (${SWELL.toFixed(5)} * s1 + ${(SWELL * 0.45).toFixed(5)} * s2) + vec2(${DRIFT.toFixed(5)} * s3, ${(DRIFT * 1.2).toFixed(5)} * s1 * s3);
  d = (d + lean) * m.b;
  vec3 c = texture2D(img, uv + d).rgb;
  float l = dot(c, vec3(.2126, .7152, .0722));
  c *= 1. + ${SHEEN.toFixed(4)} * m.b * sin(a + TAU * (l * 1.4 + uv.x * .7 - uv.y * .4));
  gl_FragColor = vec4(c, 1.);
}`

// the local server now and then refuses a request in a burst: ask again before giving up (config.js)
const load = (src) => retry((n) => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = src + (n > 1 ? '?try=' + n : '') }))

// Mounts the moving bloom inside `host` (the .wall element). Returns a function that stops it.
export function mountBloom(host) {
  const cv = document.createElement('canvas')
  cv.setAttribute('aria-hidden', 'true')
  const gl = cv.getContext('webgl', { alpha: false, antialias: false })
  if (!gl) return () => {}
  const calm = matchMedia('(prefers-reduced-motion: reduce)')
  let raf = 0, dead = false, aspect = 1.6
  const lean = [0, 0], aim = [0, 0]

  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s }
  const prog = gl.createProgram()
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG)); gl.linkProgram(prog)
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return () => {}
  gl.useProgram(prog)
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
  const at = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(at); gl.vertexAttribPointer(at, 2, gl.FLOAT, false, 0, 0)
  const U = Object.fromEntries(['img', 'map', 'scale', 'offset', 'lean', 'turn'].map((n) => [n, gl.getUniformLocation(prog, n)]))
  const tex = (unit, image) => {
    gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, gl.createTexture())
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image)
    for (const [k, val] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, val)
  }

  function size() {
    const r = host.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2)
    const w = Math.max(2, Math.round(r.width * dpr)), h = Math.max(2, Math.round(r.height * dpr))
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; gl.viewport(0, 0, w, h) }
    const box = w / h                                         // cover: crop the longer side evenly
    const sx = box < aspect ? box / aspect : 1, sy = box < aspect ? 1 : aspect / box
    gl.uniform2f(U.scale, sx, sy); gl.uniform2f(U.offset, (1 - sx) / 2, (1 - sy) / 2)
  }
  function frame(now) {
    raf = 0
    if (dead || !host.isConnected) return stop()
    if (!document.hidden && host.offsetParent !== null) {     // nothing is drawn while the tab or the desktop is hidden
      size()
      for (const i of [0, 1]) lean[i] += (aim[i] - lean[i]) * 0.04
      gl.uniform2f(U.lean, lean[0] * LEAN, lean[1] * LEAN)
      gl.uniform1f(U.turn, (now / 1000 % LOOP) / LOOP)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    }
    raf = requestAnimationFrame(frame)
  }
  const move = (e) => { aim[0] = 0.5 - e.clientX / innerWidth; aim[1] = 0.5 - e.clientY / innerHeight }
  const lost = (e) => { e.preventDefault(); stop() }          // the still picture underneath takes over
  function stop() {
    if (dead) return
    dead = true; cancelAnimationFrame(raf); removeEventListener('pointermove', move); cv.removeEventListener('webglcontextlost', lost); calm.removeEventListener('change', stop); cv.remove()
    gl.getExtension('WEBGL_lose_context')?.loseContext()      // give the graphics memory back: a browser allows only a few live contexts
  }
  calm.addEventListener('change', stop)                       // the visitor asks for less motion while it runs: back to the plain picture

  Promise.all([load(still()), load(DIR + 'bloom-map.png')]).then(([image, map]) => {
    if (dead || !host.isConnected || image.naturalWidth > gl.getParameter(gl.MAX_TEXTURE_SIZE)) return stop()
    aspect = image.naturalWidth / image.naturalHeight
    tex(0, image); tex(1, map)
    gl.uniform1i(U.img, 0); gl.uniform1i(U.map, 1)
    host.appendChild(cv)
    addEventListener('pointermove', move, { passive: true })
    cv.addEventListener('webglcontextlost', lost)
    raf = requestAnimationFrame(frame)
  }).catch(() => stop())
  return stop
}
