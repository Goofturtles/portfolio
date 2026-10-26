// "How I work": the five steps, each with REAL material from his work, the same his live portfolio shows
// (portfolio-v2 ProcessRow.jsx; pictures and code in media/own.json, written by tools/sync_own.py):
//   Research  the RISE Research acceptance        Sketch   a design canvas with his real app screens
//   Build     the real Python from Shade Route, typing out          Test   Shade Route running on a phone
//   Present   the presenter view of his projects
// One scene per step. The sheets of Pages (js/pages.js) and the cards of the board (js/apps/board.js) both use them.
// The names and one-line captions are his (DATA.steps).
import { esc, typeOut } from './common.js'

export const steps = () => window.DATA.steps
const pic = (own, k, cls = '') => { const p = own.pictures[k]; return `<img class="${cls}" src="${p.src}" width="${p.w}" height="${p.h}" alt="${esc(p.caption)}" loading="lazy" decoding="async">` }

export function sceneHTML(i, own) {
  const D = window.DATA
  if (i === 0) {
    const r = D.record.find((x) => x.id === 'rise')
    return `<div class="hw hw-research"><article class="hw-accept">${PIX('rise', 54, 60)}<em>${esc(r.tag)}</em><h4>${esc(r.title)}</h4><p>${esc(r.summary)}</p><footer><span>Awarded to</span><b>${esc(D.profile.name)}</b></footer></article></div>`
  }
  if (i === 1) return `<div class="hw hw-sketch">${['sketch-shade', 'sketch-folio', 'sketch-ghostbus'].map((k, n) => `<figure class="f${n}"><figcaption>${esc(own.pictures[k].caption)}</figcaption>${pic(own, k)}</figure>`).join('')}` +
    `<span class="hw-cur" aria-hidden="true"><svg viewBox="0 0 20 22"><path d="M2 2l15 7.200-6.600 1.800L7 17.600z"/></svg><b>${esc(D.profile.name.split(' ')[0])}</b></span></div>`
  if (i === 2) return `<div class="hw hw-build">${pic(own, 'build-map-dark', 'map')}<div class="hw-ed"><p class="tab"><b>shade.py</b></p><pre class="hw-code" tabindex="0" aria-label="${esc(own.code.about)}"></pre><p class="file">${esc(own.code.file)}</p></div></div>`
  if (i === 3) return `<div class="hw hw-test"><span class="ph back">${pic(own, 'phone2-dark')}</span><span class="ph front">${pic(own, 'phone-dark')}<i class="tap" aria-hidden="true"></i></span></div>`
  const slides = ['thumb-shade-dark', 'thumb-folio-dark', 'thumb-ghostbus']
  return `<div class="hw hw-present"><p class="bar"><span class="live"><i></i>Presenting</span><span>Slide 1 of ${slides.length}</span><span class="time">00:00</span></p><figure>${pic(own, 'present-shade-dark')}</figure>` +
    `<ol>${slides.map((k, n) => `<li${n ? '' : ' class="on"'}>${pic(own, k)}<span>${n + 1} · ${esc(own.pictures[k].caption)}</span></li>`).join('')}</ol></div>`
}

// what moves by script in the scenes under root: the code types itself, the presenter's clock runs
export function liven(root, own) {
  for (const pre of root.querySelectorAll('.hw-code:not([data-on])')) { pre.dataset.on = 1; typeOut(pre, own.code.text) }
  for (const c of root.querySelectorAll('.hw-present .time:not([data-on])')) {
    c.dataset.on = 1
    let s = 0
    const t = setInterval(() => { if (!c.isConnected) return clearInterval(t); if (c.closest('.dormant') || !c.offsetParent) return; s++; c.textContent = String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0') }, 1000)
  }
}
