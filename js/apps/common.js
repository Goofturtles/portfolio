// What the apps on the mini desktop share. Every word and link they show comes from DATA (apps/gen/data.js, generated
// from his own data files) and the lookup (AIARJUN.ask), so its rules hold here too: a project shows only the links in
// his notes, and AERIS never gets a video. Pictures of his process come from media/own.json (tools/sync_own.py).
// Needs the globals DATA, AIARJUN, PIX and ICON (apps.all()).
import { retry, reduced, el } from '../config.js'
import { linksFor, filmThumb } from '../sections.js'
import { line } from '../icons.js'

export { linksFor, filmThumb }
export const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')
export const out = (href) => ` href="${esc(href)}"` + (/^mailto:/.test(href) ? '' : ' target="_blank" rel="noopener"')
export const host = (href) => href.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')
export const film = (p) => linksFor(p).find((l) => l.kind === 'video') || null

// a project's stills. Two of the stills in DATA are filed under the picture's name, not the project's.
const FILED = { 'lifetime-fire': 'battery-framework', 'shade-route-dusk': 'shade-route' }
export function stillsOf(p) {
  const S = window.DATA.stills, mine = Object.keys(S).filter((k) => (FILED[k] || k) === p.id).map((k) => S[k])
  return mine.length ? mine : p.visual ? [p.visual] : []
}
// a project's picture: its still. A project with no still in his data (SECOND LOOK: the only one his portfolio has
// is a photo of a person, which film/SPEC.md keeps out) gets a plain neutral tile with a small video glyph, the way a
// player shows a film that has no thumbnail: never a drawn poster.
// film = true (the Films player): a launch film's own YouTube thumbnail comes first, when there is one
export function poster(p, cls = '', filmPic = false) {
  const src = (filmPic && film(p) && filmThumb(film(p).href)) || stillsOf(p)[0], size = (window.PICTURE_SIZES || {})[src]
  return src ? `<img class="pic ${cls}" src="${esc(src)}" alt="" loading="lazy" decoding="async"${size ? ` width="${size[0]}" height="${size[1]}"` : ''}>`
    : `<span class="pic none ${cls}">${line('video', 24)}</span>`
}

// Every picture of a project already on this machine, in order: its stills, its launch film's own thumbnail, then the
// pictures of its making in media/own.json (landscape ones only, never the small thumb- copies). Each once, full size.
// A project with none gets none: never a picture of something else. [{ src, alt }]
export function picturesOf(p, ownData) {
  const pics = [], seen = new Set(), add = (src, alt) => { if (src && !seen.has(src)) { seen.add(src); pics.push({ src, alt }) } }
  for (const src of stillsOf(p)) add(src, /\/yt-/.test(src) ? p.title + ': its launch film' : 'A still from ' + p.title)
  if (film(p)) add(filmThumb(film(p).href), p.title + ': its launch film')
  for (const [k, o] of Object.entries((ownData && ownData.pictures) || {})) if (o.project === p.title && o.w > o.h && !/^thumb-/.test(k)) add(o.src, o.caption)
  return pics
}

// his own photo (portfolio-v2's portrait.jpg, the one on the room's wall), full size, framed on his face by css/apps.css
export const FACE = '<img class="me-photo" src="media/own/portrait.jpg" alt="" decoding="async">'

// media/own.json, once
let own
export const loadOwn = () => (own ||= retry(async () => { const r = await fetch('media/own.json'); if (!r.ok) throw new Error('media/own.json ' + r.status); return r.json() }))

// A sheet that opens over an app from the thing that was pressed (a file from its icon, a card from the board).
// Returns the function that closes it. Escape and a press outside close it too.
export function openOver(app, from, label, html) {
  app.querySelector(':scope > .ap-over')?.remove()
  const a = app.getBoundingClientRect(), f = from ? from.getBoundingClientRect() : a
  app.style.setProperty('--ah', a.height + 'px')              // a picture in the sheet is never taller than the app has room for
  const over = app.appendChild(el('div', 'ap-over',`<div class="ap-card" role="dialog" aria-label="${esc(label)}"><header><b>${esc(label)}</b><button type="button" class="ap-x" aria-label="Close">${ICON.close}</button></header><div class="ap-body">${html}</div></div>`))
  over.style.setProperty('--dx', (f.left + f.width / 2 - a.left - a.width / 2) + 'px'); over.style.setProperty('--dy', (f.top + f.height / 2 - a.top - a.height / 2) + 'px')      // from the middle of the app to the thing pressed
  const close = () => { if (over.classList.contains('closing')) return; over.classList.add('closing'); setTimeout(() => over.remove(), reduced() ? 0 : 180); if (from && from.isConnected) from.focus({ preventScroll: true }) }
  over.addEventListener('click', (e) => { if (e.target === over || e.target.closest('.ap-x')) close() })
  over.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); close() } })
  over.querySelector('.ap-x').focus({ preventScroll: true })
  return close
}

// text that types itself, on a loop: all of it, a hold, again. Stops for good once its element has left the page;
// waits while it is not on screen. With reduced motion the text is simply there.
export function typeOut(pre, text, cps = 110, hold = 4000) {
  if (reduced()) { pre.textContent = text; return }
  let n = 0, rest = 0
  const t = setInterval(() => {
    if (!pre.isConnected) return clearInterval(t)
    if (!pre.offsetParent) return
    if (rest > 0) { rest -= 50; if (rest <= 0) n = 0; return }
    n = Math.min(text.length, n + Math.ceil(cps / 20))
    pre.textContent = text.slice(0, n)
    pre.scrollTop = pre.scrollHeight
    if (n === text.length) rest = hold
  }, 50)
}

// A menu flyout under the button that was pressed (Windows 11: 8 px corners, a check beside the chosen row).
// items: [label, value, chosen]. Escape, a press outside or a choice closes it.
export function menu(app, from, items, choose) {
  app.querySelector(':scope > .ap-menu')?.remove()
  const m = app.appendChild(el('div', 'ap-menu', items.map(([label, v, on]) => `<button type="button" role="menuitemradio" aria-checked="${!!on}" data-v="${esc(v)}">${line('tick', 16)}<span>${esc(label)}</span></button>`).join('')))
  m.setAttribute('role', 'menu')
  const a = app.getBoundingClientRect(), f = from.getBoundingClientRect()
  const top = f.bottom - a.top + 4 + m.offsetHeight > a.height - 8 ? f.top - a.top - m.offsetHeight - 4 : f.bottom - a.top + 4
  m.style.left = Math.max(8, Math.min(f.left - a.left, a.width - m.offsetWidth - 8)) + 'px'; m.style.top = Math.max(8, top) + 'px'
  const close = () => { m.remove(); removeEventListener('pointerdown', away, true) }
  const away = (e) => { if (!m.contains(e.target)) close() }
  addEventListener('pointerdown', away, true)
  m.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { close(); choose(b.dataset.v) } })
  m.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); from.focus({ preventScroll: true }) } })
  m.querySelector('[aria-checked="true"], button').focus({ preventScroll: true })
}
