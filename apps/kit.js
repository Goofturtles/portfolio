'use strict'
// Portfolio cinema UI kit (same pattern as fairplate-launch/scene/kit.js): each view is a pure function of time.
// window.__seek(t) draws the frame for time t in seconds. No clocks, no state between frames.
const QS = new URLSearchParams(location.search)
const VIEW = QS.get('view') || 'window'
const BG = QS.get('bg') !== '0'
const FPS = 24
const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x), mix = (a, b, k) => a + (b - a) * k
const E = {
  lin: (x) => x, o2: (x) => 1 - (1 - x) * (1 - x), o3: (x) => 1 - Math.pow(1 - x, 3), o5: (x) => 1 - Math.pow(1 - x, 5),
  io: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
  back: (x) => { const c = 1.70158; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2) },
}
const P = (t, a, b, e) => (e || E.o3)(clamp((t - a) / (b - a)))
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')
function h(tag, cls, parent, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; if (parent) parent.appendChild(e); return e }
// absolutely placed box
function A(p, cls, html, x, y, w, hh) { const e = h('div', 'abs ' + (cls || ''), p, html); e.style.left = (x || 0) + 'px'; e.style.top = (y || 0) + 'px'; if (w != null) e.style.width = w + 'px'; if (hh != null) e.style.height = hh + 'px'; return e }

// Measured tracks: keys = [[frame, v1, v2, ...], ...] in reference frame numbers. Catmull-Rom through the keys,
// so a value read off the film every frame is reproduced exactly and sparse keys are joined smoothly.
function track(f, keys) {
  const n = keys.length
  if (f <= keys[0][0]) return keys[0].slice(1)
  if (f >= keys[n - 1][0]) return keys[n - 1].slice(1)
  let i = 1
  while (keys[i][0] < f) i++
  const k0 = keys[Math.max(0, i - 2)], k1 = keys[i - 1], k2 = keys[i], k3 = keys[Math.min(n - 1, i + 1)]
  const u = (f - k1[0]) / (k2[0] - k1[0]), out = []
  for (let c = 1; c < k1.length; c++) {
    const m1 = (k2[c] - k0[c]) / (k2[0] - k0[0] || 1) * (k2[0] - k1[0]), m2 = (k3[c] - k1[c]) / (k3[0] - k1[0] || 1) * (k2[0] - k1[0])
    const u2 = u * u, u3 = u2 * u
    out.push((2 * u3 - 3 * u2 + 1) * k1[c] + (u3 - 2 * u2 + u) * m1 + (-2 * u3 + 3 * u2) * k2[c] + (u3 - u2) * m2)
  }
  return out
}
// piecewise-linear lookup for per-frame tables: keys = [[frame, value], ...]
function lerpKeys(f, keys) {
  if (f <= keys[0][0]) return keys[0][1]
  for (let i = 1; i < keys.length; i++) if (f <= keys[i][0]) return mix(keys[i - 1][1], keys[i][1], (f - keys[i - 1][0]) / (keys[i][0] - keys[i - 1][0]))
  return keys[keys.length - 1][1]
}

// ---- stand-ins (film/SPEC.md: no brand marks, no photos of people) ---------------------------------
// Emoji: Fluent Emoji 3D PNG if the assets scout has fetched it (gen/data.js lists them), otherwise the system
// colour glyph (on Windows 11 that is Fluent's flat set).
function EMO(ch, name, size) {
  const src = window.DATA && window.DATA.emoji && window.DATA.emoji[name]
  const st = size ? ` style="--z:${size}px"` : ''
  return src ? `<img class="emo" src="${src}" alt=""${st}>` : `<span class="emo"${st}>${ch}</span>`
}
// Avatar: a circle with an initial. ring = CSS colour of the presence ring (optional).
function AV(initial, fill, size, ring) {
  return `<span class="av${ring ? ' ring' : ''}" style="--z:${size}px;--f:${fill}${ring ? ';--r:' + ring : ''}"><i>${initial}</i></span>`
}
// A plain rounded tile. Only for something nobody can click (film/SPEC.md "Icons must mean something"): every
// clickable icon is a PIX() below.
const TILE = (colour, size, cls) => `<span class="tile ${cls || ''}" style="--z:${size || 16}px;--f:${colour}"></span>`

// ---- pictures: one per place, the same picture wherever that place appears ----------------------------
// [emoji, Fluent Emoji 3D name, tone]. EMO() draws film/assets/fluent-emoji-3d/<name>_3d.png once it has been fetched
// (film/assets/tools/add_ui_icons.py lists them) and the same emoji from Windows' own font until then.
// tone: 'pale' = a near-white picture, 'dim' = a dark one; each gets a firmer hairline on the ground it would sink into.
const PIC = {
  // places. The taskbar's order is in view_app.js
  home: ['🏠', 'house'], ai: ['🔍', 'magnifying_glass_tilted_left'], projects: ['📁', 'file_folder'], films: ['🎬', 'clapper_board'],
  how: ['📋', 'clipboard'], results: ['🏆', 'trophy'], about: ['👤', 'bust_in_silhouette', 'dim'], contact: ['✉️', 'envelope', 'pale'],
  themes: ['🎨', 'artist_palette'], sound: ['🔊', 'speaker_high_volume', 'pale'],
  portfolio: ['🥰', 'smiling_face_with_hearts'], design: ['📐', 'triangular_ruler'], build: ['🧪', 'test_tube'], writing: ['📚', 'books'], chat: ['💬', 'speech_balloon', 'pale'],
  // projects, by their id in projects.js: what each one is about
  'second-look': ['🏷️', 'label'], ghostbus: ['🚌', 'bus'], 'shade-route': ['🌳', 'deciduous_tree'], owed: ['🛠️', 'hammer_and_wrench'],
  'before-i-tell': ['💭', 'thought_balloon', 'pale'], 'second-reader': ['📝', 'memo'], folio: ['📈', 'chart_increasing'], aeris: ['🌊', 'water_wave'],
  mem: ['🧠', 'brain'], 'battery-framework': ['🔋', 'battery'], explainers: ['💡', 'light_bulb'],
  // added from film/ui/data_additions.json (so this view never meets an id it has no picture for)
  fairplate: ['🍽️', 'fork_and_knife_with_plate'], 'second-opinion': ['🤝', 'handshake'], 'embedding-tax': ['🧮', 'abacus'],
  // results, by their id in TrackRecordRow.jsx
  peddiehacks: ['🥇', '1st_place_medal'], oregonhacks: ['🥈', '2nd_place_medal'], rlchacks: ['🎥', 'movie_camera'], tks: ['🏅', 'sports_medal'],
  samsung: ['🌟', 'glowing_star'], rise: ['🎓', 'graduation_cap'], h4h: ['🏆', 'trophy'],
}
// The four outside services: their own mark from Simple Icons (CC0) when gen/data.js carries it (DATA.brand, read from
// film/assets/simple-icons/<id>.svg), otherwise a plain lettered tile. Simple Icons has no LinkedIn mark, so that one
// is always lettered.
const BRANDS = { github: 'GH', linkedin: 'in', medium: 'M', youtube: 'YT' }
function BRAND(id, size) {
  const d = window.DATA && window.DATA.brand && window.DATA.brand[id]
  return d ? `<span class="tile brand b-${id}" style="--z:${size}px"><svg viewBox="0 0 24 24"><path d="${d}"/></svg></span>`
    : `<span class="tile letter b-${id}" style="--z:${size}px"><b>${BRANDS[id]}</b></span>`
}
// PIX(id, box, size): the picture for a place, centred in a box the size of the tile it replaces, so nothing beside it
// moves. size = the emoji's own size when it should read a little larger than the box. 'app' is this app: his initial.
function PIX(id, box, size) {
  const pic = id === 'app' ? `<span class="tile letter b-app" style="--z:${box}px"><b>${esc(window.DATA.profile.name[0])}</b></span>`
    : BRANDS[id] ? BRAND(id, box) : EMO(PIC[id][0], PIC[id][1], size || box)
  return `<span class="pix ${(PIC[id] && PIC[id][2]) || ''}" data-pic="${id}" style="--z:${box}px" aria-hidden="true">${pic}</span>`
}
// A control's name, three ways: aria-label for a screen reader, title for the browser's own tooltip, and TIP(), the
// drawn hover label (.tip in ui.css). place: '' below, 't' above, 'br' below and right-aligned, 'r' to the right.
// The label is a <small>, not a <span>: the stylesheets have "x span" rules (.a-seg span) that would lay a span out.
const NAME = (label) => ` aria-label="${esc(label)}" title="${esc(label)}"`
const TIP = (label, place) => `<small class="tip ${place || ''}" aria-hidden="true">${esc(label)}</small>`
// Small line icons, drawn here (no icon font, no brand glyphs)
const ICON = {
  chev: '<svg viewBox="0 0 16 16"><path d="M3 5.5l5 5 5-5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  chevR: '<svg viewBox="0 0 16 16"><path d="M5.5 3l5 5-5 5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  min: '<svg viewBox="0 0 12 12"><path d="M1 6h10" stroke="currentColor" stroke-width="1"/></svg>',
  max: '<svg viewBox="0 0 12 12"><rect x="1.5" y="1.5" width="9" height="9" rx="1" fill="none" stroke="currentColor" stroke-width="1"/></svg>',
  close: '<svg viewBox="0 0 12 12"><path d="M1 1l10 10M11 1L1 11" stroke="currentColor" stroke-width="1"/></svg>',
  comment: '<svg viewBox="0 0 24 24"><path d="M12 3.5a8.5 8.5 0 0 0-7.4 12.7L3.5 20.5l4.5-1A8.5 8.5 0 1 0 12 3.5z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M8.5 10.5h7M8.5 13.8h4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
  react: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7.2" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="8.6" cy="9.4" r="1" fill="currentColor"/><circle cx="13.4" cy="9.4" r="1" fill="currentColor"/><path d="M8 13c1.6 2 4.4 2 6 0" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><circle cx="18" cy="18" r="4.4" fill="var(--react-bg,#fff)" stroke="currentColor" stroke-width="1.4"/><path d="M18 15.8v4.4M15.8 18h4.4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
  image: '<svg viewBox="0 0 20 20"><rect x="2.5" y="3" width="15" height="14" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.3"/><circle cx="7" cy="7.6" r="1.4" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M3.5 15l4.2-4 3 2.6 2.6-2.2 3.4 3" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>',
  plus: '<svg viewBox="0 0 16 16"><path d="M8 2.5v11M2.5 8h11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
  check: '<svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="7.5" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M6.6 10.2l2.3 2.3 4.4-4.6" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  circle: '<svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="7.5" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>',
  person: '<svg viewBox="0 0 20 20"><circle cx="10" cy="7" r="3.2" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M3.8 16.5c.8-3 3.3-4.5 6.2-4.5s5.4 1.5 6.2 4.5" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>',
  cal: '<svg viewBox="0 0 20 20"><rect x="3" y="4" width="14" height="13" rx="2" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M3 8h14M7 2.5v3M13 2.5v3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>',
  status: '<svg viewBox="0 0 20 20"><path d="M3 9.5h14v3a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4z" fill="currentColor"/><path d="M4 7.5c0-2 2.6-3.5 6-3.5s6 1.500 6 3.500" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>',
  search: '<svg viewBox="0 0 20 20"><circle cx="8.6" cy="8.6" r="5.4" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12.8 12.800L17 17" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  back: '<svg viewBox="0 0 20 20"><path d="M11.500 4.500L6 10l5.500 5.500M6.300 10H16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  fwd: '<svg viewBox="0 0 20 20"><path d="M8.500 4.500L14 10l-5.500 5.500M13.700 10H4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  reload: '<svg viewBox="0 0 20 20"><path d="M15.500 10a5.500 5.500 0 1 1-1.700-4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M14.300 2.800v3.600h-3.600" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  spark: '<svg viewBox="0 0 20 20"><path d="M10 2c.6 4.200 2 5.600 6.500 6.500C12 9.400 10.600 10.800 10 15c-.6-4.200-2-5.600-6.500-6.500C8 7.600 9.400 6.200 10 2z" fill="currentColor"/><path d="M15.500 13c.3 1.900.9 2.500 2.800 2.800-1.900.3-2.500.9-2.800 2.800-.3-1.900-.9-2.500-2.800-2.800 1.900-.3 2.500-.9 2.800-2.800z" fill="currentColor"/></svg>',
  globe: '<svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="7.300" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M2.700 10h14.600M10 2.700c2.400 2.200 2.400 12.400 0 14.600M10 2.700c-2.400 2.200-2.400 12.400 0 14.600" fill="none" stroke="currentColor" stroke-width="1.300"/></svg>',
  code: '<svg viewBox="0 0 20 20"><path d="M7 5.500L2.500 10 7 14.500M13 5.500l4.500 4.500-4.500 4.500" fill="none" stroke="currentColor" stroke-width="1.600" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  play: '<svg viewBox="0 0 20 20"><rect x="2.500" y="4" width="15" height="12" rx="3" fill="none" stroke="currentColor" stroke-width="1.400"/><path d="M8.300 7.400v5.200l4.600-2.600z" fill="currentColor"/></svg>',
  store: '<svg viewBox="0 0 20 20"><path d="M4 7h12l-1 9.500H5z" fill="none" stroke="currentColor" stroke-width="1.400" stroke-linejoin="round"/><path d="M7.300 7V5.700a2.700 2.700 0 0 1 5.400 0V7" fill="none" stroke="currentColor" stroke-width="1.400"/></svg>',
  mail: '<svg viewBox="0 0 20 20"><rect x="2.500" y="4.500" width="15" height="11" rx="2" fill="none" stroke="currentColor" stroke-width="1.400"/><path d="M3 6l7 5.200L17 6" fill="none" stroke="currentColor" stroke-width="1.400" stroke-linejoin="round"/></svg>',
  article: '<svg viewBox="0 0 20 20"><rect x="4" y="2.500" width="12" height="15" rx="2" fill="none" stroke="currentColor" stroke-width="1.400"/><path d="M7 7h6M7 10h6M7 13h3.500" stroke="currentColor" stroke-width="1.400" stroke-linecap="round"/></svg>',
  profile: '<svg viewBox="0 0 20 20"><circle cx="10" cy="7" r="3.200" fill="none" stroke="currentColor" stroke-width="1.400"/><path d="M3.800 16.500c.8-3 3.300-4.500 6.200-4.500s5.400 1.500 6.200 4.500" fill="none" stroke="currentColor" stroke-width="1.400" stroke-linecap="round"/></svg>',
  info: '<svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="7.300" fill="none" stroke="currentColor" stroke-width="1.400"/><path d="M10 9v5" stroke="currentColor" stroke-width="1.600" stroke-linecap="round"/><circle cx="10" cy="6.300" r="1" fill="currentColor"/></svg>',
  pages: '<svg viewBox="0 0 20 20"><path d="M5.500 2.500h6l3.500 3.500v11.500h-9.500z" fill="currentColor"/></svg>',
  pulse: '<svg viewBox="0 0 20 20"><path d="M2.500 10.500h3.500l2-5 3.500 9.500 2-4.500h4" fill="none" stroke="currentColor" stroke-width="1.500" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  wifi: '<svg viewBox="0 0 20 20"><path d="M3 8.500c4-3.700 10-3.700 14 0M5.800 11.300c2.400-2.300 6-2.300 8.400 0" fill="none" stroke="currentColor" stroke-width="1.500" stroke-linecap="round"/><circle cx="10" cy="14.300" r="1.300" fill="currentColor"/></svg>',
  sound: '<svg viewBox="0 0 20 20"><path d="M3 8v4h3l4 3.500v-11L6 8z" fill="currentColor"/><path d="M13 7.500c1.300 1.400 1.300 3.600 0 5M15.300 5.500c2.400 2.500 2.400 6.500 0 9" fill="none" stroke="currentColor" stroke-width="1.400" stroke-linecap="round"/></svg>',
  batt: '<svg viewBox="0 0 24 20"><rect x="2" y="6" width="17" height="8" rx="2" fill="none" stroke="currentColor" stroke-width="1.400"/><rect x="4" y="8" width="10" height="4" rx="1" fill="currentColor"/><path d="M21 8.500v3" stroke="currentColor" stroke-width="1.600" stroke-linecap="round"/></svg>',
}
// I(name, size, cls): a line icon beside its own words. With a label it is an icon-only control: it carries its name
// (NAME) and, unless place is false, the drawn hover label.
const I = (name, size, cls, label, place) => `<span class="ic ${cls || ''}" style="--z:${size || 16}px"${label ? ' role="img"' + NAME(label) : ''}>${ICON[name]}${label && place !== false ? TIP(label, place) : ''}</span>`

// ---- views ------------------------------------------------------------------------------------------
// view(name, { w, h, dur, build(stage) -> draw(t) })
const VIEWS = {}
function view(name, def) { VIEWS[name] = def }

window.addEventListener('DOMContentLoaded', async () => {
  const def = VIEWS[VIEW] || VIEWS.window
  const st = document.getElementById('stage')
  document.documentElement.classList.toggle('nobg', !BG)
  if (QS.get('font') === 'classic') document.documentElement.classList.add('classic')
  const size = typeof def.size === 'function' ? def.size() : [def.w, def.h]
  st.style.width = size[0] + 'px'; st.style.height = size[1] + 'px'
  document.body.dataset.view = VIEW
  await Promise.all(['400', '600', '700'].map((w) => document.fonts.load(w + ' 20px "Segoe UI Variable Text"', 'Ag').catch(() => {})))
  const draw = def.build(st)
  await Promise.all([...document.images].map((i) => (i.complete ? i.decode().catch(() => {}) : new Promise((r) => { i.onload = i.onerror = r }))))
  await document.fonts.ready
  window.__seek = (t) => draw(t)
  window.__frame = (f) => draw(((def.f0 || 0) === 0 ? f : f - def.f0) / FPS)     // reference frame number -> time
  window.__dur = def.dur || 0
  window.__size = [st.offsetWidth, st.offsetHeight]     // a view may have resized the stage to its content
  let t0 = QS.get('f') != null && def.f0 != null ? (parseFloat(QS.get('f')) - def.f0) / FPS : QS.get('t') != null ? parseFloat(QS.get('t')) : def.rest != null ? def.rest : 0
  draw(t0)
  window.__ready = true
  if (QS.get('play')) { const s = performance.now(); (function loop() { draw((t0 + (performance.now() - s) / 1000) % (def.dur || 10)); requestAnimationFrame(loop) })() }
})
