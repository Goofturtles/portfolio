// Portfolio: the overview in one document. It was film/ui's P4 window (apps/view_window.js, apps/doc.js), laid out to
// the film's frame at 1535 px and shown shrunk to fit the window, with the film's mosaic of stills in mixed sizes and
// crops, its purple button and its type off the Windows ramp; Arjun: "this feels very rough fix it so its cleaner".
// So the site lays the same document out itself, at the window's own size (css/apps.css "Portfolio"):
//   a Fluent command bar on the window's mica: the page's name, its sections as subtle buttons, "All 14 projects" as a
//   standard button; under it one opaque reading layer that scrolls, with room at its foot so nothing is cut by the
//   window's edge: the title and his line, Projects (the film's four, as rows), Films (the six projects with a launch
//   film, one still each, in an even grid at the stills' own shape, each with where it was made or what it won), How I work (the five steps as a table), Results,
//   About. Every word comes from DATA. A project row asks AI Arjun about it, a film plays in Films, a result opens
//   Results, and "All 14 projects" opens the Projects folder.
import { el, reduced } from '../config.js'
import { line } from '../icons.js'
import { esc, film, stillsOf } from './common.js'

const FOUR = ['second-look', 'ghostbus', 'shade-route', 'owed']      // the film's four projects (apps/doc.js LIST)
const HEADS = [['projects', 'Projects'], ['films', 'Films'], ['how', 'How I work'], ['results', 'Results'], ['about', 'About']]

export function mount(box, ctx) {
  const D = window.DATA, P = D.profile, proj = (id) => D.projects.find((p) => p.id === id)
  const films = D.projects.filter((p) => film(p) && stillsOf(p)[0] && stillsOf(p)[0] !== p.visual).slice(0, 6)      // a real still of its own, never a stand-in picture
  const size = (src) => (window.PICTURE_SIZES || {})[src]
  const link = (attrs) => `role="link" tabindex="0" ${attrs}`
  const sec = (id, name, html) => `<section class="pd-sec" data-sec="${id}" aria-label="${name}"><h2>${name}</h2>${html}</section>`

  const projects = `<ol class="pd-card pd-list">${FOUR.map(proj).filter(Boolean).map((p, i) => `<li class="pd-row" ${link(`data-ask="${esc('What is ' + p.title + '?')}"`)}>` +
    `<span class="pd-n">${i + 1}</span><span class="pd-t"><b>${esc(p.title)}</b><span>${esc(p.description)}</span></span>${line('chevR', 16)}</li>`).join('')}</ol>`

  const grid = `<ul class="pd-grid">${films.map((p) => {
    const src = stillsOf(p)[0], z = size(src)
    return `<li class="pd-film" ${link(`data-go="films" data-id="${esc(p.id)}" aria-label="${esc(p.title + ': ' + film(p).label)}"`)}>` +
      `<img src="${esc(src)}" alt=""${z ? ` width="${z[0]}" height="${z[1]}"` : ''} decoding="async"><span><b>${esc(p.title)}</b><i>${esc(p.meta.split(' · ').pop())}</i></span></li>`
  }).join('')}</ul>`

  const steps = D.steps.length
  const table = `<div class="pd-card pd-table" role="table" aria-label="How I work"><div class="pd-tr pd-th" role="row">` +
    ['Step', 'Assigned to', 'Order', 'Status'].map((t) => `<span role="columnheader">${t}</span>`).join('') + `</div>` +
    D.steps.map((s, i) => `<div class="pd-tr" role="row"><span class="pd-step" role="cell">${line('circle', 16)}<span><b>${esc(s.name)}</b><i>${esc(s.line)}</i></span></span>` +
      `<span role="cell">${AV(P.name[0], 'var(--a1)', 20)}${esc(P.name.split(' ')[0])}</span><span role="cell">Step ${i + 1} of ${steps}</span>` +
      `<span role="cell"><u class="pd-dot" style="--f:var(--s${i + 1})"></u>Every build</span></div>`).join('') + `</div>`

  const results = `<ul class="pd-card pd-list">${D.record.filter((r) => r.id !== 'medium').map((r) => `<li class="pd-res" ${link('data-go="results"')}>` +
    `<span class="pd-t"><b>${esc(r.title)}</b><span>${esc(r.summary)}${r.project ? ' · ' + esc(r.project) : ''}</span></span><span class="pd-tag">${esc(r.tag)}</span></li>`).join('')}</ul>`

  const about = `<dl class="pd-card pd-about"><dt>Who</dt><dd>${esc(P.name)}, ${esc(P.role.toLowerCase())}, ${esc(P.location)}</dd>` +
    `<dt>Interests</dt><dd>${esc(P.interests.join(', '))}</dd><dt>Values</dt><dd>${esc(P.values.join(', '))}</dd></dl>`

  const root = box.appendChild(el('div', 'pd'))
  root.innerHTML = `<div class="pd-bar"><span class="pd-page">${window.EMO('🥰', 'smiling_face_with_hearts', 20)}<b>Portfolio</b></span>` +
    `<nav class="pd-jump" aria-label="Sections">${HEADS.map(([id, n]) => `<button type="button" data-to="${id}">${n}</button>`).join('')}</nav>` +
    `<button type="button" class="wbtn pd-all" data-go="projects">${line('folder', 16)}All ${D.projects.length} projects</button></div>` +
    `<div class="pd-body" tabindex="0" aria-label="Portfolio"><article class="pd-doc"><header class="pd-head"><h1>Portfolio</h1><p>${esc(P.summary)} ${esc(P.headline)}</p></header>` +
    sec('projects', 'Projects', projects) + sec('films', 'Films', grid) + sec('how', 'How I work', table) + sec('results', 'Results', results) + sec('about', 'About', about) +
    `</article></div>`

  const body = root.querySelector('.pd-body')
  const to = (id) => { const s = root.querySelector(`.pd-sec[data-sec="${id}"]`); if (s) body.scrollTo({ top: s.offsetTop - 24, behavior: reduced() ? 'auto' : 'smooth' }) }
  const go = (e) => {
    const n = e.target.closest('[data-to], [data-go], [data-ask]')
    if (!n || (e.type === 'keydown' && (e.key !== 'Enter' || n.tagName === 'BUTTON'))) return      // a button's own Enter is already a click
    if (e.type === 'keydown') e.preventDefault()
    if (n.dataset.to) to(n.dataset.to)
    else if (n.dataset.ask) ctx.act('ai', n.dataset.ask)
    else ctx.act(n.dataset.go, n.dataset.id)
  }
  root.addEventListener('click', go); root.addEventListener('keydown', go)
  return {
    show: (name) => { const h = HEADS.find(([id, n]) => n === name || id === name); if (h) to(h[0]) },
    focus: (o) => body.focus(o),
  }
}
