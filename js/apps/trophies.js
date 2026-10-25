// Results: a page in the manner of the Windows 11 Settings app (film/SPEC.md "Results is re-picked"). References:
// film/ref/ui/board/settings/01-windows11-settings-home.png (page title, cards), 03-winui-settings-page-layout.png
// and 04-settings-about-expander.png (a card that opens as an expander, its rows indented under it).
// A page title, then one settings card per result: its Fluent colour icon on no ground, the result as the header, what
// it was for as the description, the placing at the right, and a chevron. Opened, it holds his own one-line account of
// the project and the real links (the proof, the project's folder), and above them the pictures of that win: the project's stills and its launch film, one
// large and up to three under it, each enlarged by a click (a result with no pictures of its own shows none). Exactly
// the results in his track record (DATA.record): nothing locked, nothing invented, no points, no percentages, no medals.
import { el } from '../config.js'
import { line } from '../icons.js'
import { esc, out, host, picturesOf, loadOwn, openOver } from './common.js'

export function mount(box, ctx) {
  const D = window.DATA, R = D.record, by = (id) => D.projects.find((p) => p.id === id)
  const root = box.appendChild(el('div', 'ac'))
  const row = (key, text, action = '') => `<div class="ac-row"><i>${key}</i><span>${esc(text)}</span>${action}</div>`
  const card = (r, i) => {
    const p = r.projectId && by(r.projectId)
    return `<li style="--i:${i}"><button type="button" class="ac-card" aria-expanded="false" aria-controls="ac-${r.id}">${PIX(r.pic || (r.id === 'medium' ? 'writing' : r.id), 32)}` +
      `<span class="ac-what"><b>${esc(r.title)}</b><i>${esc(r.summary)}${r.project && r.project !== r.title ? ' · ' + esc(r.project) : ''}</i></span><em class="ac-tag">${esc(r.tag)}</em>${line('chev', 16)}</button>` +
      `<div class="ac-more" id="ac-${r.id}" hidden>${row('Result', r.summary)}${p ? row('Build', p.meta) : ''}` +
      (r.project ? row(p ? 'Project' : 'Piece', r.project, p ? `<button type="button" class="wlink" data-open="${p.id}">Open its folder${line('chevR', 16)}</button>` : '') : '') +
      (r.href ? row('Proof', host(r.href).split('/')[0], `<a class="wlink"${out(r.href)}>${esc(r.cta)}${line('go', 16)}</a>`) : '') + `</div></li>`
  }
  root.innerHTML = `<div class="ac-page" tabindex="0"><h3 class="ac-title">Results</h3><p class="ac-n"><b>${R.length}</b> results, from ${esc(D.profile.name)}'s track record</p><ol class="ac-list">${R.map(card).join('')}</ol></div>`
  loadOwn().catch(() => null).then((own) => {
    for (const r of R) {
      const p = r.projectId && by(r.projectId), pics = p ? picturesOf(p, own).slice(0, 4) : []
      const pic = (x) => `<button type="button" class="ac-pic" data-src="${esc(x.src)}" data-alt="${esc(x.alt)}" aria-label="${esc('Enlarge: ' + x.alt)}"><img src="${esc(x.src)}" alt="" loading="lazy" decoding="async"></button>`
      if (pics.length) root.querySelector('#ac-' + r.id).insertAdjacentHTML('afterbegin', `<div class="ac-pics">${pic(pics[0])}${pics.length > 1 ? `<div class="ac-small">${pics.slice(1).map(pic).join('')}</div>` : ''}</div>`)
    }
  })
  root.addEventListener('click', (e) => {
    const pic = e.target.closest('.ac-pic')
    if (pic) return openOver(root, pic, pic.dataset.alt, `<img class="fx-img" src="${esc(pic.dataset.src)}" alt="${esc(pic.dataset.alt)}">`)
    const go = e.target.closest('[data-open]'), c = e.target.closest('.ac-card')
    if (go) return ctx.act('projects', go.dataset.open)
    if (!c) return
    const open = c.getAttribute('aria-expanded') !== 'true'
    c.setAttribute('aria-expanded', open); c.nextElementSibling.hidden = !open
  })
  return {
    title: 'Results',
    show() { root.classList.remove('in'); void root.offsetWidth; root.classList.add('in') },     // opened again: the cards arrive again
    focus() { root.querySelector('.ac-card').focus({ preventScroll: true }) },
  }
}
