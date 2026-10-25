// How I work: a design editor's canvas, in Figma's pattern (film/SPEC.md "How I work is Figma's editor, not a task
// board"). References, with measurements in film/ref/ui/board/INDEX.md "figma": board/figma/02-figma-layers-and-
// properties.jpg (left panel with the layers tree, right panel with property groups, the blue selection),
// 03-figma-frames-row-draw-toolbar.jpg (a row of named frames on the grey canvas, the floating toolbar),
// 04-figma-sites-frames-and-styles.jpg (the Pages list, names in a tab above their frames).
// Not in any picture (INDEX flags it): the name cursors. They follow the film's own app window, which shows them.
// Anatomy: left panel (file name, Pages, Layers: the five steps and what is in each); the canvas on Figma's own grey
// with his five steps as five named sections left to right, joined by connectors, and inside each his REAL pieces as
// frames with their names above them (js/apps/how.js, media/own.json); the floating toolbar; the right panel with the
// selected item's details. It works like the real thing: drag to pan, wheel or pinch to zoom, click a frame to select
// it, double-click to zoom to it, and "Open full size" shows it whole. It opens fitted to all five sections, then
// eases to the first. On a phone the canvas fills the screen and the panel is a sheet along the bottom.
// Never Figma's name or logo. "Fanned pages" (the film's P3 sheets) is the other way to see the same five steps.
import { el, reduced } from '../config.js'
import { line } from '../icons.js'
import { esc, loadOwn, openOver } from './common.js'
import { steps, sceneHTML, liven } from './how.js'

const GAP = 120, TOP = 44, PAD = 24, H = 392                  // between sections; a frame's name sits in TOP; frames are H tall at most
// what is in each step: [key, x, w, h] in the section's own pixels. A key that is a picture in media/own.json is that
// picture; 'rise', 'code' and 'deck' are the live scenes of js/apps/how.js (the acceptance, the Python, the presenter view)
const LAYOUT = [[['rise', 0, 392, 392]], [['sketch-shade', 0, 235, 392], ['sketch-folio', 259, 288, 180], ['sketch-ghostbus', 259, 288, 180, 212]], [['code', 0, 392, 392]],
  [['phone-dark', 0, 190, 392], ['phone2-dark', 214, 190, 392]], [['deck', 0, 392, 392]]]
const SCENE = { rise: 0, code: 2, deck: 4 }

export function mount(box, ctx) {
  const S = steps(), D = window.DATA, rise = D.record.find((r) => r.id === 'rise')
  const root = box.appendChild(el('div', 'bd'))
  const tool = (attr, icon, name, on) => `<button type="button" ${attr} aria-label="${name}" title="${name}"${on == null ? '' : ` aria-pressed="${on}"`}>${line(icon, 20)}</button>`
  root.innerHTML = `<aside class="bd-left"><div class="bd-file"><b>How I work</b><i>${esc(D.profile.name)} · ${S.length} steps</i></div>` +
    `<h4>Pages</h4><div class="bd-pgs"><button type="button" data-do="fit" aria-current="page">${line('frame', 20)}<span>Canvas</span></button><button type="button" class="bd-pages" data-do="pages">${line('pages', 20)}<span>Fanned pages</span></button></div>` +
    `<h4>Layers</h4><div class="bd-layers"></div></aside>` +
    `<div class="bd-canvas" tabindex="0" aria-label="The canvas: ${S.map((s) => s.name).join(', ')}"><div class="bd-world"></div><span class="bd-you" aria-hidden="true" hidden>You</span>` +
    `<div class="bd-tools" role="toolbar" aria-label="Tools">${tool('data-tool="move"', 'cursor', 'Move: click to select', true)}${tool('data-tool="hand"', 'hand', 'Hand: drag to pan', false)}<i></i>` +
    `${tool('data-do="out"', 'zoomOut', 'Zoom out')}<button type="button" class="bd-pct" data-do="fit" title="Zoom to fit">100%</button>${tool('data-do="in"', 'zoomIn', 'Zoom in')}</div></div>` +
    `<aside class="bd-right"><div class="bd-steps" role="group" aria-label="Steps">${S.map((s, i) => `<button type="button" class="bd-step" data-col="${i}">${esc(s.name)}</button>`).join('')}</div>` +
    `<div class="bd-rtop"><b>Design</b><button type="button" data-do="pages" aria-label="Present: see it as pages" title="Present: see it as pages">${line('present', 20)}</button><button type="button" class="bd-share" data-do="share">Share</button></div>` +
    `<div class="bd-props" aria-live="polite"></div></aside>`
  const $ = (s) => root.querySelector(s), canvas = $('.bd-canvas'), world = $('.bd-world'), props = $('.bd-props'), pct = $('.bd-pct'), you = $('.bd-you')
  const view = { x: 0, y: 0, k: 1 }, secs = []                 // secs[i] = { x, w, frames: [{ key, name, x, y, w, h }] } in the world's pixels
  let own = null, sel = null, hand = false, started = false, total = 0, drift = null

  function apply(ease) {
    world.classList.toggle('ease', !!ease && !reduced())
    world.style.transform = `translate(${view.x.toFixed(1)}px, ${view.y.toFixed(1)}px) scale(${view.k.toFixed(4)})`
    world.style.setProperty('--ik', (1 / view.k).toFixed(4))
    pct.textContent = Math.round(view.k * 100) + '%'
  }
  // bring a rectangle of the world into the middle of what can be seen of the canvas
  function fit(r, ease = true) {
    const cw = canvas.clientWidth, sheet = canvas.clientWidth === root.clientWidth ? $('.bd-right').offsetHeight : 0, ch = canvas.clientHeight - 64 - sheet, pad = Math.min(56, cw * 0.07)
    if (cw < 10 || ch < 10) return
    view.k = Math.max(0.05, Math.min(2, (cw - 2 * pad) / r.w, (ch - 2 * pad) / r.h))
    view.x = (cw - r.w * view.k) / 2 - r.x * view.k; view.y = (ch - r.h * view.k) / 2 - r.y * view.k + 6
    apply(ease)
  }
  function zoom(f, cx = canvas.clientWidth / 2, cy = canvas.clientHeight / 2, ease) {
    const k = Math.max(0.05, Math.min(4, view.k * f))
    view.x = cx - (cx - view.x) * k / view.k; view.y = cy - (cy - view.y) * k / view.k; view.k = k
    apply(ease)
  }
  const all = () => ({ x: 0, y: -30, w: total, h: TOP + H + PAD + 30 })
  const rectOf = (s) => (s.type === 'sec' ? { x: secs[s.i].x, y: -30, w: secs[s.i].w, h: TOP + H + PAD + 30 } : (() => { const f = secs[s.i].frames.find((x) => x.key === s.key); return { x: secs[s.i].x + PAD + f.x, y: TOP + f.y - 22, w: f.w, h: f.h + 22 } })())

  function select(s, go) {
    sel = s
    for (const c of root.querySelectorAll('.bd-col')) c.classList.toggle('on', +c.dataset.col === s.i)
    for (const c of root.querySelectorAll('.bd-card')) c.classList.toggle('sel', s.type === 'frame' && c.dataset.card === s.key)
    for (const b of root.querySelectorAll('.bd-layer, .bd-step')) b.toggleAttribute('aria-current', b.dataset.card ? s.type === 'frame' && b.dataset.card === s.key : +b.dataset.col === s.i && (s.type === 'sec' || b.classList.contains('bd-step')))
    const st = S[s.i], f = s.type === 'frame' && secs[s.i].frames.find((x) => x.key === s.key), p = f && own.pictures[f.key]
    const group = (name, rows) => `<section><h5>${name}</h5>${rows.join('')}</section>`, kv = (k, v) => `<p><i>${k}</i><span>${esc(v)}</span></p>`
    props.innerHTML = (f ? group('Frame', [`<p class="bd-name">${esc(f.name)}</p>`, `<p class="bd-wh"><label><i>W</i><output>${p ? p.w : f.w}</output></label><label><i>H</i><output>${p ? p.h : f.h}</output></label></p>`]) : '') +
      group('Step', [kv('Step', `${s.i + 1} of ${S.length}`), kv('Name', st.name), kv('What', st.line)]) +
      (p ? group('From', [kv('Project', p.project), kv('Shows', p.caption)]) : f && f.key === 'rise' ? group('From', [kv('Result', rise.title), kv('Outcome', rise.summary)]) : f && f.key === 'code' ? group('From', [kv('Project', 'Shade Route'), kv('File', own.code.file)]) : '') +
      (f ? `<button type="button" class="wbtn bd-open" data-do="open">${line('full', 16)}Open full size</button>` : `<p class="bd-hint">${secs[s.i].frames.length} ${secs[s.i].frames.length === 1 ? 'frame' : 'frames'}. Click one to select it, double-click to zoom to it.</p>`)
    if (go) fit(rectOf(s))
  }
  function open() {
    if (!sel || sel.type !== 'frame') return
    const f = secs[sel.i].frames.find((x) => x.key === sel.key), p = own.pictures[f.key]
    const html = p ? `<figure class="bd-full"><img src="${p.src}" width="${p.w}" height="${p.h}" alt="${esc(p.caption)}"><figcaption>${esc(p.caption)}</figcaption></figure>` : `<div class="bd-scene">${sceneHTML(SCENE[f.key], own)}</div>`
    openOver(root, $('.bd-open'), `${sel.i + 1}. ${S[sel.i].name}: ${S[sel.i].line}`, html)
    liven(root, own)
  }

  loadOwn().then((o) => {
    own = o
    const name = { rise: rise.title + ': ' + rise.summary, code: o.code.about, deck: 'Presenter view' }
    let x = 0
    world.innerHTML = LAYOUT.map((list, i) => {
      const frames = list.map(([key, fx, w, h, y = 0]) => ({ key, name: name[key] || o.pictures[key].caption, x: fx, y, w, h })), w = Math.max(...frames.map((f) => f.x + f.w)) + 2 * PAD
      secs.push({ x, w, frames })
      const html = `<section class="bd-col" data-col="${i}" style="left:${x}px;width:${w}px;height:${TOP + H + PAD}px;--c:var(--s${i + 1})"><header><b>${esc(S[i].name)}</b><i>${esc(S[i].line)}</i></header>` +
        frames.map((f) => `<div class="bd-card" role="button" tabindex="0" data-card="${f.key}" aria-label="${esc(f.name)}" style="left:${PAD + f.x}px;top:${TOP + f.y}px;width:${f.w}px;height:${f.h}px"><em>${esc(f.name)}</em>` +
          (o.pictures[f.key] ? `<img src="${o.pictures[f.key].src}" alt="" draggable="false" decoding="async">` : sceneHTML(SCENE[f.key], o)) + `</div>`).join('') + `</section>` +
        (i < LAYOUT.length - 1 ? `<i class="bd-link" style="left:${x + w}px;top:${(TOP + H + PAD) / 2}px;width:${GAP}px"></i>` : '')
      x += w + GAP
      return html
    }).join('') + `<span class="bd-cur" aria-hidden="true"><svg viewBox="0 0 20 22"><path d="M2 2l15 7.200-6.600 1.800L7 17.600z"/></svg><b>${esc(D.profile.name.split(' ')[0])}</b></span>`
    total = x - GAP
    $('.bd-layers').innerHTML = secs.map((s, i) => `<button type="button" class="bd-layer sec" data-col="${i}">${line('layer', 16)}<span>${esc(S[i].name)}</span></button>` +
      s.frames.map((f) => `<button type="button" class="bd-layer" data-col="${i}" data-card="${f.key}">${line(o.pictures[f.key] ? 'image' : 'frame', 16)}<span>${esc(f.name)}</span></button>`).join('')).join('')
    liven(root, o)
    // his own cursor wanders from piece to piece, the way a second person's does in the film's window
    const stops = secs.flatMap((s) => s.frames.map((f) => [s.x + PAD + f.x + f.w * 0.6, TOP + f.y + f.h * 0.55]))
    drift = $('.bd-cur').animate(stops.concat([stops[0]]).map(([cx, cy]) => ({ transform: `translate(${cx}px, ${cy}px)` })), { duration: stops.length * 4200, iterations: Infinity, easing: 'ease-in-out' })
    if (reduced()) drift.pause()
    select({ type: 'sec', i: 0 })
    begin()
  }).catch(() => { props.innerHTML = '<p class="bd-hint">The pictures for the canvas did not load. Please reload.</p>' })
  const still = () => { if (!root.isConnected) return removeEventListener('motionchange', still); if (drift) reduced() ? drift.pause() : drift.play() }
  addEventListener('motionchange', still)

  // opens fitted to all five sections, then eases to the one that is selected
  function begin() {
    if (started || !own || canvas.clientWidth < 10) return
    started = true
    fit(all(), false)
    setTimeout(() => { if (root.isConnected) fit(rectOf(sel.type === 'frame' ? sel : { type: 'sec', i: sel.i })) }, reduced() ? 0 : 900)
  }
  new ResizeObserver(begin).observe(canvas)

  // ---- the canvas: drag to pan, wheel or pinch to zoom, click to select, double-click to zoom in ----
  const pts = new Map()
  let moved = false, pinch = 0
  canvas.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.bd-tools') || (e.pointerType === 'mouse' && e.button)) return
    pts.set(e.pointerId, [e.clientX, e.clientY]); moved = false
    if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = Math.hypot(a[0] - b[0], a[1] - b[1]) }
  })
  canvas.addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect()
    if (e.pointerType === 'mouse' && !pts.size) { you.hidden = false; you.style.transform = `translate(${e.clientX - r.left + 14}px, ${e.clientY - r.top + 16}px)` }
    const p = pts.get(e.pointerId); if (!p) return
    const dx = e.clientX - p[0], dy = e.clientY - p[1]
    if (!moved && Math.hypot(dx, dy) < 4) return
    if (!moved) { moved = true; canvas.setPointerCapture(e.pointerId); canvas.classList.add('panning'); you.hidden = true }
    pts.set(e.pointerId, [e.clientX, e.clientY])
    if (pts.size === 2) { const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (pinch) zoom(d / pinch, (a[0] + b[0]) / 2 - r.left, (a[1] + b[1]) / 2 - r.top); pinch = d }
    else { view.x += dx; view.y += dy; apply() }
  })
  const up = (e) => { pts.delete(e.pointerId); if (pts.size < 2) pinch = 0; if (!pts.size) canvas.classList.remove('panning') }
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up)
  canvas.addEventListener('pointerleave', () => { you.hidden = true })
  canvas.addEventListener('wheel', (e) => { e.preventDefault(); const r = canvas.getBoundingClientRect(); zoom(Math.exp(-e.deltaY * 0.0016), e.clientX - r.left, e.clientY - r.top) }, { passive: false })
  const hit = (e) => { const c = e.target.closest('.bd-card'), s = e.target.closest('.bd-col'); return c ? { type: 'frame', i: +c.closest('.bd-col').dataset.col, key: c.dataset.card } : s ? { type: 'sec', i: +s.dataset.col } : null }
  world.addEventListener('click', (e) => { const s = hit(e); if (s && !moved && !hand && own) select(s) })
  world.addEventListener('dblclick', (e) => { const s = hit(e); if (s && own) select(s, true) })
  world.addEventListener('keydown', (e) => { if (e.key !== 'Enter' || !own) return; const s = hit(e); if (s) { select(s, true); $('.bd-open')?.focus({ preventScroll: true }) } })

  root.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b || !own) return
    const d = b.dataset
    if (d.tool) { hand = d.tool === 'hand'; canvas.classList.toggle('hand', hand); for (const t of root.querySelectorAll('[data-tool]')) t.setAttribute('aria-pressed', t === b) }
    else if (d.do === 'pages') ctx.act('pages', 'how')
    else if (d.do === 'fit') fit(all())
    else if (d.do === 'in' || d.do === 'out') zoom(d.do === 'in' ? 1.25 : 0.8, undefined, undefined, true)
    else if (d.do === 'open') open()
    else if (d.do === 'share') { const url = location.origin + location.pathname + '#how-i-work'; navigator.clipboard.writeText(url).then(() => ctx.toast('Link copied.'), () => ctx.toast(url)) }
    else if (d.card) select({ type: 'frame', i: +d.col, key: d.card }, true)
    else if (d.col) select({ type: 'sec', i: +d.col }, true)
  })

  return {
    title: 'How I work',
    show(step) { const i = S.findIndex((s) => s.name === step); if (i < 0) return; const go = () => (own ? select({ type: 'sec', i }, true) : setTimeout(go, 120)); go() },
    focus() { canvas.focus({ preventScroll: true }) },
  }
}
