// The flight between places (P1). With a clip in media/manifest.json ("tunnel") it plays the clip, always forwards,
// skippable with a tap, a click or a key. Until that render exists nothing is drawn here at all (film/SPEC.md
// "Backgrounds": no hand-drawn stand-in): the change of place is the room's own zoom into the laptop and a cross-fade
// (js/room.js leave(), js/main.js go()). Not shown when the visitor prefers reduced motion.
import { reduced, wait } from './config.js'
import { pick, aimAt, clipURL, clipNow } from './media.js'

const root = document.getElementById('tunnel')
// called once at start-up: the clip is fetched behind the room, so the first flight can already be the real one
export function warm() { const m = pick('tunnel'); if (m.clip) clipURL(m.clip).catch(() => {}) }

// resolves when the flight has had its time (or was skipped) AND `ready` has resolved: the place behind it is loaded
export async function play(ready = Promise.resolve()) {
  const m = pick('tunnel'), clip = !reduced() && m.clip && clipNow(m.clip)       // not arrived yet: this change of place is the zoom, the next one the clip
  if (!clip) return ready
  if (!root.firstChild) root.innerHTML = `<video muted playsinline preload="auto"></video><div class="tn-bloom"></div><span class="wip-tag"></span><button type="button" class="hb tn-skip">Skip</button>`
  const video = root.querySelector('video'), tag = root.querySelector('.wip-tag')
  tag.textContent = m.tag; tag.hidden = !m.tag
  root.classList.add('clip')
  root.classList.remove('end')
  root.hidden = false
  void root.offsetWidth
  root.classList.add('on')
  if (video.getAttribute('src') !== clip) video.src = clip
  video.poster = m.poster || ''
  video.style.objectPosition = aimAt(m.aim, root.clientWidth, root.clientHeight)
  video.currentTime = 0
  const time = Promise.race([new Promise((r) => video.addEventListener('ended', r, { once: true })), wait(6000)])
  video.play().catch(() => {})
  let skip
  const skipped = new Promise((r) => { skip = r })
  const key = (e) => { if (['Escape', 'Enter', ' '].includes(e.key)) skip() }
  root.addEventListener('click', skip); addEventListener('keydown', key)
  await Promise.all([ready, Promise.race([time, skipped])])
  root.removeEventListener('click', skip); removeEventListener('keydown', key)
  root.classList.add('end')                                  // the burst of light at the mouth of the tunnel
  await wait(200)
  root.classList.remove('on')                                // fades away over the place that is arriving
  setTimeout(() => { if (!root.classList.contains('on')) { root.hidden = true; video.pause() } }, 380)
}
