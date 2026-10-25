// About: a profile page in the manner of the Windows 11 Settings profile block and a card column (references:
// film/ref/ui/board/settings/01-windows11-settings-home.png for the round picture, name and line; board/profile/ for
// the column of cards). His picture is his own photo, the one on the room's wall (common.js FACE).
// Every word is his own, from DATA.profile and DATA.record (apps/gen/data.js); nothing is added.
import { el } from '../config.js'
import { line } from '../icons.js'
import { esc, out, host, FACE } from './common.js'

export function mount(box) {
  const D = window.DATA, P = D.profile, L = P.links, w = D.record.find((r) => r.id === 'medium')
  const tags = (a) => `<ul class="ab-tags">${a.map((t, i) => `<li style="--i:${i}">${esc(t)}</li>`).join('')}</ul>`
  const row = (pic, name, sub, href) => `<a class="ab-row"${out(href)}>${PIX(pic, 32)}<span><b>${esc(name)}</b><i>${esc(sub)}</i></span>${line(/^mailto:/.test(href) ? 'chevR' : 'go', 16)}</a>`
  const root = box.appendChild(el('div', 'ab'))
  root.tabIndex = 0
  root.innerHTML = `<div class="ab-page"><header class="ab-id"><span class="ab-face" aria-hidden="true">${FACE}</span><div><h1>${esc(P.name)}</h1><p>${esc(P.role)} · ${esc(P.location)}</p></div>` +
    `<a class="wbtn accent" href="mailto:${esc(L.email)}">${line('mail', 16)}Email</a></header>` +
    `<div class="ab-grid"><section class="ab-card wide"><h2>About</h2><p class="lead">${esc(P.headline)}</p><p>${esc(P.summary)}</p></section>` +
    `<section class="ab-card"><h2>Interests</h2>${tags(P.interests)}</section><section class="ab-card"><h2>Values</h2>${tags(P.values)}</section>` +
    `<section class="ab-card wide"><h2>Tools</h2>${tags(P.tools)}</section>` +
    `<section class="ab-card wide rows"><h2>Find him</h2>${row('contact', 'Email', L.email, 'mailto:' + L.email)}${row('github', 'GitHub', host(L.github), L.github)}${row('linkedin', 'LinkedIn', host(L.linkedin), L.linkedin)}` +
    `${row('medium', 'Medium', host(L.medium), L.medium)}${w ? row('writing', w.project, w.summary, w.href) : ''}</section></div>` +
    `<p class="ab-note">${esc(P.privacyNote)}</p></div>`
  return { title: 'About', show() {}, focus() { root.focus({ preventScroll: true }) } }
}
