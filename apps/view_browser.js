'use strict'
// "AI Arjun" as a real browser on a real search engine (film/SPEC.md, "AI Arjun app", last rule). Arjun, after the
// first version: "the search interface thing looks nothing like any search engine". So: a browser window (tab strip,
// back / forward / reload, address bar, profile) showing a results page in the pattern everyone knows.
//   ?view=browser                      the new-tab page: wordmark, big search box, suggested questions
//   ?view=browser&q=what is owed       the results page for a question
//   &tab=projects|films|links          a filter tab            &more=1   the overview opened
//   &open=0                            the nth "People also ask" row opened      &s=600  scrolled down 600 px
//   __seek(t): with ?q the question types itself on the new-tab page, then the results arrive. No ?t = the settled page.
// Every word of an answer comes from lookup.js (AIARJUN.ask), which only repeats Arjun's own data files. This file
// lays the answer out; it writes interface words (labels, headings) and nothing about him.
// Layout references: film/ref/ui/search/. No engine's logo or wordmark: the wordmark is ours, the icons are kit.js's.
;(function () {
  const WIN = P4.WIN, ZOOM = 1.2, HOST = 'ai.arjun'
  const TYPE0 = 0.5, PER = 0.06, LOAD = 0.3            // seconds: before typing, per letter, between Enter and the page
  const TABS = [['all', 'All'], ['projects', 'Projects'], ['films', 'Films'], ['links', 'Links']]
  // The notes files, in plain words (lookup.js's own header says what each one holds)
  const NOTES = {
    'projects.js': ['Project notes', 'titles, descriptions, tags and links'],
    'aiArjun.js': ['His own answers', 'written by him, repeated word for word'],
    'TrackRecordRow.jsx': ['Results list', 'his results and their links'],
    'profile.js': ['Profile', 'his profile links'],
  }
  const SITES = { 'github.com': ['github', 'GitHub'], 'youtube.com': ['youtube', 'YouTube'], 'youtu.be': ['youtube', 'YouTube'], 'medium.com': ['medium', 'Medium'], 'linkedin.com': ['linkedin', 'LinkedIn'] }
  const SITE_INK = { github: 'var(--gh)', youtube: 'var(--yt)', medium: 'var(--md)', linkedin: 'var(--li)' }
  const KIND_ICON = { live: 'globe', code: 'code', video: 'play', store: 'store', mail: 'mail', article: 'article', profile: 'profile' }
  const SVG = {
    x: '<svg viewBox="0 0 20 20"><path d="M5.5 5.5l9 9M14.5 5.5l-9 9" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
    grid: '<svg viewBox="0 0 20 20">' + [4, 10, 16].map((y) => [4, 10, 16].map((x) => `<circle cx="${x}" cy="${y}" r="1.7" fill="currentColor"/>`).join('')).join('') + '</svg>',
    go: '<svg viewBox="0 0 20 20"><path d="M4 10h11.5M11 5.2l4.8 4.8-4.8 4.8" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  }
  const ic = (svg, z, cls) => `<span class="ic ${cls || ''}" style="--z:${z}px" aria-hidden="true">${svg}</span>`
  const plus = (s) => encodeURIComponent(s).replace(/%20/g, '+')
  const hrefFor = (q, tab) => '?view=browser' + (q ? '&q=' + plus(q) : '') + (tab && tab !== 'all' ? '&tab=' + tab : '')
  const address = (q, tab) => (q ? HOST + '/search?q=' + plus(q) + (tab && tab !== 'all' ? '&tab=' + tab : '') : '')
  // what was typed in the address bar: one of our own addresses, or simply a question
  function readAddress(v) {
    v = String(v || '').trim()
    const m = v.match(/^(?:https?:\/\/)?ai\.arjun(?:\/(?:search)?(?:\?(.*))?)?$/i)
    if (!m) return { q: v, tab: 'all' }
    const p = new URLSearchParams(m[1] || '')
    return { q: (p.get('q') || '').trim(), tab: p.get('tab') || 'all' }
  }
  const WORDS_OUT = new Set('a an the and or of to for in on at is are was were be do does did you your i me my it its this that what whats who how why can could would tell show about have has'.split(' '))
  const MARK = '<span class="g-mark"><b>AI</b><i>Arjun</i></span>'

  view('browser', {
    w: 1920, h: 1080, dur: 8, rest: 99,
    build(st) {
      const D = window.DATA, ask = window.AIARJUN.ask, NAME1 = D.profile.name.split(' ')[0]
      const SMALL = window.AIARJUN.DISCLOSURE + ' If something is not in them, it says so.'
      const byId = Object.fromEntries(D.projects.map((p) => [p.id, p]))
      const ext = (href) => ` href="${esc(href)}"` + (/^mailto:/.test(href) ? '' : ' target="_blank" rel="noopener"')
      const inn = (q, tab) => ` href="${esc(hrefFor(q, tab))}" data-go`

      // ---- the window ------------------------------------------------------------------------------
      if (BG) h('div', 'backdrop', st, '<i class="b1"></i><i class="b2"></i><i class="b3"></i><i class="b4"></i>')
      const win = A(st, 'win br-win', '', WIN.x, WIN.y, WIN.w, WIN.h)
      win.style.setProperty('--pz', ZOOM)
      win.innerHTML =
        `<div class="br-tabs"><div class="br-tablist" role="tablist" aria-label="Tabs"><button type="button" class="br-ib br-new"${NAME('New tab')}>${ic(ICON.plus, 15)}</button></div>` +
        `<span class="br-wb">${I('min', 11, '', 'Minimise', 'br')}${I('max', 11, '', 'Maximise', 'br')}${I('close', 12, '', 'Close', 'br')}</span></div>` +
        `<div class="br-bar"><span class="br-nav"><button type="button" class="br-ib br-back"${NAME('Back')}>${ic(ICON.back, 21)}</button>` +
        `<button type="button" class="br-ib br-fwd"${NAME('Forward')}>${ic(ICON.fwd, 21)}</button>` +
        `<button type="button" class="br-ib br-re"${NAME('Reload')}>${ic(ICON.reload, 20)}</button></span>` +
        `<form class="br-omni" role="search" aria-label="Address bar" action="index.html" method="get"><span class="br-info">${I('info', 17, '', window.AIARJUN.DISCLOSURE)}</span>` +
        `<input type="hidden" name="view" value="browser"><input class="br-url" type="text" name="q" autocomplete="off" spellcheck="false" aria-label="Address and search bar" placeholder="Search ${esc(D.profile.name.split(' ')[0])}'s notes or type a question">` +
        `<span class="br-addr" aria-hidden="true"></span></form>` +
        `<button type="button" class="br-me"${NAME('About ' + D.profile.name)}>${AV(NAME1[0], 'var(--a1)', 30)}</button></div>` +
        `<i class="br-prog" aria-hidden="true"></i><div class="br-view" tabindex="-1"><div class="br-page"></div></div><div class="br-sb" aria-hidden="true"><i></i></div><div class="br-live" role="status"></div>`
      const $ = (s, root) => (root || win).querySelector(s)
      const list = $('.br-tablist'), newBtn = $('.br-new'), url = $('.br-url'), addr = $('.br-addr'), viewEl = $('.br-view'), page = $('.br-page'), sb = $('.br-sb'), live = $('.br-live')

      // ---- one link from the lookup -> one ordinary result --------------------------------------------
      function site(l, pid) {
        if (l.kind === 'mail') return { name: 'Email', crumb: l.shown, fav: ic(ICON.mail, 17) }
        const u = new URL(l.href), host = u.hostname.replace(/^www\./, ''), known = SITES[host], p = pid && byId[pid]
        const crumb = u.origin + u.pathname.split('/').filter(Boolean).map((s) => ' › ' + decodeURIComponent(s)).join('')
        const pic = p && PIC[pid] ? EMO(PIC[pid][0], PIC[pid][1], 18) : ic(ICON.globe, 17)
        if (known) {
          const d = D.brand && D.brand[known[0]]
          return { name: known[1], crumb, fav: d ? `<svg class="g-fb" viewBox="0 0 24 24" style="fill:${SITE_INK[known[0]]}"><path d="${d}"/></svg>` : `<span class="g-fl" style="background:${SITE_INK[known[0]]}">${BRANDS[known[0]] || known[1][0]}</span>` }
        }
        if (l.href.startsWith(D.site)) return { name: D.profile.name, crumb, fav: pic }       // a page on his own portfolio
        if (p && l.kind === 'live') return { name: p.title, crumb, fav: pic }                  // a project's own site
        return { name: host, crumb, fav: ic(ICON.globe, 17) }
      }
      const medium = D.record.find((x) => x.id === 'medium')
      function linkResult(l, pid) {
        const p = pid && byId[pid], rec = l.from === 'TrackRecordRow.jsx' && D.record.find((x) => x.href === l.href)
        let title = l.label, snip = ''
        if (l.from === 'projects.js' && p) {
          title = p.title + ' - ' + l.label
          snip = l.kind === 'video' ? p.meta : l.kind === 'code' ? p.tags.join(' · ') : p.description
        } else if (rec) {
          pid = rec.projectId; snip = rec.summary + (rec.project ? ' · ' + rec.project : '')
        } else if (l.kind === 'mail') snip = D.profile.privacyNote
        else {
          title = D.profile.name + ' - ' + l.label
          snip = l.kind === 'code' ? D.profile.summary : l.kind === 'article' ? (medium ? medium.project : '') : l.kind === 'profile' ? D.profile.role + ' · ' + D.profile.location : D.profile.headline + ' ' + D.profile.summary
        }
        return Object.assign(site(l, pid), { href: l.href, title, snip })
      }
      const projectAnswer = (p) => { const r = ask('What is ' + p.title + '?'); return r.id === p.id ? r : null }   // the lookup's own links for a project (its AERIS rule included)
      const words = (q) => [...new Set(q.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w.length >= 3 && !WORDS_OUT.has(w)))]
      const bold = (text, q) => { const w = words(q); return w.length ? String(text).split(new RegExp('\\b(' + w.join('|') + ')\\b', 'gi')).map((s, i) => (i % 2 ? '<b>' + esc(s) + '</b>' : esc(s))).join('') : esc(text) }
      function resultHTML(x, q) {
        const top = `<a class="g-r-top"${ext(x.href)}><span class="g-r-site"><span class="g-fav">${x.fav}</span><span class="g-r-n"><b>${esc(x.name)}</b><cite>${esc(x.crumb)}</cite></span></span><h3 class="g-title">${esc(x.title)}</h3></a>`
        const body = (x.snip ? `<p class="g-snip">${bold(x.snip, q)}</p>` : '') + (x.chips ? `<div class="g-chips">${x.chips.map((c) => `<a${ext(c.href)}>${esc(c.label)}</a>`).join('')}</div>` : '')
        return x.thumb !== undefined ? `<div class="g-r g-film rise"><span class="g-thumb">${x.thumb}</span><div>${top}${body}</div></div>` : `<div class="g-r rise">${top}${body}</div>`
      }

      // ---- AI overview --------------------------------------------------------------------------------
      // the first clause of five words or more gets the highlight the references give their key phrase
      function lead(text) {
        const re = /[^,:;().]+/g; let m
        while ((m = re.exec(text))) { const seg = m[0].trim(); if (seg.split(/\s+/).length >= 5) { const at = m.index + m[0].indexOf(seg); return esc(text.slice(0, at)) + '<mark>' + esc(seg) + '</mark>' + esc(text.slice(at + seg.length)) } }
        return esc(text)
      }
      function overviewHTML(r, open) {
        const said = r.kind === 'unknown' || r.kind === 'private'       // the title is the answer: "I don't have that in my notes."
        let first = r.overview.map((p, i) => `<p>${i ? esc(p) : said ? '<mark>' + esc(r.title.replace(/\.$/, '')) + '.</mark> ' + esc(p) : lead(p)}</p>`).join('') || (said ? `<p><mark>${esc(r.title)}</mark></p>` : '')
        const list = (items) => `<ul>${items.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>`
        let rest = ''
        if (r.kind === 'project') {
          rest = `<p class="g-k">Key facts from his notes:</p>` + list(r.facts.concat(r.tags.length ? ['Tags: ' + r.tags.join(', ')] : []))
          if (r.more.length) rest += `<p class="g-k">In his words:</p><p>${esc(r.more[r.more.length - 1])}</p>`
        } else if (r.kind === 'record') rest = `<p class="g-k">Results in his notes:</p>` + list(r.facts)
        else if (r.more.length) rest = `<p class="g-k">The longer version, in his words:</p>` + r.more.map((m) => `<p>${esc(m)}</p>`).join('')
        if (!first) { first = rest; rest = '' }
        const src = r.sources.map((f) => { const n = NOTES[f] || [f, '']; return `<li><span class="g-src-s">${ic(ICON.article, 15)}${esc(NAME1)}'s notes</span><b>${esc(n[0])}</b><i>${esc(f)}${n[1] ? ': ' + esc(n[1]) : ''}</i></li>` }).join('')
        return `<section class="g-ai rise${open ? ' open' : ''}" aria-labelledby="g-ai-h"><div class="g-ai-h">${ic(ICON.spark, 22)}<h2 id="g-ai-h">AI overview</h2><small>from ${esc(NAME1)}'s own notes</small></div>` +
          `<div class="g-ai-b"><div class="g-ai-lead">${first}</div>${rest ? `<div class="g-ai-rest" id="g-ai-rest">${rest}</div>` : ''}</div>` +
          (rest ? `<button type="button" class="g-more" aria-expanded="${open ? 'true' : 'false'}" aria-controls="g-ai-rest"><span>${open ? 'Show less' : 'Show more'}</span>${ic(ICON.chev, 16)}</button>` : '') +
          (src ? `<ul class="g-src" aria-label="Where this answer comes from">${src}</ul>` : '') +
          `<p class="g-fine">${esc(SMALL)}</p></section>`
      }

      // ---- People also ask: each row is looked up the same way when it is opened -----------------------
      function paaHTML(list, openAt) {
        if (!list.length) return ''
        return `<section class="g-paa rise" aria-labelledby="g-paa-h"><h2 id="g-paa-h">People also ask</h2>` + list.map((q, i) =>
          `<div class="g-pa${i === openAt ? ' open' : ''}"><h3><button type="button" class="g-pa-q" aria-expanded="${i === openAt}" aria-controls="g-pa-${i}" data-q="${esc(q)}"><span>${esc(q)}</span><span class="g-pa-c">${ic(ICON.chev, 16)}</span></button></h3>` +
          `<div class="g-pa-a" id="g-pa-${i}"${i === openAt ? '' : ' hidden'}>${i === openAt ? paaAnswer(q) : ''}</div></div>`).join('') + `</section>`
      }
      function paaAnswer(q) {
        const r = ask(q), l = r.links[0], x = l && linkResult(l, r.id)
        const text = r.overview.length ? r.overview : r.facts.length ? [r.facts.join('; ') + '.'] : [r.title]
        return text.map((p) => `<p>${esc(p)}</p>`).join('') + (x ? `<cite>${esc(x.crumb)}</cite><a class="g-pa-t"${ext(x.href)}>${esc(x.title)}</a>` : '') +
          `<a class="g-pa-s"${inn(q)}>Search for: <u>${esc(q)}</u></a>`
      }

      // ---- the panel for a project: picture, name, link buttons, facts ---------------------------------
      function panelHTML(r) {
        const p = byId[r.id]
        const pic = r.visual ? `<div class="g-kp-pic"><img src="${esc(r.visual)}" alt="${esc(r.title)}: a still from the project" decoding="async"></div>` : `<div class="g-kp-pic none" aria-hidden="true">${PIC[r.id] ? EMO(PIC[r.id][0], PIC[r.id][1], 64) : ''}</div>`
        const f1 = r.facts[1] || '', l1 = /\b(1st|2nd|3rd|place|best|top \d)\b/i.test(f1) ? 'Result' : /hack|challenge|humanity/i.test(f1) ? 'Event' : 'Status'
        const facts = [['Build', r.facts[0]], [l1, f1], ['Tags', r.tags.join(', ')], ['Source', r.sources.join(', ')]].filter((f) => f[1])
        const btns = r.links.map((l) => `<a class="g-kp-btn"${ext(l.href)}>${ic(ICON[KIND_ICON[l.kind] || 'globe'], 17)}${esc(l.label)}</a>`).join('')
        const quote = r.more.length > 1 ? `<p class="g-kp-q">${esc(r.more[0])}<small>${esc(NAME1)}, in his own notes</small></p>` : ''
        return `<aside class="g-kp rise" aria-label="About ${esc(r.title)}">${pic}<div class="g-kp-b"><h2>${esc(r.title)}</h2><p class="g-kp-sub">${esc(p.meta.split(' · ')[0])}</p>` +
          (btns ? `<div class="g-kp-btns">${btns}</div>` : '') + (r.linkNote ? `<p class="g-kp-ln">${esc(r.linkNote)}</p>` : '') + quote +
          `<dl>${facts.map((f) => `<div><dt>${esc(f[0])}</dt><dd>${esc(f[1])}</dd></div>`).join('')}</dl></div></aside>`
      }

      // ---- pages --------------------------------------------------------------------------------------
      function headHTML(q, tab) {
        return `<header class="g-head"><a class="g-logo"${inn('')} aria-label="AI Arjun: start page">${MARK}</a>` +
          `<form class="g-search" role="search" aria-label="Search" action="index.html" method="get"><input type="hidden" name="view" value="browser">` +
          `<input class="g-q" type="text" name="q" value="${esc(q)}" autocomplete="off" spellcheck="false" aria-label="Search ${esc(NAME1)}'s notes">` +
          `<button type="button" class="g-sb g-clear"${NAME('Clear')}>${ic(SVG.x, 22)}</button><span class="g-sep"></span>` +
          `<button type="submit" class="g-sb g-go"${NAME('Search')}>${ic(ICON.search, 22)}</button></form>` +
          `<div class="g-corner"><a class="g-ib"${inn(q, 'projects')}${NAME('All projects')}>${ic(SVG.grid, 22)}</a><a class="g-pill"${inn('How can I contact you?')}>Contact</a></div></header>` +
          `<nav class="g-tabs" aria-label="Filter results">${TABS.map(([id, label]) => `<a${inn(q, id)}${id === tab ? ' aria-current="page"' : ''}>${label}</a>`).join('')}</nav>`
      }
      function resultsHTML(S, opt) {
        const r = ask(S.q), q = S.q
        window.__result = r
        let col = '', side = ''
        if (S.tab === 'all') {
          const main = r.links.map((l) => linkResult(l, r.id)), extra = (r.moreLinks || []).map((l) => linkResult(l))
          const note = r.linkNote || (r.links.length ? '' : 'No link for this in his notes.')
          col = overviewHTML(r, opt.more) + main.slice(0, 3).map((x) => resultHTML(x, q)).join('') + (main.length ? '' : `<p class="g-note rise" style="margin-top:0">${esc(note)}</p>`) +
            paaHTML(r.related.filter((x) => words(x).join(' ') !== words(q).join(' ')).slice(0, 4), opt.open) + main.slice(3).concat(extra).map((x) => resultHTML(x, q)).join('') + (main.length && note ? `<p class="g-note rise">${esc(note)}</p>` : '')
          if (r.kind === 'project') side = panelHTML(r)
        } else if (S.tab === 'links') {
          const all = r.links.map((l) => linkResult(l, r.id)).concat((r.moreLinks || []).map((l) => linkResult(l)))
          col = all.map((x) => resultHTML(x, q)).join('') + (r.linkNote || !all.length ? `<p class="g-note rise"${all.length ? '' : ' style="margin-top:0"'}>${esc(r.linkNote || 'No link for this in his notes.')}</p>` : '')
        } else {
          // Projects and Films: everything in projects.js, the project asked about first
          const order = D.projects.slice().sort((a, b) => (b.id === r.id) - (a.id === r.id))
          for (const p of order) {
            const pr = projectAnswer(p); if (!pr || !pr.links.length) continue
            if (S.tab === 'projects') {
              const l = pr.links[0]
              col += resultHTML(Object.assign(site(l, p.id), { name: p.title, href: l.href, title: p.title + ' - ' + (pr.facts[1] || pr.facts[0]), snip: p.description, chips: pr.links.map((k) => ({ label: k.label, href: k.href })) }), q)
            } else {
              const l = pr.links.find((k) => k.kind === 'video'); if (!l) continue
              const thumb = p.visual ? `<img src="${esc(p.visual)}" alt="" loading="lazy" decoding="async">` : PIC[p.id] ? EMO(PIC[p.id][0], PIC[p.id][1], 44) : ''
              col += resultHTML(Object.assign(linkResult(l, p.id), { thumb }), q)
            }
          }
        }
        return headHTML(q, S.tab) + `<h1 class="br-sr">Results for ${esc(q)}</h1><div class="g-main"><main class="g-col">${col}</main>${side}</div><footer class="g-foot">${esc(NAME1)}'s notes: ${Object.keys(NOTES).map(esc).join(' · ')}</footer>`
      }
      function startHTML() {
        const L = D.profile.links
        const tiles = [
          ['Projects', PIX('projects', 26), inn('What have you built?', 'projects')], ['Films', PIX('films', 26), inn('What have you built?', 'films')], ['Results', PIX('results', 26), inn('What have you won?')],
          ['GitHub', BRAND('github', 26), ext(L.github)], ['Medium', BRAND('medium', 26), ext(L.medium)], ['LinkedIn', BRAND('linkedin', 26), ext(L.linkedin)], ['Email', PIX('contact', 26), ext('mailto:' + L.email)],
        ]
        return `<main class="n-page"><div class="n-top"><a${ext(D.site + '/')}>Portfolio</a><a class="g-ib"${inn('What have you built?', 'projects')}${NAME('All projects')}>${ic(SVG.grid, 22)}</a><a class="g-pill"${inn('How can I contact you?')}>Contact</a></div>` +
          `<h1 class="g-mark n-mark" aria-label="AI Arjun"><b>AI</b><i>Arjun</i></h1>` +
          `<form class="g-search n-search" role="search" aria-label="Search" action="index.html" method="get"><input type="hidden" name="view" value="browser">${ic(ICON.search, 20, 'g-s-ico')}` +
          `<input class="g-q" type="text" name="q" autocomplete="off" spellcheck="false" aria-label="Ask anything about ${esc(NAME1)}" placeholder="Ask anything about ${esc(NAME1)}"><span class="n-caret"></span>` +
          `<button type="submit" class="g-sb g-go"${NAME('Search')}>${ic(SVG.go, 20)}</button></form>` +
          `<ul class="n-sugg" aria-label="Suggested questions">${ask('').related.map((q) => `<li><a${inn(q)}>${ic(ICON.search, 16)}${esc(q)}</a></li>`).join('')}</ul>` +
          `<ul class="n-tiles" aria-label="Shortcuts">${tiles.map((t) => `<li><a${t[2]}><span>${t[1]}</span>${t[0]}</a></li>`).join('')}</ul>` +
          `<footer class="n-foot">${esc(SMALL)}</footer></main>`
      }

      // ---- state: what is shown, and the back / forward list --------------------------------------------
      // SITE: tabs (Arjun, twice: "new tab" did nothing). Each tab keeps its own page (the question and the filter), address,
      // title, scroll position and back / forward list; the live S, hist and at below are the selected tab's, written back
      // to it (pick) when another is selected. Up to MAXTABS; closing the last one leaves a fresh new tab.
      const MAXTABS = 8, tabs = []
      function addTab() {
        const t = { S: { q: '', tab: 'all' }, at: 0, s: 0, el: document.createElement('div') }
        t.hist = [t.S]
        t.el.className = 'br-tab'; t.el.setAttribute('role', 'presentation')
        t.el.innerHTML = `<button type="button" class="br-ts" role="tab" aria-selected="false" tabindex="-1"><span class="br-tfav">${PIX('ai', 18, 20)}</span><b class="br-tt">New tab</b></button>` +
          `<button type="button" class="br-ib br-x"${NAME('Close tab')}>${ic(SVG.x, 13)}</button>`
        t.ts = t.el.firstChild; t.tt = t.ts.lastChild
        list.insertBefore(t.el, newBtn); tabs.push(t); newBtn.disabled = tabs.length >= MAXTABS
        return t
      }
      let cur = addTab(), S = cur.S, hist = cur.hist, at = 0, used = false, rises = []
      const mark = () => { for (const x of tabs) { const on = x === cur; x.el.classList.toggle('sel', on); x.ts.setAttribute('aria-selected', on); x.ts.tabIndex = on ? 0 : -1 } }
      mark()
      function render(opt) {
        opt = opt || {}
        const start = !S.q
        page.innerHTML = start ? startHTML() : resultsHTML(S, opt)
        cur.tt.textContent = cur.ts.title = start ? 'New tab' : S.q + ' - AI Arjun'
        const a = address(S.q, S.tab)
        url.value = a; url.classList.toggle('has', !!a)
        addr.innerHTML = a ? `<b>${HOST}</b>${esc(a.slice(HOST.length))}` : ''
        $('.br-back').disabled = at <= 0; $('.br-fwd').disabled = at >= hist.length - 1
        live.textContent = start ? 'New tab' : 'Results for ' + S.q
        rises = [...page.querySelectorAll('.rise')]
        viewEl.scrollTop = opt.s || 0
        for (const im of page.querySelectorAll('img')) if (!im.complete) im.addEventListener('load', bar, { once: true })
        bar()
      }
      // the drawn scrollbar (the real one is hidden in a capture)
      function bar() {
        const total = viewEl.scrollHeight, seen = viewEl.clientHeight, track = sb.clientHeight, thumb = sb.firstChild
        sb.style.display = total - seen < 2 ? 'none' : ''
        const hh = Math.max(36, track * seen / total)
        thumb.style.height = hh + 'px'; thumb.style.top = ((track - hh) * viewEl.scrollTop / Math.max(1, total - seen)) + 'px'
      }
      viewEl.addEventListener('scroll', bar)
      // SITE: a search loads as a real engine's does (Arjun: "when you type in the google thing it has a loading animation
      // before giving results like google does"): for 0.4 to 0.9 s, longer for a longer question, a thin line runs along
      // the top of the page, the tab's icon is a spinner and the AI overview is grey lines with a sheen moving over them;
      // then the overview's lines come in one by one and the results under them. With reduced motion, the answer at once.
      let loadT = 0, revealT = 0
      const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.classList.contains('calm')
      const SKEL = `<div class="g-skel" aria-hidden="true"><div class="g-ai-h">${ic(ICON.spark, 22)}<h2>AI overview</h2></div><i style="width:96%"></i><i style="width:90%"></i><i style="width:93%"></i><i style="width:58%"></i></div>`
      function reveal() {
        win.classList.remove('loading'); win.classList.add('loaded', 'reveal'); page.querySelector('.g-skel')?.remove()
        const lines = [...page.querySelectorAll('.g-ai-lead > *')]
        lines.forEach((e, i) => e.style.setProperty('--l', i))
        rises.filter((e) => !e.classList.contains('g-ai')).forEach((e, i) => e.style.setProperty('--n', lines.length + i))
        clearTimeout(revealT); revealT = setTimeout(() => win.classList.remove('loaded', 'reveal'), 1600)
      }
      function go(q, tab, opt) {
        used = true
        const next = { q: String(q || '').trim(), tab: TABS.some((t) => t[0] === tab) ? tab : 'all' }
        if (next.q !== S.q || next.tab !== S.tab) { hist = hist.slice(0, at + 1); hist.push(next); at = hist.length - 1 }
        clearTimeout(loadT); win.classList.remove('loading', 'loaded', 'reveal')
        S = next; render(opt); settle()
        if (S.q && !still()) {
          win.classList.add('loading')
          const col = page.querySelector('.g-col'); if (col) col.insertAdjacentHTML('afterbegin', SKEL)
          const ms = Math.round(Math.min(900, 400 + S.q.length * 12)); win.style.setProperty('--load', ms + 'ms')
          loadT = setTimeout(reveal, ms)
        }
        if (!(opt && opt.quiet)) viewEl.focus({ preventScroll: true })
      }
      const step = (d) => { if (hist[at + d]) { used = true; at += d; S = hist[at]; render(); settle(); viewEl.focus({ preventScroll: true }) } }
      const settle = () => { for (const e of rises) { e.style.opacity = ''; e.style.transform = '' } }
      // select a tab: the one left is written back, the new one is drawn from its own state at its own scroll
      function pick(t) {
        if (t === cur) return
        if (cur) { cur.S = S; cur.hist = hist; cur.at = at; cur.s = viewEl.scrollTop }
        cur = t; S = t.S; hist = t.hist; at = t.at
        mark()
        clearTimeout(loadT); win.classList.remove('loading', 'loaded', 'reveal')      // a search still loading belongs to the tab left: this one is shown as it was
        render({ s: t.s }); settle()
      }
      function openTab() {
        if (tabs.length >= MAXTABS) return
        used = true
        pick(addTab())
        const box = $('.n-search .g-q'); if (box) box.focus()
      }
      function closeTab(t) {
        const i = tabs.indexOf(t); if (i < 0) return
        tabs.splice(i, 1); t.el.remove(); newBtn.disabled = tabs.length >= MAXTABS
        used = true
        if (t !== cur) return
        cur = null                                                 // the page on show is the one that was closed: nothing to write back
        pick(tabs.length ? tabs[Math.min(i, tabs.length - 1)] : addTab())      // its neighbour, or, after the last, one fresh new tab
        if (!S.q) { const box = $('.n-search .g-q'); if (box) box.focus() } else viewEl.focus({ preventScroll: true })
      }
      list.addEventListener('keydown', (e) => {
        const i = tabs.findIndex((t) => t.ts === e.target), j = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : -1
        if (i < 0 || !tabs[j]) return
        e.preventDefault(); pick(tabs[j]); tabs[j].ts.focus()
      })
      list.addEventListener('auxclick', (e) => { const t = e.button === 1 && tabs.find((x) => x.el.contains(e.target)); if (t) { e.preventDefault(); closeTab(t) } })      // the middle button closes a tab

      // ---- real use: forms, links, buttons ----------------------------------------------------------------
      win.addEventListener('submit', (e) => {
        e.preventDefault()
        const input = e.target.querySelector('input[name="q"]')
        if (e.target.classList.contains('br-omni')) { const a = readAddress(input.value); go(a.q, a.tab) } else go(input.value, 'all')
      })
      win.addEventListener('click', (e) => {
        const link = e.target.closest('a[data-go]')
        if (link) { e.preventDefault(); const p = new URLSearchParams(link.getAttribute('href').split('?')[1]); return go(p.get('q') || '', p.get('tab') || 'all') }
        const b = e.target.closest('button'); if (!b) return
        if (b.classList.contains('br-new')) openTab()
        else if (b.classList.contains('br-x')) closeTab(tabs.find((t) => t.el.contains(b)))
        else if (b.classList.contains('br-ts')) pick(tabs.find((t) => t.ts === b))
        else if (b.classList.contains('br-back')) step(-1)
        else if (b.classList.contains('br-fwd')) step(1)
        else if (b.classList.contains('br-re')) { used = true; render(); settle() }
        else if (b.classList.contains('br-me')) go('Who is ' + NAME1 + '?', 'all')
        else if (b.classList.contains('g-clear')) { const box = $('.g-head .g-q'); box.value = ''; box.focus() }
        else if (b.classList.contains('g-more')) {
          const open = !b.closest('.g-ai').classList.contains('open')
          b.closest('.g-ai').classList.toggle('open', open); b.setAttribute('aria-expanded', open); b.firstChild.textContent = open ? 'Show less' : 'Show more'; bar()
        } else if (b.classList.contains('g-pa-q')) {
          const row = b.closest('.g-pa'), box = row.querySelector('.g-pa-a'), open = !row.classList.contains('open')
          if (open && !box.innerHTML) box.innerHTML = paaAnswer(b.dataset.q)
          row.classList.toggle('open', open); box.hidden = !open; b.setAttribute('aria-expanded', open); bar()
        }
      })
      win.addEventListener('focusin', (e) => { if (e.target.tagName === 'INPUT') { used = true; if (e.target === url) url.select() } })

      // ---- time: the question types itself on the new-tab page, Enter, the results arrive ---------------
      const q0 = (QS.get('q') || '').trim(), tab0 = QS.get('tab') || 'all'
      const opt0 = { more: QS.get('more') === '1', open: QS.get('open') != null ? parseInt(QS.get('open')) : -1, s: parseFloat(QS.get('s')) || 0 }
      const tEnter = TYPE0 + q0.length * PER, tPage = tEnter + LOAD
      let phase = ''
      const meter = document.createElement('canvas').getContext('2d')
      const draw = (t) => {
        if (used) return
        if (!q0) { if (phase !== 'start') { phase = 'start'; S = hist[0]; at = 0; render() } return }
        if (t < tPage) {
          if (phase !== 'typing') { phase = 'typing'; hist = [{ q: '', tab: 'all' }]; at = 0; S = hist[0]; render() }
          const box = $('.n-search .g-q'), caret = $('.n-caret')
          box.value = q0.slice(0, Math.round(clamp((t - TYPE0) / PER, 0, q0.length)))
          meter.font = getComputedStyle(box).font
          caret.style.display = t < tEnter && (t * 1.8) % 1 < 0.55 ? 'block' : 'none'
          caret.style.left = (box.offsetLeft + meter.measureText(box.value).width + 1) + 'px'
          return
        }
        if (phase !== 'results') { phase = 'results'; hist = [{ q: '', tab: 'all' }, { q: q0, tab: TABS.some((x) => x[0] === tab0) ? tab0 : 'all' }]; at = 1; S = hist[1]; render(opt0) }
        rises.forEach((e, i) => { const k = P(t, tPage + i * 0.07, tPage + 0.45 + i * 0.07, E.o3); e.style.opacity = k < 1 ? k : ''; e.style.transform = k < 1 ? `translateY(${((1 - k) * 14).toFixed(2)}px)` : '' })
      }
      window.__ask = (q, tab) => go(q, tab, { quiet: true })
      window.__browser = { state: () => ({ q: S.q, tab: S.tab, at, hist: hist.length, tabs: tabs.length, current: tabs.indexOf(cur) }), bar }
      return draw
    },
  })
})()
