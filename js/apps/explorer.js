// Projects: the Windows 11 File Explorer (film/SPEC.md "Projects is the real Windows 11 File Explorer"). References,
// with measurements in film/ref/ui/board/INDEX.md "explorer": board/explorer/01-explorer-tabs-home.jpg (tabs in the
// title bar, address row, command bar, navigation pane), 02-explorer-home-recommended.jpg (Home: Recommended cards,
// filter chips, the table), 03-explorer-address-bar-details.jpg (a folder as a details table), 04 (the pane, selected
// row). Arjun's own dark screenshot is the dark reference (not on disk; nothing of its content is used).
// The six parts, top to bottom: 1 the tab strip, 38 px, which is the window's title bar (tabs open, switch and close,
// each with its own history); 2 the address row, 44 px (back, forward, up, refresh, breadcrumbs, search); 3 the
// command bar, 46 px (New, then cut / copy / paste / rename / share / delete as icons, then Sort, View and Filter,
// and the Details pane's switch at the far right); 4 the navigation pane with a pinned group; 5 the content (Home:
// Recommended cards, chips, a table; a folder: the details table or large icons); 6 the status bar, 23 px.
// Each project is a folder, and inside it are real things only: a README (its description), its links as shortcuts,
// its launch film, its pictures (stills, the film's thumbnail, the pictures of its making). Large icons is the view it
// opens in, so every folder and picture shows its own thumbnail, and an opened project has its picture as a cover. The folder is read-only, so New, cut, paste, rename and delete are greyed out and say
// why. There is no date column: his data files hold no dates, and none are made up.
// On a narrow screen (a phone) the same thing is a single-column list, like a mobile files app (css/apps.css).
import { el } from '../config.js'
import { line } from '../icons.js'
import { esc, host, film, stillsOf, linksFor, openOver, menu, picturesOf, loadOwn } from './common.js'

const TYPE = { folder: 'File folder', text: 'Text document', link: 'Web shortcut', film: 'Video', image: 'JPEG image', app: 'App shortcut' }
const PLACES = [['home', 'Home'], ['projects', 'Projects'], ['films', 'Films'], ['results', 'Results'], ['how', 'How I work'], ['about', 'About'], ['contact', 'Contact']]
const SORTS = [['', 'Default'], ['az', 'Name, A to Z'], ['za', 'Name, Z to A'], ['type', 'Type']]
const VIEWS = [['details', 'Details'], ['tiles', 'Large icons']]
const FILTERS = [['', 'Everything'], ['film', 'Has a launch film'], ['live', 'Has a live site']]
const GLYPH = { text: 'article', image: 'image', link: 'globe', film: 'video' }
const RO = 'This folder is read-only'

export function mount(box, ctx) {
  const D = window.DATA, by = (id) => D.projects.find((p) => p.id === id)
  const pinned = (window.LIST || D.projects.slice(0, 4).map((p) => p.id)).map(by).filter(Boolean)       // the four the portfolio document leads with
  const root = box.appendChild(el('div', 'fx'))
  const ib = (act, icon, name, off) => `<button type="button" class="fx-ib" data-do="${act}" aria-label="${name}" title="${off ? RO : name}"${off ? ' disabled' : ''}>${line(icon, 20)}</button>`
  const drop = (act, icon, name) => `<button type="button" class="fx-db" data-do="${act}" aria-haspopup="menu">${line(icon, 20)}<span>${name}</span>${line('chev12', 12)}</button>`
  root.innerHTML = `<div class="fx-tabs"><div class="fx-tabrow" role="tablist" aria-label="Tabs"></div><button type="button" class="fx-new" data-do="newtab" aria-label="New tab" title="New tab">${line('plus16', 16)}</button></div>` +
    `<div class="fx-nav">${ib('back', 'back', 'Back')}${ib('fwd', 'fwd', 'Forward')}${ib('up', 'up', 'Up one folder')}${ib('refresh', 'reload', 'Refresh')}<nav class="fx-addr" aria-label="Address"></nav>` +
    `<label class="fx-search"><input type="search" autocomplete="off" spellcheck="false">${line('search16', 16)}</label></div>` +
    `<div class="fx-tool"><button type="button" class="fx-db" disabled title="${RO}">${line('newc', 20)}<span>New</span>${line('chev12', 12)}</button><i></i>` +
    `${ib('cut', 'cut', 'Cut', true)}${ib('copy', 'copy', 'Copy the link')}${ib('paste', 'paste', 'Paste', true)}${ib('rename', 'rename', 'Rename', true)}${ib('share', 'share', 'Share')}${ib('del', 'del', 'Delete', true)}<i></i>` +
    `${drop('sort', 'sort', 'Sort')}${drop('viewmenu', 'grid', 'View')}${drop('filter', 'filter', 'Filter')}<span class="fx-grow"></span><button type="button" class="fx-db" data-do="pane" aria-pressed="true">${line('pane', 20)}<span>Details</span></button></div>` +
    `<div class="fx-body"><nav class="fx-side" aria-label="Places">${PLACES.map(([id, n]) => `<button type="button" data-place="${id}">${PIX(id, 16)}<span>${n}</span></button>`).join('')}<hr>` +
    `${pinned.map((p) => `<button type="button" data-pin="${p.id}">${PIX('projects', 16)}<span>${esc(p.title)}</span>${line('pin', 12)}</button>`).join('')}</nav>` +
    `<div class="fx-main"><div class="fx-home" hidden></div><div class="fx-head" aria-hidden="true"><span>Name</span><span>Type</span><span>Details</span></div><div class="fx-list" role="listbox" aria-label="Files"></div></div>` +
    `<aside class="fx-pane" aria-live="polite"></aside></div>` +
    `<div class="fx-status"><span class="fx-count" aria-live="polite"></span><span class="fx-views">${VIEWS.map(([v, n], i) => `<button type="button" data-view="${v}" aria-label="${n}" title="${n}">${line(i ? 'vGrid' : 'vList', 16)}</button>`).join('')}</span></div>`
  const $ = (s) => root.querySelector(s), listEl = $('.fx-list'), input = $('.fx-search input'), homeEl = $('.fx-home'), pane = $('.fx-pane')

  // ---- the folders: real things only ----
  const HOME = [{ kind: 'folder', id: 'projects', name: 'Projects', pic: 'projects', note: D.projects.length + ' projects' },
    ...PLACES.slice(2).concat([['ai', 'AI Arjun']]).map(([id, name]) => ({ kind: 'app', id, name, pic: id, note: 'Opens ' + name }))]
  const inside = (p) => [
    { kind: 'text', name: 'README.md', note: p.description, p },
    ...linksFor(p).filter((l) => l.kind !== 'video').map((l) => ({ kind: 'link', name: l.label, note: host(l.href), href: l.href, pic: /github\.com/.test(l.href) ? 'github' : null, glyph: l.kind === 'code' ? 'code' : 'globe' })),
    ...(film(p) ? [{ kind: 'film', name: 'Launch film', note: /youtu/.test(film(p).href) ? 'On YouTube' : 'Film file', p }] : []),
    ...picturesOf(p, own).map((x) => ({ kind: 'image', name: x.src.split('/').pop(), note: (sizeOf(x.src) || []).join(' x '), src: x.src, alt: x.alt, p })),
  ]
  const folderOf = (p) => ({ kind: 'folder', id: p.id, name: p.title, pic: 'projects', note: p.meta, p, find: p.tags.join(' ') + ' ' + p.description })

  const fresh = (path) => ({ path, hist: [path], at: 0, sel: null, chip: 'all' })
  let own = null
  const sizeOf = (src) => (window.PICTURE_SIZES || {})[src] || Object.values((own && own.pictures) || {}).filter((o) => o.src === src).map((o) => [o.w, o.h])[0]
  let tabs = [fresh(['projects'])], T = tabs[0], view = 'tiles', sort = '', filter = '', touch = false, items = []
  const here = () => (T.path.length === 0 ? HOME.filter((it) => T.chip === 'all' || (T.chip === 'folders') === (it.kind === 'folder')) : T.path.length === 1 ? D.projects.map(folderOf) : inside(by(T.path[1])))
  const crumbsOf = (path) => [['Arjun', []]].concat(path.length ? [['Projects', ['projects']]] : [], path[1] ? [[by(path[1]).title, path]] : [])
  const nameOf = (path) => (path.length ? crumbsOf(path).at(-1)[0] : 'Home')

  function go(to, keep) {
    T.path = to; T.sel = null; input.value = ''
    if (!keep) { T.hist = T.hist.slice(0, T.at + 1).concat([to]); T.at = T.hist.length - 1 }
    draw(true)
  }
  const thumb = (it) => (it.kind === 'image' ? it.src : it.kind === 'folder' && it.p ? stillsOf(it.p)[0] : null)
  const icon = (it, z = 20) => (it.kind === 'image' ? `<img class="fx-th" src="${esc(it.src)}" alt="" loading="lazy" decoding="async">` : it.pic ? PIX(it.pic, z) : `<span class="fx-gl">${line(it.glyph || GLYPH[it.kind], 20)}</span>`)

  function draw(anew) {
    const name = nameOf(T.path), q = input.value.trim().toLowerCase(), home = !T.path.length
    items = here().filter((it) => !q || (it.name + ' ' + it.note + ' ' + (it.find || '')).toLowerCase().includes(q))
    if (T.path.length === 1 && filter) items = items.filter((it) => (filter === 'film' ? film(it.p) : linksFor(it.p).some((l) => l.kind === 'live')))
    if (sort === 'az' || sort === 'za') items.sort((a, b) => a.name.localeCompare(b.name) * (sort === 'az' ? 1 : -1))
    if (sort === 'type') items.sort((a, b) => TYPE[a.kind].localeCompare(TYPE[b.kind]) || a.name.localeCompare(b.name))
    $('.fx-tabrow').innerHTML = tabs.map((t, i) => `<div class="fx-tab" role="tab" tabindex="0" data-tab="${i}" aria-selected="${t === T}">${PIX(t.path.length ? 'projects' : 'home', 16)}<b>${esc(nameOf(t.path))}</b>` +
      (tabs.length > 1 ? `<button type="button" class="fx-x" data-close="${i}" aria-label="Close tab" title="Close tab">${line('x12', 12)}</button>` : '') + `</div>`).join('')
    input.placeholder = 'Search ' + name; input.setAttribute('aria-label', 'Search ' + name)
    $('.fx-addr').innerHTML = `<span class="fx-hm">${line('home16', 16)}</span>` + (home ? [['Home', []]] : crumbsOf(T.path)).map(([n], i, a) => `${line('chevR12', 12)}<button type="button" data-crumb="${i}"${i === a.length - 1 ? ' aria-current="page"' : ''}>${esc(n)}</button>`).join('')
    $('[data-do="back"]').disabled = T.at === 0; $('[data-do="fwd"]').disabled = T.at === T.hist.length - 1; $('[data-do="up"]').disabled = home
    $('[data-do="filter"]').disabled = T.path.length !== 1
    for (const b of root.querySelectorAll('[data-place]')) b.toggleAttribute('aria-current', b.dataset.place === (home ? 'home' : T.path.length === 1 ? 'projects' : ''))
    for (const b of root.querySelectorAll('[data-pin]')) b.toggleAttribute('aria-current', T.path[1] === b.dataset.pin)
    for (const b of root.querySelectorAll('[data-view]')) b.setAttribute('aria-pressed', b.dataset.view === view)
    root.dataset.view = view
    // Home: what he leads with as "Recommended" cards, then the chips that filter the table under them
    const inP = T.path.length === 2 && by(T.path[1]), cover = inP && (picturesOf(inP, own)[0] || {}).src      // an opened project: its picture as a cover
    homeEl.hidden = !(home || cover) || !!q
    if (!homeEl.hidden && cover) homeEl.innerHTML = `<div class="fx-cover"><img src="${esc(cover)}" alt="" decoding="async"><span><b>${esc(inP.title)}</b><i>${esc(inP.meta)}</i></span></div>`
    else if (!homeEl.hidden) homeEl.innerHTML = `<h4>Recommended</h4><div class="fx-cards">${pinned.map((p) => `<button type="button" class="fx-card" data-rec="${p.id}"><i>${esc(p.meta.split(' · ').pop())}</i>` +
      `<span class="fx-cp">${stillsOf(p)[0] ? `<img src="${esc(stillsOf(p)[0])}" alt="" loading="lazy" decoding="async">` : PIX(p.id, 48)}</span><span class="fx-cn">${PIX('projects', 20)}<span><b>${esc(p.title)}</b><em>Arjun › Projects</em></span></span></button>`).join('')}</div>` +
      `<div class="fx-chips" role="group" aria-label="Show">${[['all', 'Recent'], ['folders', 'Folders'], ['apps', 'Apps']].map(([id, n]) => `<button type="button" data-chip="${id}" aria-pressed="${T.chip === id}">${n}</button>`).join('')}</div>`
    listEl.innerHTML = items.map((it, i) => `<button type="button" class="fx-it" role="option" data-i="${i}" data-kind="${it.kind}" style="--i:${Math.min(i, 12)}"><span class="fx-n"><span class="fx-ic">${view === 'tiles' && thumb(it) ? `<img class="fx-th" src="${esc(thumb(it))}" alt="" loading="lazy" decoding="async">` : icon(it, view === 'tiles' ? 48 : 20)}</span><b>${esc(it.name)}</b></span>` +
      `<span class="fx-t">${TYPE[it.kind]}</span><span class="fx-d">${esc(it.note)}</span></button>`).join('') || `<p class="fx-none">${q ? `Nothing here matches "${esc(input.value.trim())}".` : 'This folder is empty.'}</p>`
    if (anew) { listEl.classList.remove('in'); void listEl.offsetWidth; listEl.classList.add('in'); $('.fx-main').scrollTop = 0 }
    mark()
  }
  function mark() {
    const it = items[T.sel]
    for (const b of listEl.children) if (b.dataset.i) b.setAttribute('aria-selected', +b.dataset.i === T.sel)
    $('.fx-count').textContent = items.length + (items.length === 1 ? ' item' : ' items') + (it ? '   |   1 item selected' : '')
    $('[data-do="copy"]').disabled = $('[data-do="share"]').disabled = !it
    // the Details pane: the selected file, or the folder itself
    const t = it && thumb(it)
    pane.innerHTML = it ? `<div class="fx-pv">${t ? `<img src="${esc(t)}" alt="">` : icon(it, 64)}</div><b>${esc(it.name)}</b><i>${TYPE[it.kind]}</i>` +
      `<p>${esc(it.kind === 'folder' && it.p ? it.p.description : it.note)}</p>${it.kind === 'folder' && it.p ? `<p class="fx-meta">${esc(it.p.meta)}</p>` : ''}<button type="button" class="wbtn" data-do="open">Open</button>`
      : `<div class="fx-pv">${PIX(T.path.length ? 'projects' : 'home', 64)}</div><b>${esc(nameOf(T.path))}</b><i>${items.length} ${items.length === 1 ? 'item' : 'items'}</i><p>${touch ? 'Tap a file to open it.' : 'Select a file to see its details. Double-click or press Enter to open it.'}</p>`
  }
  function open(it, from) {
    if (it.kind === 'folder') return go(it.id === 'projects' ? ['projects'] : ['projects', it.id])
    if (it.kind === 'app') return ctx.act(it.id)
    if (it.kind === 'film') return ctx.act('films', it.p.id)
    if (it.kind === 'link') return window.open(it.href, '_blank', 'noopener')
    if (it.kind === 'image') return openOver(root, from, it.name, `<img class="fx-img" src="${esc(it.src)}" alt="${esc(it.alt)}">`)
    const p = it.p
    openOver(root, from, 'README.md', `<div class="fx-read"><h3>${esc(p.title)}</h3><p class="meta">${esc(p.meta)}</p><p>${esc(p.description)}</p><p class="tags">${p.tags.map((t) => `<span>${esc(t)}</span>`).join('')}</p></div>`)
  }
  const linkOf = (it) => it.href || (it.p && (linksFor(it.p)[0] || {}).href) || location.origin + location.pathname + '#projects'
  const pickMenu = (b, list, cur, set) => menu(root, b, list.map(([v, n]) => [n, v, v === cur]), (v) => { set(v); T.sel = null; draw(true) })

  root.addEventListener('pointerdown', (e) => { touch = e.pointerType === 'touch' || e.pointerType === 'pen' }, true)
  listEl.addEventListener('click', (e) => {
    const b = e.target.closest('.fx-it'); if (!b) return
    T.sel = +b.dataset.i
    if (touch || e.detail === 0) open(items[T.sel], b); else mark()        // a tap, or Enter on the row, opens it; a mouse click selects
  })
  listEl.addEventListener('dblclick', (e) => { const b = e.target.closest('.fx-it'); if (b) open(items[+b.dataset.i], b) })
  input.addEventListener('input', () => { T.sel = null; draw() })
  root.addEventListener('keydown', (e) => { const t = e.target.closest('.fx-tab'); if (t && e.key === 'Enter') { T = tabs[+t.dataset.tab]; draw(true) } })
  root.addEventListener('click', (e) => {
    const tab = e.target.closest('.fx-tab'), b = e.target.closest('button')
    if (tab && !e.target.closest('.fx-x')) { T = tabs[+tab.dataset.tab]; return draw(true) }
    if (!b || b.disabled) return
    const d = b.dataset, it = items[T.sel]
    if (d.close) { const gone = tabs.splice(+d.close, 1)[0]; if (gone === T) T = tabs[Math.min(+d.close, tabs.length - 1)]; draw(true) }
    else if (d.do === 'newtab') { T = fresh([]); tabs.push(T); draw(true) }
    else if (d.crumb) go(T.path.length ? crumbsOf(T.path)[+d.crumb][1] : [])
    else if (d.place) d.place === 'home' ? go([]) : d.place === 'projects' ? go(['projects']) : ctx.act(d.place)
    else if (d.pin || d.rec) go(['projects', d.pin || d.rec])
    else if (d.chip) { T.chip = d.chip; T.sel = null; draw(true) }
    else if (d.view) { view = d.view; draw(true) }
    else if (d.do === 'back') { T.at--; go(T.hist[T.at], true) }
    else if (d.do === 'fwd') { T.at++; go(T.hist[T.at], true) }
    else if (d.do === 'up') go(T.path.slice(0, -1))
    else if (d.do === 'refresh') draw(true)
    else if (d.do === 'sort') pickMenu(b, SORTS, sort, (v) => { sort = v })
    else if (d.do === 'viewmenu') pickMenu(b, VIEWS, view, (v) => { view = v })
    else if (d.do === 'filter') pickMenu(b, FILTERS, filter, (v) => { filter = v })
    else if (d.do === 'pane') { const off = root.classList.toggle('nopane'); b.setAttribute('aria-pressed', !off) }
    else if (d.do === 'open' && it) open(it, listEl.querySelector(`[data-i="${T.sel}"]`))
    else if (d.do === 'copy' && it) navigator.clipboard.writeText(linkOf(it)).then(() => ctx.toast('Link copied.'), () => ctx.toast(linkOf(it)))
    else if (d.do === 'share' && it) (navigator.share ? navigator.share({ title: it.name, url: linkOf(it) }).catch(() => {}) : navigator.clipboard.writeText(linkOf(it)).then(() => ctx.toast('Link copied, ready to share.'), () => ctx.toast(linkOf(it))))
  })

  draw(true)
  loadOwn().then((o) => { own = o; draw() }).catch(() => {})      // the pictures of each project's making (media/own.json)
  return {
    title: 'Projects',
    bar: $('.fx-tabs'),                                            // the tab strip is the window's title bar (js/desktop.js flow())
    show(id) { if (id && by(id)) go(['projects', id]) },
    focus() { (listEl.firstElementChild || input).focus({ preventScroll: true }) },
  }
}
