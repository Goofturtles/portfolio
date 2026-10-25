'use strict'
// "AI Arjun": the second app (Arjun's idea, 2026-10-09). A browser-shaped window in the P4 window's chrome:
// an ask bar, an overview card in the manner of a search engine's overview, then link cards.
// The answer is looked up by lookup.js from his own data files. It is not a mock: type in the bar and press Enter.
//   ?view=ai                    the worked state: "What is AERIS?"
//   ?view=ai&q=What is Owed?    any other question
//   __seek(t): 0-? s the question types itself, then the cards arrive; with no ?t the page rests on the answer.
const AI = { WIN: P4.WIN, DEFAULT_Q: 'What is AERIS?', TYPE0: 0.35, PER: 0.065, THINK: 0.3 }
const LINK_ICON = { live: 'globe', code: 'code', video: 'play', store: 'store', mail: 'mail', article: 'article', profile: 'profile' }

function aiResultHTML(r) {
  const para = r.overview.map((p) => `<p>${esc(p)}</p>`).join('')
  const facts = r.facts.length ? `<ul class="facts">${r.facts.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>` : ''
  const tags = r.tags.length ? `<div class="chips tags">${r.tags.map((t) => `<span class="chip plain"><b>${esc(t)}</b></span>`).join('')}</div>` : ''
  const more = r.more.length ? `<details class="more"><summary>${I('chevR', 13)}More from his notes, in his words</summary>${r.more.map((m) => `<p>${esc(m)}</p>`).join('')}</details>` : ''
  const src = r.sources.length ? `<div class="src">Source: ${r.sources.map(esc).join(' · ')}</div>` : ''
  const linkCard = (l, small) => `<a class="lcard${small ? ' small' : ''}" href="${esc(l.href)}" target="_blank" rel="noopener"><span class="li-ic">${I(LINK_ICON[l.kind] || 'globe', small ? 18 : 22)}</span><span class="lt"><b>${esc(l.label)}</b><i>${esc(l.shown).replace(/\//g, '/<wbr>')}</i></span><span class="kind">${esc(l.kindLabel)}</span></a>`
  const links = r.links.length ? `<h3 class="rise">Links</h3>${r.links.map((l) => `<div class="rise">${linkCard(l)}</div>`).join('')}` : `<h3 class="rise">Links</h3><div class="rise none">No link for this in his notes.</div>`
  const note = r.linkNote ? `<div class="rise lnote">${esc(r.linkNote)}</div>` : ''
  const extra = r.moreLinks && r.moreLinks.length ? `<h3 class="rise">More from Arjun</h3>${r.moreLinks.map((l) => `<div class="rise">${linkCard(l, true)}</div>`).join('')}` : ''
  const next = r.related.length ? `<div class="next rise"><h3>Ask next</h3><div class="chips">${r.related.map((q) => `<button class="chip ask" data-q="${esc(q)}">${I('search', 15)}<b>${esc(q)}</b></button>`).join('')}</div></div>` : ''
  const pic = r.visual ? `<span class="tile-img pic"><img src="${esc(r.visual)}" alt=""></span>` : ''
  return `<div class="ov rise ${r.kind}"><div class="ovh">${I('spark', 20)}<b>Overview</b><i>from Arjun's own notes</i></div>${pic}<h2>${esc(r.title)}</h2>${para}${facts}${tags}${more}${src}</div>` +
    `<div class="lk-col">${links}${note}${extra}</div>${next}`
}

view('ai', {
  w: 1920, h: 1080, dur: 6, rest: 99,
  build(st) {
    if (BG) h('div', 'backdrop', st, '<i class="b1"></i><i class="b2"></i><i class="b3"></i><i class="b4"></i>')
    const W = AI.WIN
    const win = A(st, 'win glass ai', '', W.x, W.y, W.w, W.h)
    h('div', 'tbar', win, `${PIX('ai', 16, 19)}<b>AI Arjun</b><span class="wb">${I('min', 11, '', 'Minimise', 'br')}${I('max', 11, '', 'Maximise', 'br')}${I('close', 12, '', 'Close', 'br')}</span>`)
    const tool = h('div', 'tool', win, `<span class="nav">${I('back', 21, '', 'Back')}${I('fwd', 21, '', 'Forward')}${I('reload', 20, '', 'Reload')}</span>` +
      `<label class="askbar">${I('search', 20)}<input type="text" spellcheck="false" autocomplete="off" aria-label="Ask about Arjun" placeholder="Ask anything about Arjun"><span class="caret"></span></label>` +
      `<button class="live" type="button">Ask</button><span class="me">${AV('A', 'var(--a1)', 31, 'var(--r3)')}</span><span class="cm">${I('info', 24, '', 'A lookup over his own notes', 'br')}</span>`)
    const input = tool.querySelector('input'), caret = tool.querySelector('.caret')
    const content = A(win, 'content aic', '', 0, P4.TOP, W.w, W.h - P4.TOP)
    const col = A(content, 'aicol', '', 294, 0, 962)
    h('div', 'disc', col, `${I('info', 18)}<b>${esc(AIARJUN.DISCLOSURE)}</b><i>If something is not in them, it says so.</i>`)
    const res = h('div', 'res', col)

    let q = QS.get('q') || AI.DEFAULT_Q, result = null, rises = []
    const show = (question) => {
      q = question; result = AIARJUN.ask(q)
      res.innerHTML = aiResultHTML(result)
      rises = [...res.querySelectorAll('.rise')]
      window.__result = result
    }
    const draw = (t) => {
      const typed = Math.round(clamp((t - AI.TYPE0) / AI.PER, 0, q.length)), tDone = AI.TYPE0 + q.length * AI.PER + AI.THINK
      if (document.activeElement !== input) input.value = q.slice(0, typed)
      caret.style.display = t < tDone && document.activeElement !== input ? '' : 'none'
      caret.style.opacity = (t * 1.8) % 1 < 0.55 ? 1 : 0
      // the caret sits after the typed text (measured, not guessed)
      const m = document.createElement('canvas').getContext('2d'); m.font = getComputedStyle(input).font
      caret.style.left = (46 + m.measureText(input.value).width + 1) + 'px'
      rises.forEach((e, i) => { const k = P(t, tDone + i * 0.09, tDone + 0.5 + i * 0.09, E.o3); e.style.opacity = k; e.style.transform = k < 1 ? `translateY(${((1 - k) * 18).toFixed(2)}px)` : '' })
    }
    show(q)
    // real use: type a question, press Enter (or click Ask, or a suggestion)
    const go = (question) => { show(question); input.value = question; input.blur(); draw(99) }
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(input.value) })
    tool.querySelector('.live').addEventListener('click', () => go(input.value))
    res.addEventListener('click', (e) => { const b = e.target.closest('.ask'); if (b) go(b.dataset.q) })
    window.__ask = go
    return draw
  },
})
