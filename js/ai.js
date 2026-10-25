// AI Arjun on a phone: a mobile browser page in the pattern everyone knows (address bar, search box, filter tabs, the
// AI overview first, then ordinary results, then "People also ask"). The desktop uses film/ui's view_browser.js, which
// is a fixed 1535 px window; this is the same lookup laid out for a narrow screen.
// Every word of an answer comes from AIARJUN.ask (apps/lookup.js), which only repeats his own notes. No engine's logo
// or wordmark: the wordmark is the film's own ("AI" in the accent, "Arjun").
import { line } from './icons.js'
import { sectionHTML } from './sections.js'

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')
const out = (href) => ` href="${esc(href)}"` + (/^mailto:/.test(href) ? '' : ' target="_blank" rel="noopener"')
const TABS = [['all', 'All'], ['projects', 'Projects'], ['films', 'Films'], ['links', 'Links']]

// one link from the lookup as an ordinary result: site line, blue title, snippet
function result(l, r) {
  const mail = l.kind === 'mail', host = mail ? 'Email' : new URL(l.href).hostname.replace(/^www\./, '')
  const mine = l.from === 'projects.js' && r.kind === 'project'
  const title = mine ? r.title + ' - ' + l.label : l.label
  const snip = mine ? r.overview[0] : l.kindLabel + ' · from his notes (' + l.from + ')'
  return `<a class="mr"${out(l.href)}><span class="mr-site"><i>${esc(host[0].toUpperCase())}</i><span><b>${esc(host)}</b><cite>${esc(l.shown)}</cite></span></span>` +
    `<span class="mr-t">${esc(title)}</span><span class="mr-s">${esc(snip)}</span></a>`
}
function overview(r) {
  const li = (a) => `<ul>${a.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>`
  const said = r.kind === 'unknown' || r.kind === 'private' || r.kind === 'empty'
  return `<section class="mo" aria-label="AI overview"><p class="mo-h">${ICONS.spark} <b>AI overview</b> <i>from Arjun's own notes</i></p>` +
    `<h2>${esc(r.title)}</h2>${r.overview.map((p) => `<p>${esc(p)}</p>`).join('')}` +
    (r.facts.length ? li(r.facts) : '') + (r.tags.length ? `<p class="tags">${r.tags.map((t) => `<span>${esc(t)}</span>`).join('')}</p>` : '') +
    (r.more.length ? `<details><summary>More, in his words</summary>${r.more.map((m) => `<p>${esc(m)}</p>`).join('')}</details>` : '') +
    (r.sources.length ? `<p class="mo-src">Source: ${r.sources.map(esc).join(' · ')}</p>` : '') +
    `<p class="mo-fine">${esc(r.disclosure)}${said ? '' : ' If something is not in them, it says so.'}</p></section>`
}

// small glyphs: the site's line icons (js/icons.js)
const ICONS = { spark: line('spark', 16), chevR: line('chevR', 16) }

export function mountAI(host) {
  const ask = window.AIARJUN.ask
  host.innerHTML = `<div class="mb"><form class="mb-bar" role="search" aria-label="Address bar"><span class="mb-lock" aria-hidden="true">${ICON.info}</span>` +
    `<input class="mb-url" type="text" inputmode="search" enterkeyhint="search" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Ask anything about Arjun" placeholder="Ask anything about Arjun">` +
    `<button type="submit" class="mb-go" aria-label="Search">${ICON.search}</button></form>` +
    `<div class="mb-head"><span class="mb-mark" role="img" aria-label="AI Arjun"><b>AI</b><i>Arjun</i></span><nav class="mb-tabs" aria-label="Filter results">${TABS.map(([id, n]) => `<button type="button" data-tab="${id}">${n}</button>`).join('')}</nav></div>` +
    `<div class="mb-page" aria-live="polite"></div></div>`
  const input = host.querySelector('.mb-url'), page = host.querySelector('.mb-page')
  let S = { q: '', tab: 'all' }

  function render() {
    const r = ask(S.q)
    window.__result = r
    for (const b of host.querySelectorAll('.mb-tabs button')) b.setAttribute('aria-current', b.dataset.tab === S.tab ? 'page' : 'false')
    input.value = S.q
    const links = r.links.concat(r.moreLinks || [])
    const none = `<p class="mb-note">${esc(r.linkNote || 'No link for this in his notes.')}</p>`
    const also = r.related.length ? `<section class="mp" aria-label="People also ask"><h2>${S.q ? 'People also ask' : 'Try asking'}</h2>${r.related.map((q) => `<button type="button" data-q="${esc(q)}"><span>${esc(q)}</span>${ICONS.chevR}</button>`).join('')}</section>` : ''
    page.innerHTML = S.tab === 'projects' ? `<div class="sec">${sectionHTML('projects', { heading: false })}</div>`
      : S.tab === 'films' ? `<div class="sec">${sectionHTML('films', { heading: false })}</div>`
      : S.tab === 'links' ? (links.map((l) => result(l, r)).join('') || none)
      : overview(r) + r.links.map((l) => result(l, r)).join('') + (S.q && (!r.links.length || r.linkNote) ? none : '') + also + (r.moreLinks || []).map((l) => result(l, r)).join('')
  }
  const go = (q, tab = 'all') => { S = { q: String(q || '').trim(), tab }; render(); host.scrollTop = 0 }                 // the host is the phone's screen for this app, and it is what scrolls

  host.addEventListener('submit', (e) => { e.preventDefault(); input.blur(); go(input.value) })
  host.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return
    if (b.dataset.tab) go(S.q, b.dataset.tab)
    else if (b.dataset.q) go(b.dataset.q)
  })
  render()
  return go
}
