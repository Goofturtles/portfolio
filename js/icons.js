// The site's icons. Two families, as on a real Windows 11 desktop:
//   the PLACES are app icons (media/icons/app/<id>.svg, written by tools/sync_icons.cjs from icons.json): each its own hue and
//   its own silhouette (tile, circle, folder, bubble, the service's own shape), flat and refined like the Office and Windows app
//   icons, a white or gold symbol from Microsoft's Fluent System Icons (MIT) filled style. Our own A mark is Home; the four
//   outside services keep their own marks in their own colours. Reference: the taskbar in film/ref/exact/user-16 and Arjun's own.
//   the SYSTEM controls (the tray, the search box, the room button, menus, toolbars) stay thin Fluent line icons in the text
//   colour, as in Windows; the filled drawing of the same icon shows when a tray control is on.
//   ico(id, z)      THE SHELL'S ICON (taskbar, tray, tooltips, title bars, menus, the phone's bottom bar): the app icon for a
//                   place, the Fluent line icon (and its filled twin) for a system control
//   pix(id, box)    what the shell and the room call: ico() for every shell id, the colour picture for anything else
//   line(key, z)    a small control: the Fluent line icon, drawn in the text colour ('...On' keys are the filled ones)
//   CAPTION         the three window buttons, drawn to the Windows glyphs (10 px, 1 px lines)
// Colour pictures (the gradient Fluent icons) are left only INSIDE app windows, for what is not one of our places (a project's
// own picture, a file in the explorer): install() hands them to film/ui as PIX(); an id that is one of our places gets its app icon.
// THE SITE OWNS THIS PART. film/ui (copied to apps/, never edited) draws its places with Fluent Emoji pictures and its
// own small glyphs, because that is what the film's shots show. On the site every icon is something a visitor clicks,
// so install() replaces film/ui's PIX(), EMO() and the entries of ICON after kit.js has loaded: every view of film/ui
// and every app in js/apps/ then draws from this one family without knowing. Emoji are left only where the film
// itself shows an emoji (the page's own emoji beside "Portfolio"), and there it is the Fluent Emoji 3D picture,
// never the device's own glyph.
import { APP, COLOUR, LINE, SHELL } from './icons.gen.js'

export const MARK = `<svg viewBox="0 0 48 48" aria-hidden="true"><defs><linearGradient id="arjun-mark-g" x1="8" y1="4" x2="40" y2="44" gradientUnits="userSpaceOnUse"><stop stop-color="#9a76ff"/><stop offset="1" stop-color="#5a3bd0"/></linearGradient></defs><rect x="4" y="4" width="40" height="40" rx="10" fill="url(#arjun-mark-g)"/><path fill="#fff" fill-rule="evenodd" d="M24 12.500c1.200 0 2.200.700 2.700 1.800l8.100 18.600a2.200 2.200 0 1 1-4 1.800L29.300 31H18.700l-1.500 3.700a2.200 2.200 0 1 1-4-1.800l8.100-18.600c.5-1.100 1.500-1.800 2.700-1.800Zm0 6.900L20.500 27h7L24 19.400Z"/></svg>`
const MARK_URI = 'data:image/svg+xml,' + encodeURIComponent(MARK.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" '))      // as a picture: its gradient then never depends on another copy in the page
export const CAPTION = {
  min: '<svg viewBox="0 0 10 10" aria-hidden="true"><path d="M0 5.500h10" fill="none" stroke="currentColor"/></svg>',
  max: '<svg viewBox="0 0 10 10" aria-hidden="true"><rect x=".5" y=".5" width="9" height="9" rx="1.500" fill="none" stroke="currentColor"/></svg>',
  restore: '<svg viewBox="0 0 10 10" aria-hidden="true"><rect x=".5" y="2.500" width="7" height="7" rx="1.500" fill="none" stroke="currentColor"/><path d="M2.500 2.500V2A1.500 1.500 0 0 1 4 .5h4A1.500 1.500 0 0 1 9.500 2v4A1.500 1.500 0 0 1 8 7.500h-.5" fill="none" stroke="currentColor"/></svg>',
  close: '<svg viewBox="0 0 10 10" aria-hidden="true"><path d="M0 0l10 10M10 0L0 10" fill="none" stroke="currentColor"/></svg>',
}
// the four outside services as a plain tile (css/shell.css .fbrand), for window.BRAND: their own mark (Simple Icons, CC0, in
// DATA.brand) in white on their own colour. Simple Icons carries no LinkedIn mark, so that one keeps its two letters.
const BRAND = { github: 'GH', linkedin: 'in', medium: 'M', youtube: 'YT' }
// Medium's own mark is its three ellipses (Simple Icons, CC0). The copy in DATA.brand is a full tile with the letters
// cut out of it, which reads as a white square once it is drawn in white on the tile: the plain mark is used instead.
const MARKS = { medium: 'M13.54 12a6.8 6.8 0 01-6.77 6.82A6.8 6.8 0 010 12a6.8 6.8 0 016.77-6.82A6.8 6.8 0 0113.54 12zM20.96 12c0 3.54-1.51 6.42-3.38 6.42-1.87 0-3.39-2.88-3.39-6.42s1.52-6.42 3.39-6.42 3.38 2.88 3.38 6.42M24 12c0 3.17-.53 5.75-1.19 5.75-.66 0-1.19-2.58-1.19-5.75s.53-5.75 1.19-5.75C23.47 6.25 24 8.83 24 12z' }
function brand(id) {
  const d = MARKS[id] || (window.DATA && window.DATA.brand && window.DATA.brand[id])
  return `<span class="fbrand b-${id}">${d ? `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>` : `<b>${BRAND[id]}</b>`}</span>`
}
const has = (id) => id === 'app' || id === 'portfolio' || !!BRAND[id] || !!COLOUR[id]
// our app icon for a place: 'portfolio' is the portfolio's own place, Home
const A = (id) => APP[id === 'portfolio' ? 'app' : id]
const appImg = (id) => `<img class="fic" src="${A(id)}" alt="" draggable="false">`
// the picture alone, filling whatever box it is put in: for app windows only
export function glyph(id) {
  if (id === 'app' || id === 'portfolio') return `<img class="fic" src="${MARK_URI}" alt="" draggable="false">`      // the film's own document keeps its violet mark
  if (A(id)) return appImg(id)
  if (BRAND[id]) return brand(id)
  return `<img class="fic" src="${COLOUR[id] || COLOUR.doc}" alt="" draggable="false">`
}
// same call as film/ui's PIX(id, box, size): a box of `box` px with the colour picture centred in it (install() hands this to film/ui)
const colourPix = (id, box) => (A(id) && id !== 'app' && id !== 'portfolio' ? ico(id, box) : `<span class="pix" data-pic="${id}" style="--z:${box}px" aria-hidden="true">${glyph(id)}</span>`)

// ---- the shell's icons: an app icon for a place, a single-colour line icon (css/shell.css draws it in the text colour, its filled twin in the accent) for a system control ----
const drawing = (cls, box, inner) => `<svg class="${cls}" viewBox="${box}" aria-hidden="true">${inner}</svg>`
export const isShell = (id) => !!A(id) || !!SHELL[id]
export function ico(id, z = 24) {
  if (A(id)) return `<span class="pix ico appic" data-pic="${id}" style="--z:${z}px" aria-hidden="true">${appImg(id)}</span>`
  const s = z <= 16 ? 16 : z <= 20 ? 20 : 24, g = SHELL[id] || SHELL.doc
  const body = drawing('r', `0 0 ${s} ${s}`, g['r' + s]) + (g['f' + s] ? drawing('f', `0 0 ${s} ${s}`, g['f' + s]) : '')
  return `<span class="pix ico" data-pic="${id}" style="--z:${z}px" aria-hidden="true">${body}</span>`
}
// what the shell and the room call: the shell's icon for every shell id, the colour picture for anything else
export const pix = (id, box) => (isShell(id) ? ico(id, box) : colourPix(id, box))
export const line = (key, z = 20) => `<span class="ic" style="--z:${z}px" aria-hidden="true">${LINE[key]}</span>`
export { LINE }

export function install() {
  if (install.done) return
  install.done = true
  /* global PIC, ICON */
  const byName = {}                                         // film/ui names a project's picture by its emoji: back to the project
  for (const id in PIC) if (id !== 'portfolio' && has(id)) byName[PIC[id][1]] = id
  const emoji = window.DATA.emoji || {}
  window.PIX = colourPix                                    // inside an app window the real thing has colour; the shell's own icons are ico()
  window.EMO = (ch, name, size) => {
    const st = size ? ` style="--z:${size}px"` : ''
    if (byName[name]) return `<span class="emo fi"${st}>${glyph(byName[name])}</span>`
    return emoji[name] ? `<img class="emo" src="${emoji[name]}" alt=""${st}>` : `<span class="emo"${st}></span>`      // no picture: nothing, never the device's glyph
  }
  window.BRAND = (id, size) => `<span class="pix" style="--z:${size}px" aria-hidden="true">${brand(id)}</span>`
  for (const k of Object.keys(ICON)) if (LINE[k]) ICON[k] = LINE[k]
  Object.assign(ICON, { min: CAPTION.min, max: CAPTION.max, close: LINE.close })
}
