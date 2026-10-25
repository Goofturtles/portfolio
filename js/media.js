// media/manifest.json is the contract with the shot team: this is the only place that reads it.
// Per place (and per theme of the room) the manifest may carry, beside the older poster / clip fields:
//   plates   { desk, phone, portrait }   each { w, h, avif, webp, jpg }: a 2560 x 1440 plate for computers, a
//                                        1920 x 1080 one for phones, in three formats; the browser takes the first it reads
//   clips    { desk, phone, portrait }   each { src, w, h, fps, keyint }: 2560 x 1440 at 60 fps for computers,
//                                        1080 on the short side at 30 fps for phones
//   loop     { desk, phone, portrait }   the same shape: an idle loop for the place to rest on, first frame = last frame
// The site chooses a CLIP by small(): a phone, a touch-only screen or a visitor who asked to save data gets the phone
// copy and never the computer's file. It chooses a STILL by the real pixels it is shown on (chooseStill, below), and a
// picture is never shown larger than it is (js/room.js).
import { retry, wait } from './config.js'

export const media = { manifest: null, theme: null }
const TAG = { wip: 'Work-in-progress render', preview: 'Work-in-progress render', prop: 'Work-in-progress render', none: '' }       // a place with no render is never shown as a drawn stand-in: nothing to tag

export async function loadManifest() {
  // ?manifest=path tries another manifest (a test render) without touching the live one
  const url = new URLSearchParams(location.search).get('manifest') || 'media/manifest.json'
  media.manifest = await retry(async () => { const r = await fetch(url); if (!r.ok) throw new Error(url + ' ' + r.status); return r.json() })
  let saved = null
  try { saved = localStorage.getItem('pc-theme') } catch (e) { /* private mode: no saved theme */ }
  const ids = themes().map((t) => t.id)
  media.theme = ids.includes(saved) ? saved : media.manifest.default_theme
}
// a theme whose room has no render yet is left out until it exists (film/SPEC.md "Backgrounds")
export const themes = () => media.manifest.themes.filter((t) => { const r = (media.manifest.places.room.themes || {})[t.id]; return r && r.status !== 'none' && (r.poster || r.plates) })
// a small picture of a theme's room for the picker: the phone's plate (the real render, never a drawn swatch)
export const thumbOf = (id) => { const r = media.manifest.places.room.themes[id] || {}, p = chooseStill(r.plates, 240 * (devicePixelRatio || 1)); return (p && (p.webp || p.jpg)) || r.poster || '' }
export const themeInfo = (id = media.theme) => themes().find((t) => t.id === id)
export const portrait = () => innerWidth < innerHeight
// the small copies: a phone, any touch-only screen, and a visitor whose browser asks to save data
export const small = () => matchMedia('(max-width: 1023px), (hover: none) and (pointer: coarse)').matches || !!(navigator.connection && navigator.connection.saveData)

// ---- which still (film/SPEC.md, "A picture is chosen by the screen's real pixels") ----
// A still is never enlarged beyond 1:1 at rest. Its needed width is the stage's width, or its height x 16/9 if that is
// larger (a 16:9 picture covering a 4:3 or portrait stage is cropped to it, so its height sets the size), times the
// device pixel ratio. The smallest file at least that wide is taken, else the largest. Only a visitor who asks to save
// data, or a screen under 1700 real pixels on its long side, is given the 1920 copy. Video is the one thing still sized
// down for phones and tablets (small()).
const saving = () => !!(navigator.connection && navigator.connection.saveData)
export const realPixels = () => Math.max(screen.width, screen.height) * (devicePixelRatio || 1)
// width a still must have to be shown at rest at 1:1 on a stage of w x h CSS pixels; `ratio` is the picture's own shape (16/9; 9/16 for a portrait framing)
export const neededWidth = (w = innerWidth, h = innerHeight, ratio = 16 / 9) => Math.max(w, h * ratio) * (devicePixelRatio || 1)
// the stills of a place, from its plates: every entry that says how wide it is, narrowest first (the portrait framing is a different picture, not a size)
const stillSizes = (plates) => Object.entries(plates || {}).filter(([k]) => k !== 'portrait').flatMap(([, v]) => (Array.isArray(v) ? v : [v])).filter((v) => v && v.w).sort((a, b) => a.w - b.w)
// the one still to show: `plates` as in the manifest ({ desk, phone, 3840 ... } or a list), `need` in real pixels
export function chooseStill(plates, need = neededWidth()) {
  const all = Array.isArray(plates) ? plates.filter((v) => v && v.w).sort((a, b) => a.w - b.w) : stillSizes(plates)
  if (!all.length) return null
  if (saving() || realPixels() < 1700) return all.find((v) => v.w >= 1920) || all[all.length - 1]       // the 1920 copy
  return all.find((v) => v.w >= need) || all[all.length - 1]
}

// what to show for a place, in the current orientation and on this kind of device
export function pick(place, theme = media.theme) {
  const p = media.manifest.places[place], t = (p.themes && p.themes[theme]) || p, tall = portrait(), size = small() ? 'phone' : 'desk'
  const spots = (side) => ({ ...((p.hotspots || {})[side] || {}), ...((t.hotspots || {})[side] || {}) })
  const plates = t.plates || {}, clips = t.clips || {}, loops = t.loop || {}
  const own = !!(tall && (t.portrait_poster || t.portrait_clip || plates.portrait))
  const hero = spots('landscape').projects
  const poster = tall ? t.portrait_poster || t.poster : t.poster
  // a still is chosen by the real pixels it will be shown on (chooseStill), never by whether the screen is touched; a
  // portrait framing is judged the same way against its own shape
  const portraitStill = own && (Array.isArray(plates.portrait) ? chooseStill(plates.portrait, neededWidth(innerWidth, innerHeight, 9 / 16)) : plates.portrait)
  const picture = portraitStill || chooseStill(plates) || (poster ? { jpg: poster } : null)
  // a clip: this device's own copy; a computer may fall back to the older single file, a phone only when there is no sized set at all
  const of = (set, old) => (own && set.portrait) || set[size] || (size === 'desk' ? set.phone : null) || (old && (size === 'desk' || !t.clips) ? { src: old } : null)
  const clip = of(clips, tall ? t.portrait_clip || t.clip : t.clip), loop = of(loops, null)
  return {
    poster: picture && picture.jpg, picture, clip: clip && clip.src, clipInfo: clip, loop,
    hold: t.hold || 0, status: t.status, tag: TAG[t.status] || '', own,
    hotspots: spots(tall ? 'portrait' : 'landscape'),
    // a 16:9 picture on a tall screen is aimed at the hero (the laptop): the x of its centre, as a fraction of the picture
    aim: tall && !own && hero && hero.box ? (hero.box[0] + hero.box[2]) / 2 : null,
  }
}
// where a point of the frame (fractions) lands on a stage of w x h that the frame covers
export function place(fx, fy, w, h) {
  const a = portrait() ? 9 / 16 : 16 / 9, fw = Math.max(w, h * a), fh = fw / a
  return [(w - fw) / 2 + fx * fw, (h - fh) / 2 + fy * fh]
}
// object-position for a 16:9 picture that has to keep `aim` (a fraction of its width) in the middle of a w x h stage
export function aimAt(aim, w, h) {
  if (aim == null) return ''
  const pw = Math.max(w, h * 16 / 9), over = pw - w
  return over > 0 ? `${(Math.min(1, Math.max(0, (aim * pw - w / 2) / over)) * 100).toFixed(1)}% 50%` : ''
}

// an image, decoded and ready, with retries
export const loadImage = (src) => retry(() => new Promise((ok, fail) => {
  const im = new Image()
  im.onload = () => ok(im); im.onerror = () => fail(new Error('could not load ' + src)); im.src = src
}))
// a picture in the best format this browser reads (AVIF, then WebP, then the JPEG): resolves to { el, im } once it has loaded
export const loadPicture = (pic) => retry(() => new Promise((ok, fail) => {
  const el = document.createElement('picture'), im = new Image()
  for (const [type, key] of [['image/avif', 'avif'], ['image/webp', 'webp']]) if (pic[key]) { const s = document.createElement('source'); s.type = type; s.srcset = pic[key]; el.appendChild(s) }
  im.alt = ''; im.decoding = 'async'; im.draggable = false
  im.onload = () => (im.decode ? im.decode().catch(() => {}) : Promise.resolve()).then(() => ok({ el, im })); im.onerror = () => fail(new Error('could not load ' + pic.jpg))
  el.appendChild(im)
  im.src = pic.jpg
}))

// A clip, held in memory. A plain static server (the local one) sends no byte ranges, and then a <video> pointed at
// the file cannot seek or replay; from memory it can, on any host. clipURL starts the download (once) and resolves
// to an object URL; clipNow gives that URL if it has already arrived, without waiting. Nothing is ever shown before
// it has wholly arrived, so a clip never stalls half way.
const clips = new Map(), arrived = new Map()
export function clipURL(src) {
  if (!clips.has(src)) clips.set(src, retry(async () => { const r = await fetch(src); if (!r.ok) throw new Error(src + ' ' + r.status); return URL.createObjectURL(await r.blob()) }).then((u) => { arrived.set(src, u); return u }))
  return clips.get(src)
}
export const clipNow = (src) => arrived.get(src) || null

// A clip on a loop behind a place: fetched whole first, then played; paused while it is off the screen or the tab is
// hidden, and picked up again where it was. Returns the function that removes it.
export function loopClip(video, src) {
  let wanted = false, gone = false
  const able = () => wanted && !gone && !document.hidden && seen
  let seen = true
  const sync = () => { if (able()) video.play().catch(() => {}); else video.pause() }
  const io = new IntersectionObserver((list) => { seen = list[list.length - 1].isIntersecting; sync() })
  video.muted = true; video.loop = true; video.playsInline = true; video.preload = 'auto'
  clipURL(src).then((url) => {
    if (gone) return
    video.src = url
    video.addEventListener('canplaythrough', () => { wanted = true; video.hidden = false; sync() }, { once: true })
  }).catch(() => {})
  io.observe(video)
  document.addEventListener('visibilitychange', sync)
  return () => { gone = true; io.disconnect(); document.removeEventListener('visibilitychange', sync); video.pause() }
}

// any <img> or <video> on the page that fails (film/ui builds many of its own) is asked for again, three times
export function retryFailedMedia() {
  const tries = new WeakMap()
  document.addEventListener('error', async (e) => {
    const t = e.target
    if (!(t instanceof HTMLImageElement || t instanceof HTMLVideoElement) || !t.getAttribute('src')) return
    const n = (tries.get(t) || 0) + 1
    if (n > 3) return
    tries.set(t, n)
    await wait(300 * n)
    const src = t.getAttribute('src'); t.removeAttribute('src'); t.setAttribute('src', src)
    if (t instanceof HTMLVideoElement) t.load()
  }, true)
}
