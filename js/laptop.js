// The mini desktop ON the laptop, in the room (computers only; a phone, no WebGL or reduced motion keep the full-screen
// desktop). The live room (js/room3d/stage.js) flies its camera in until the laptop's lit glass fills FILL of the
// window's height and stays there, breathing; the real #desktop (windows, taskbar, apps) has a fixed size at the
// glass's own shape and is drawn onto the glass every frame by a CSS matrix3d: the homography that takes its four
// corners to the glass's four corners as the live camera sees them (Heckbert, "Fundamentals of Texture Mapping and
// Image Warping", 1989, the square-to-quad map). The browser hit-tests through the transform, so clicks, typing and
// scrolling simply work; a drag asks toLocal() for the desktop's own pixels.
// The desktop's panels are glass (css/laptop.css; reference film/ref/windows365.mp4): what is behind them, the
// wallpaper on the laptop's screen, is frosted and bent at their edges by the screen's own shader (look.js), from the
// boxes this module reads off the page every frame; their rims of light slide with the eye and the pointer.
// Over the desktop, lightly, what makes it a lit screen in a room and not a page pasted on it: the room's lamp and a
// broad sheen reflected in the glass (both move with the eye as reflections do), the glass's edge shade and a slight
// fall-off toward its edges, and a dimming when it is seen from the side. The screen's light on the keys and the desk
// is the room's own shader (look.js, uSpill).
import { el, reduced, CONFIG } from './config.js'

export const FILL = 0.82                     // the glass's share of the window's height at rest (90% of its width at most)
const MIN_H = 760                            // below this the desktop is drawn larger than it shows, never cramped
const phone = matchMedia(CONFIG.phone)
let r3d = null, node = null, ov = null, M = null, I = null, size = [0, 0], lost = () => {}, ready = () => {}
const pointer = [0, 0], rims = [], dims = [], boxes = [], radius = new WeakMap()
addEventListener('pointermove', (e) => { pointer[0] = e.clientX / innerWidth * 2 - 1; pointer[1] = e.clientY / innerHeight * 2 - 1 }, { passive: true })

// the live room, from js/room.js (null when it is dropped: the desktop then goes back to full screen)
export function attach(api) {
  const had = r3d && node
  r3d = api
  if (!api && had) { unglue(); lost() }
  if (api) ready()
}
export const onLost = (fn) => { lost = fn }
export const onReady = (fn) => { ready = fn }            // the live room is up: js/desktop.js builds itself for the laptop now, out of sight
export const can = () => !!r3d && !phone.matches && !reduced()
export const fill = (aspect, gw, gh) => Math.min(FILL, 0.9 * aspect * gh / gw)

// The desktop's own size: the glass's on-screen size at rest, so a 14 px label shows at 14 px (at 1920 x 1080 the
// glass is 886 px tall: the desktop is 1363 x 886)
// SHARPNESS. A layer under a perspective transform is rastered by Chrome at the device pixel ratio of its OWN CSS
// pixels (the projective map has no single scale, so cc falls back to the device scale) and the compositor then
// resamples that raster bilinearly through the homography. At 1 texel per desktop pixel every glyph was resampled at
// a sub-pixel offset (and, below MIN_H, shrunk 5 %): soft text and icons at every size. So the desktop is drawn
// supersampled: laid out in its own pixels as before but zoomed by SS (CSS zoom, which re-lays text and vectors at
// the larger size, not a scaled bitmap), so its layer holds 2 device pixels per desktop pixel; the matrix below folds
// the 1/SS back in. The compositor then only ever shrinks the raster (about 2:1), which is crisp, and never stretches
// it. The raster scale does not depend on the camera, so nothing is re-rastered while the camera moves; a new window
// size or device pixel ratio re-measures (desktop.js on resize) and the browser rasters the new size once.
const SS = () => Math.max(1, 2 / (devicePixelRatio || 1))
let ss = 1
function measure() {
  const app = document.getElementById('app'), W = app.clientWidth, H = app.clientHeight, [gw, gh] = r3d.glassSize()
  const h = Math.max(MIN_H, Math.round(H * fill(W / H, gw, gh)))
  size = [Math.round(h * gw / gh), h]
  ss = SS()
  const r = 0.0045 / gh * h                  // the glass's own corner (look.js: 4.5 mm inside the rim)
  node.style.cssText = `width:${size[0]}px;height:${size[1]}px;--glass-r:${r.toFixed(1)}px;zoom:${ss}`
}

export function glue(root) {
  if (!r3d) return
  node = root
  measure()
  ov = root.querySelector(':scope > .gl') || root.appendChild(el('div', 'gl', '<i class="sh"></i><i class="lp"></i><i class="dm"></i>'))
  ov.setAttribute('aria-hidden', 'true')
  r3d.onGlass(frame)
}
export function unglue() {
  if (r3d) { r3d.onGlass(null); r3d.panels([], 1, 1) }
  if (node) { node.style.cssText = ''; node = null }
  M = I = null
}
// Built for the laptop, unseen: it is first painted flat at its own size for a moment, so the browser keeps it painted
// at full sharpness (css/laptop.css, will-change), then it goes onto the glass, small on the laptop in the room, where
// it rests invisible (#desktop.dormant) and is already painted and in place when the camera next flies in. Painted
// at the room's small size instead, it was painted again, larger, several times during the flight in.
export function prime(root) {
  if (!r3d) return
  node = root
  measure()
  const app = document.getElementById('app')
  node.style.transform = `translate(${Math.round((app.clientWidth - size[0] * ss) / 2 / ss)}px, ${Math.round((app.clientHeight - size[1] * ss) / 2 / ss)}px)`      // lengths in a zoomed box are its own pixels
  requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(() => { if (node === root) glue(root) })))
}
// the window changed size (js/desktop.js calls this before it lays its windows out again)
export function remeasure() { if (node && r3d) measure() }

// G: the glass's corners on the page (top-left, top-right, bottom-right, bottom-left), how square on the eye is,
// the lamp's reflection (across, down, shown) and the eye's offset from the glass's middle (across, down), all from
// stage.js. Everything is read off the page first, then everything is written, so the page is laid out once a frame.
function frame(G) {
  const [w, h] = size
  readPanels()
  const lx = Math.min(1, Math.max(0, 0.3 + G[12] * 0.5 + pointer[0] * 0.2)), ly = Math.min(1, Math.max(0, 0.32 + G[13] * 0.5 + pointer[1] * 0.2))
  rims.length = dims.length = 0
  for (const r of node.getElementsByClassName('lg-rim')) { rims.push(r); dims.push(r.offsetWidth, r.offsetHeight) }
  // the homography: the unit square to the glass, then the desktop's pixels to the unit square
  const x0 = G[0], y0 = G[1], x1 = G[2], y1 = G[3], x2 = G[4], y2 = G[5], x3 = G[6], y3 = G[7]
  const dx1 = x1 - x2, dx2 = x3 - x2, dy1 = y1 - y2, dy2 = y3 - y2, sx = x0 - x1 + x2 - x3, sy = y0 - y1 + y2 - y3
  const den = dx1 * dy2 - dx2 * dy1
  if (!den) return
  const g = (sx * dy2 - dx2 * sy) / den, k = (dx1 * sy - sx * dy1) / den
  M = [(x1 - x0 + g * x1) / w, (x3 - x0 + k * x3) / h, x0, (y1 - y0 + g * y1) / w, (y3 - y0 + k * y3) / h, y0, g / w, k / h, 1]
  I = null
  // the browser applies a zoomed box's transform in zoomed pixels and scales its result by the zoom (it conjugates the
  // matrix by the zoom): the page rows are divided by SS here, so the desktop's own pixel (x, y) still lands on M(x, y)
  const z = ss
  node.style.transform = `matrix3d(${M[0] / z},${M[3] / z},0,${M[6]},${M[1] / z},${M[4] / z},0,${M[7]},0,0,1,0,${M[2] / z},${M[5] / z},0,1)`
  r3d.panels(boxes, w, h)
  // the reflections move with the eye, as a reflection does; the glass dims a little seen from the side
  const [sh, lp, dm] = ov.children
  sh.style.transform = `translate(${(G[12] * w * 0.6).toFixed(1)}px, ${(G[13] * h * 0.6).toFixed(1)}px) scale(10)`      // css/laptop.css: drawn at a tenth of its size
  lp.style.opacity = G[11] ? Math.min(1, 4 * Math.min(G[9], 1 - G[9], G[10], 1 - G[10]) + 0.6).toFixed(3) : 0
  if (G[11]) lp.style.transform = `translate(${(G[9] * w).toFixed(1)}px, ${(G[10] * h).toFixed(1)}px)`
  dm.style.opacity = Math.min(0.4, (1 - G[8]) * 0.5).toFixed(3)
  // the panels' rims: the light along the top and the left edge sits where the eye and the pointer put it
  for (let i = 0; i < rims.length; i++) {
    const rw = dims[i * 2], rh = dims[i * 2 + 1]
    if (!rw) continue
    rims[i].firstChild.style.transform = `translate3d(${(lx * rw * 0.56).toFixed(1)}px,0,0)`
    rims[i].lastChild.style.transform = `translate3d(0,${(ly * rh * 0.44).toFixed(1)}px,0)`
  }
}

// The glass panels as the screen's shader needs them: each one's box in the desktop's own pixels, as it is laid out
// and then moved or scaled by its own animation (so a window rising, growing, shrinking to the taskbar or being dragged
// is followed exactly), its corner radius, and how much of it shows (its own fade, and that of the layer it is in).
// The taskbar, the start card, the search panel, and the two windows in front.
function readPanels() {
  boxes.length = 0
  if (!M) return
  const wins = node.querySelector(':scope > .wins')
  const list = [node.querySelector(':scope > .taskbar'), node.querySelector(':scope > .start'), node.querySelector(':scope > .sf:not([hidden])'),
    ...(wins ? [...wins.children].filter((x) => x.classList.contains('w') && !x.hidden).sort((a, b) => b.style.zIndex - a.style.zIndex).slice(0, 2) : [])]
  for (const e of list) {
    if (!e || boxes.length >= 5) continue
    let x = 0, y = 0, w = e.offsetWidth, h = e.offsetHeight, k = 1
    if (!w) continue
    for (let p = e; p && p !== node; p = p.offsetParent) { x += p.offsetLeft; y += p.offsetTop }
    const cs = getComputedStyle(e), t = cs.transform
    if (t && t !== 'none') { const m = new DOMMatrixReadOnly(t), cx = x + w / 2 + m.e, cy = y + h / 2 + m.f; k = m.a; w *= m.a; h *= m.d; x = cx - w / 2; y = cy - h / 2 }      // about its middle
    if (!radius.has(e)) radius.set(e, parseFloat(cs.borderTopLeftRadius) || 0)
    boxes.push([x, y, x + w, y + h, radius.get(e) * k, +cs.opacity * +getComputedStyle(e.parentElement).opacity])
  }
}

function inverse() {
  if (!I) {
    const [a, b, c, d, e, f, g, h, i] = M
    I = [e * i - f * h, c * h - b * i, b * f - c * e, f * g - d * i, a * i - c * g, c * d - a * f, d * h - e * g, b * g - a * h, a * e - b * d]
  }
  return I
}
function toLocalAt(x, y) {
  const J = inverse(), u = J[0] * x + J[1] * y + J[2], v = J[3] * x + J[4] * y + J[5], q = J[6] * x + J[7] * y + J[8]
  return [u / q, v / q]
}
// a point on the page as the desktop's own pixels (the inverse of the map above); off the laptop, the page's own
export function toLocal(x, y) {
  const o = document.getElementById('app').getBoundingClientRect()
  return M ? toLocalAt(x - o.left, y - o.top) : [x - o.left, y - o.top]
}
