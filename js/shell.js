// The shell: the taskbar (the mini desktop's, and the same one along the bottom of the room), the search flyout, the
// phone's "More" sheet and the window frame, to Windows 11's measurements (css/shell.css).
// References: film/ref/ui/board/taskbar/ (01 diagram, 02 running apps, 03 tray), board/search/ (01 home, 02 best match
// and details, 04 the box and its panel), board/window/ (title bar, caption buttons). THE SITE OWNS THIS PART: film/ui
// (apps/, never edited) has its own 71 px taskbar because that is what the film's shots show at the film's scale.
//   taskbar   48 px, flat mica, a hairline on top, full width and flush with the bottom of the screen. On the mini
//             desktop one icon-only button at the far left (back to the room, Windows' widgets slot). In the middle, as
//             one centred group: the mark of ours first (Windows' Start slot: the portfolio), the search box (Windows'
//             own: 216 x 32, fully rounded, a step off the bar's colour in light and in dark), then the seven places.
//             On the right the tray: two quiet glyphs (Themes, Reduce motion) and the clock in two lines. The four
//             outside pages (GitHub, LinkedIn, Medium, YouTube) and the plain list are on the start card and in Contact,
//             not on the bar. 40 px buttons with 24 px icons (20 px in the tray); an open place has a 3 px pill under
//             it, 16 px wide under the one in front; tooltips.
//   search    a click on the box opens the Windows Search flyout: field, scopes, results on the left with the best
//             match first, its details on the right, live from the same lookup AI Arjun uses. Enter opens AI Arjun.
//   phone     five slots, the line icon over an 11 px Regular name (the fifth is More: everything else, in a sheet).
//   frame     32 px title bar (16 px icon 16 px from the edge, the title 16 px after it in caption type), three
//             46 x 32 caption buttons, Close red on hover. Measurements: learn.microsoft.com, "Windows app title bar".
import { el, reduced, calm, setCalm } from './config.js'
import { ico, line, CAPTION } from './icons.js'
import { film, linksFor } from './apps/common.js'

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')
const NAME = { home: 'Room', app: 'Portfolio', search: 'Search', ai: 'AI Arjun', projects: 'Projects', films: 'Films', how: 'How I work', results: 'Results', about: 'About', contact: 'Contact',
  github: 'GitHub', linkedin: 'LinkedIn', medium: 'Medium', youtube: 'YouTube', themes: 'Themes', sound: 'Sound', calm: 'Reduce motion', plain: 'Plain list', more: 'More' }
export const YOUTUBE = 'https://www.youtube.com/@AER-S'
const TO = { home: '#home', app: '#portfolio', search: '#ai-arjun', ai: '#ai-arjun', how: '#how-i-work', plain: 'plain.html', youtube: YOUTUBE }
const ROOM_TO = { projects: '#portfolio', how: '#pages-how', results: '#pages-results' }      // from the room these three land elsewhere (js/main.js CHIP)
// the tray's four: each icon carries both drawings, the line one and the filled one for when it is on (css/shell.css swaps them)
const TRAY = { themes: 1, sound: 1, calm: 1, plain: 1 }
const sysCalm = matchMedia('(prefers-reduced-motion: reduce)')
// what each bar carries. phone: the four slots before More; sheet: the groups behind More
const BARS = {
  desktop: { left: 'home', mid: ['app', 'search', 'ai', 'projects', 'films', 'how', 'results', 'about', 'contact'], tray: ['themes', 'calm'],
    phone: ['home', 'app', 'ai', 'projects'], sheet: [['films', 'how', 'results', 'about', 'contact'], ['github', 'linkedin', 'medium', 'youtube'], ['themes', 'sound', 'calm', 'plain']] },
  room: { left: null, mid: ['app', 'projects', 'ai', 'how', 'results', 'about', 'contact'], tray: ['themes', 'calm', 'plain'],
    phone: ['projects', 'ai', 'how', 'results'], sheet: [['about', 'contact'], ['themes', 'calm', 'plain']] },
}

// opts: { kind: 'desktop' | 'room', pick(id, anchor, event, arg) }. Returns { el, stop }.
export function taskbar(parent, ui, phone, opts) {
  const D = window.DATA, L = D.profile.links, B = BARS[opts.kind], room = opts.kind === 'room'
  const bar = el('div', 'taskbar ' + ui)
  bar.setAttribute('role', 'navigation'); bar.setAttribute('aria-label', 'Taskbar')
  const to = (id) => (room && ROOM_TO[id]) || L[id] || TO[id] || '#' + id
  const name = (id) => (id === 'app' ? D.profile.name + ': Portfolio' : id === 'home' ? 'Back to the room' : NAME[id])
  const attrs = (id) => { const h = to(id), out = /^https?:/.test(h); return `data-ico="${id}" href="${esc(h)}"${out ? ' target="_blank" rel="noopener"' : ''} aria-label="${esc(name(id))}"` + (id !== 'plain' && TRAY[id] && id !== 'themes' ? ' role="button" aria-pressed="false"' : '') }
  const tip = (text) => `<small class="tip">${esc(text)}</small>`
  const tk = (id) => {
    if (id === 'search') return `<a class="tk tk-search" ${attrs(id)} role="button" aria-haspopup="dialog" aria-expanded="false">${ico('search', 16)}<span class="tk-q">Search</span>${tip('Search his work, or ask AI Arjun')}</a>`
    if (TRAY[id]) return `<a class="tk tk-tray" ${attrs(id)}>${ico(id, 20)}${tip(NAME[id])}</a>`
    return `<a class="tk${/^https?:/.test(to(id)) ? ' tk-link' : ''}" ${attrs(id)}>${ico(id, 24)}${tip(id === 'app' ? name(id) : NAME[id])}</a>`
  }
  let sheet = null
  if (phone) {
    bar.innerHTML = B.phone.concat('more').map((id) => `<a class="tk" ${id === 'more' ? 'data-ico="more" href="#more" role="button" aria-haspopup="dialog" aria-expanded="false" aria-label="More"' : attrs(id)}>${ico(id, 24)}${tip(NAME[id])}</a>`).join('')
    sheet = el('div', 'more-sheet ' + ui, `<div class="ms-card" role="dialog" aria-label="More">${B.sheet.map((g) => `<div class="ms-g">${g.map((id) => `<a class="mk" ${attrs(id)}>` +
      `${ico(id, 24)}<span>${NAME[id]}</span>${id === 'calm' || id === 'sound' ? '<em></em>' : line(/^https?:/.test(to(id)) ? 'go' : 'chevR', 16)}</a>`).join('')}</div>`).join('')}</div>`)
    sheet.hidden = true
  } else {
    // the mini desktop's one button at the far left is icon-only (Windows' widgets slot): back to the room
    bar.innerHTML = (B.left ? `<a class="tk tb-room" ${attrs(B.left)}>${ico(B.left, 24)}${tip('Back to the room')}</a>` : '') +
      `<div class="tiles">${B.mid.map(tk).join('')}</div><div class="tray">${B.tray.map(tk).join('')}<span class="clock" aria-hidden="true"><b></b><b></b></span></div>`
  }
  parent.appendChild(bar)
  if (sheet) parent.appendChild(sheet)

  // two lines, no seconds, as the visitor's own machine writes them
  const [time, day] = bar.querySelectorAll('.clock b')
  const tick = () => { if (!time) return; const d = new Date(), t = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); if (time.textContent !== t) { time.textContent = t; day.textContent = d.toLocaleDateString() } }      // written only when the minute has changed: a write is a style and layout pass
  tick()
  const ticking = setInterval(tick, 5000)

  let sound = false
  const all = (sel) => [bar, sheet].filter(Boolean).flatMap((h) => [...h.querySelectorAll(sel)])
  // Reduce motion: on when the visitor chose it here or when the system asks for it, and read live (config.js sends
  // 'motionchange' for both). The system's wish cannot be undone from the page, so then the control is shown on and inert.
  function sync() {
    const sys = sysCalm.matches
    for (const a of all('[data-ico="calm"]')) {
      a.setAttribute('aria-pressed', reduced())
      if (sys) a.setAttribute('aria-disabled', 'true'); else a.removeAttribute('aria-disabled')
      const s = a.querySelector('em'), t = a.querySelector('.tip')
      if (s) s.textContent = sys ? 'On, set by your system' : reduced() ? 'On' : 'Off'
      if (t) t.textContent = sys ? 'Reduce motion: on, set by your system' : NAME.calm
    }
    for (const a of all('[data-ico="sound"]')) { a.setAttribute('aria-pressed', sound); const s = a.querySelector('em'); if (s) s.textContent = sound ? 'On' : 'Off' }
  }
  sync()
  addEventListener('motionchange', sync)
  function showSheet(on) {
    if (!sheet || sheet.hidden === !on) return
    sheet.hidden = !on
    bar.querySelector('[data-ico="more"]').setAttribute('aria-expanded', on)
    if (on) sheet.querySelector('.mk').focus({ preventScroll: true })
  }
  const search = !phone && !room ? flyout(parent, bar, opts.pick) : null
  function click(e) {
    const a = e.target.closest('[data-ico]')
    if (!a) { if (e.target === sheet) showSheet(false); return }
    const id = a.dataset.ico, h = a.getAttribute('href')
    if (id === 'more') { e.preventDefault(); return showSheet(sheet.hidden) }
    showSheet(false)
    if (/^https?:/.test(h) || id === 'plain') return           // his own pages elsewhere and the plain list: real links, simply followed
    e.preventDefault()
    if (id === 'search') return search.toggle()
    if (id === 'calm') return sysCalm.matches ? undefined : setCalm(!calm())
    if (id === 'sound') { sound = !sound; sync() }
    opts.pick(id, a, e)
  }
  bar.addEventListener('click', click)
  if (sheet) { sheet.addEventListener('click', click); sheet.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); showSheet(false); bar.querySelector('[data-ico="more"]').focus({ preventScroll: true }) } }) }
  return { el: bar, stop: () => { clearInterval(ticking); removeEventListener('motionchange', sync); if (sheet) sheet.remove(); if (search) search.remove() } }
}

// ---- Windows Search (film/ref/ui/board/search/): the panel above the taskbar ----
const SCOPES = [['all', 'All'], ['projects', 'Projects'], ['films', 'Films'], ['links', 'Links']]
function flyout(parent, bar, pick) {
  const D = window.DATA, box = el('div', 'sf ' + (bar.classList.contains('dark') ? 'dark' : 'light'))
  box.hidden = true; box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', 'Search')
  box.innerHTML = `<label class="sf-top">${line('search', 20)}<input class="sf-in" type="text" autocomplete="off" spellcheck="false" placeholder="Search his projects, films and links, or ask a question" aria-label="Search"></label>` +
    `<div class="sf-scopes" role="tablist" aria-label="Scope">${SCOPES.map(([id, n], i) => `<button type="button" role="tab" data-scope="${id}" aria-selected="${!i}">${n}</button>`).join('')}</div>` +
    `<div class="sf-cols"><div class="sf-list" role="listbox" aria-label="Results"></div><aside class="sf-pane" aria-live="polite"></aside></div>`
  parent.appendChild(box)
  const input = box.querySelector('.sf-in'), list = box.querySelector('.sf-list'), pane = box.querySelector('.sf-pane'), opener = bar.querySelector('.tk-search')
  let scope = 'all', rows = [], sel = -1, moved = false, recent = []
  try { recent = JSON.parse(sessionStorage.getItem('pc-recent') || '[]') } catch (e) { /* private mode: no recent questions */ }
  const ask = (q) => window.AIARJUN.ask(q)
  const whatIs = (p) => 'What is ' + p.title + '?'
  const gl = (id) => `<span class="sf-gl">${ico(id, 20)}</span>`        // a result's icon: the Fluent line icon on no ground, as in Windows Search's list
  const project = (p) => ({ kind: 'project', icon: gl('projects'), name: p.title, sub: 'Project · ' + p.meta, p, q: whatIs(p) })
  const movie = (p) => ({ kind: 'film', icon: gl('films'), name: p.title, sub: 'Launch film', p, q: whatIs(p) })
  const link = (l) => ({ kind: 'link', icon: `<span class="sf-gl">${line(l.kind === 'mail' ? 'mail' : 'globe', 20)}</span>`, name: l.label, sub: l.shown, l })
  const question = (q, sub) => ({ kind: 'ask', icon: `<span class="sf-gl">${line(sub ? 'recent' : 'search', 20)}</span>`, name: q, sub: sub || 'Ask AI Arjun', q })

  function find() {
    const q = input.value.trim(), lq = q.toLowerCase(), r = ask(q), out = []
    const hit = (p) => !q || (p.title + ' ' + p.meta + ' ' + p.tags.join(' ')).toLowerCase().includes(lq)
    const P = D.projects.filter(hit), group = (head, items) => { if (items.length) out.push({ head }, ...items) }
    if (scope === 'all' && q) group('Best match', [{ kind: 'best', icon: gl(r.id && D.projects.some((p) => p.id === r.id) ? 'projects' : 'ai'), name: r.title, sub: 'Answer · from his own notes', q }])
    if (scope === 'all' && !q) { group('Suggested', r.related.slice(0, 4).map((s) => question(s))); group('Recent', recent.map((s) => question(s, 'Asked earlier'))) }
    if (scope === 'projects' || (scope === 'all' && q)) group('Projects', P.slice(0, scope === 'all' ? 3 : 11).map(project))
    if (scope === 'films') group('Films', P.filter(film).map(movie))
    if (scope === 'links') group('Links', (q ? r.links.concat(r.moreLinks || []) : ask('How can I contact you?').links).map(link))
    if (q) out.push({ head: 'Search the web of Arjun' }, { kind: 'web', icon: `<span class="sf-gl">${line('search', 20)}</span>`, name: q, sub: 'See every result in AI Arjun', q })
    return out
  }
  function draw(keep) {
    rows = find()
    if (!keep || !rows[sel] || rows[sel].head) sel = rows.findIndex((x) => !x.head)
    list.innerHTML = rows.map((x, i) => (x.head ? `<h4>${esc(x.head)}</h4>` : `<button type="button" class="sf-row" role="option" data-i="${i}" aria-selected="${i === sel}">${x.icon}<span><b>${esc(x.name)}</b><i>${esc(x.sub)}</i></span></button>`)).join('') ||
      `<p class="sf-none">Nothing in his notes matches that.</p>`
    for (const b of box.querySelectorAll('[data-scope]')) b.setAttribute('aria-selected', b.dataset.scope === scope)
    detail()
  }
  // the pane on the right: what the selected row is, in his own words, and what can be done with it
  function detail() {
    const x = rows[sel]
    if (!x) { pane.innerHTML = ''; return }
    const btn = (label, act, main) => `<button type="button" class="wbtn${main ? ' accent' : ''}" data-act="${act}">${label}</button>`
    let head, text = [], facts = [], links = [], acts = ''
    if (x.kind === 'link') { head = [x.icon, x.name, x.sub]; acts = `<a class="wbtn accent" href="${esc(x.l.href)}"${/^mailto:/.test(x.l.href) ? '' : ' target="_blank" rel="noopener"'}>Open</a>` }
    else {
      const r = ask(x.q)
      head = [x.kind === 'film' ? gl('films') : x.kind === 'project' || (r.id && D.projects.some((p) => p.id === r.id)) ? gl('projects') : gl('ai'), x.kind === 'ask' || x.kind === 'web' ? r.title : x.name, x.kind === 'project' ? x.p.meta : x.kind === 'film' ? 'Launch film · ' + x.p.meta : 'From his own notes']
      text = r.overview.slice(0, 2); facts = r.facts.slice(0, 4)
      links = x.p ? linksFor(x.p) : r.links.slice(0, 4)
      acts = (x.kind === 'film' ? btn('Play the film', 'film', true) + btn('Ask AI Arjun', 'ask') : btn('Open in AI Arjun', 'ask', true) + (x.p ? btn('Open its folder', 'folder') : ''))
    }
    pane.innerHTML = `<div class="sf-id">${head[0]}<b>${esc(head[1])}</b><i>${esc(head[2])}</i></div><div class="sf-acts">${acts}</div>` +
      (text.length ? `<div class="sf-text">${text.map((t) => `<p>${esc(t)}</p>`).join('')}</div>` : '') +
      (facts.length ? `<h5>Details</h5><ul class="sf-facts">${facts.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>` : '') +
      (links.length ? `<h5>Links</h5><p class="sf-links">${links.map((l) => `<a href="${esc(l.href)}"${/^mailto:/.test(l.href) ? '' : ' target="_blank" rel="noopener"'}>${esc(l.label)}${line('go', 16)}</a>`).join('')}</p>` : '')
  }
  function show(on) {
    if (box.hidden === !on) return
    opener.setAttribute('aria-expanded', on)
    if (on) { box.hidden = false; box.classList.remove('closing'); moved = false; draw(); input.focus({ preventScroll: true }); input.select(); return }
    box.classList.add('closing')
    setTimeout(() => { box.hidden = true; box.classList.remove('closing') }, reduced() ? 0 : 150)
  }
  // Enter opens the AI Arjun browser on the question (film/SPEC.md); a film row plays the film, a folder button opens the folder
  function go(act, x) {
    const q = (x && x.q) || input.value.trim()
    if (act === 'film') pick('films', null, null, x.p.id)
    else if (act === 'folder') pick('projects', null, null, x.p.id)
    else {
      if (q) { recent = [q, ...recent.filter((s) => s !== q)].slice(0, 3); try { sessionStorage.setItem('pc-recent', JSON.stringify(recent)) } catch (e) { /* as above */ } }
      pick('ai', null, null, q || undefined)
    }
    show(false)
  }
  input.addEventListener('input', () => { moved = false; draw() })
  box.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); show(false); opener.focus({ preventScroll: true }) }
    else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const live = rows.map((x, i) => (x.head ? -1 : i)).filter((i) => i >= 0), at = live.indexOf(sel), to = live[Math.max(0, Math.min(live.length - 1, at + (e.key === 'ArrowDown' ? 1 : -1)))]
      if (to != null) { sel = to; moved = true; draw(true); list.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' }) }
    } else if (e.key === 'Enter' && e.target === input) {
      e.preventDefault()
      const x = rows[sel]
      if (moved && x && x.kind === 'link') window.open(x.l.href, '_blank', 'noopener'), show(false)
      else go(moved && x && x.kind === 'film' ? 'film' : 'ask', moved ? x : null)
    }
  })
  box.addEventListener('click', (e) => {
    const b = e.target.closest('button, a'); if (!b) return
    if (b.dataset.scope) { scope = b.dataset.scope; moved = false; draw(); input.focus({ preventScroll: true }) }
    else if (b.dataset.i) { sel = +b.dataset.i; moved = true; draw(true) }
    else if (b.dataset.act) go(b.dataset.act, rows[sel])
    else if (b.tagName === 'A') show(false)
  })
  list.addEventListener('dblclick', (e) => { const b = e.target.closest('.sf-row'); if (b) { const x = rows[+b.dataset.i]; x.kind === 'link' ? (window.open(x.l.href, '_blank', 'noopener'), show(false)) : go(x.kind === 'film' ? 'film' : 'ask', x) } })
  const outside = (e) => { if (!box.isConnected) return removeEventListener('pointerdown', outside, true); if (!box.hidden && !e.target.closest('.sf, .tk-search')) show(false) }
  addEventListener('pointerdown', outside, true)
  return { toggle: () => show(box.hidden), remove: () => box.remove() }
}

// a window's title bar. tall = the bar is something else (a tab strip): only the three buttons are made
export function titlebar(w, tall) {
  const btn = (act, name) => `<button type="button" data-do="${act}" aria-label="${name}" title="${name}">${CAPTION[act]}</button>`
  const box = el('div', 'wbx', btn('min', 'Minimise') + btn('max', 'Maximise') + btn('close', 'Close'))
  if (tall) { w.el.appendChild(box); return box }
  const bar = el('header', 'tbar', `${ico(w.icon, 16)}<b>${esc(w.title)}</b>`)
  bar.appendChild(box)
  w.el.prepend(bar)
  return bar
}
// Maximise becomes Restore while the window is maximised
export function setMax(w) {
  const b = w.el.querySelector('.wbx [data-do="max"]'), name = w.max ? 'Restore' : 'Maximise'
  b.innerHTML = CAPTION[w.max ? 'restore' : 'max']; b.setAttribute('aria-label', name); b.title = name
}
