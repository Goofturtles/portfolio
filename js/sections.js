// Arjun's content as plain, semantic sections: the phone's app, the small windows on the mini desktop, and plain.html.
// Every word comes from DATA (apps/gen/data.js, generated from his own data files). Links go through the lookup
// (AIARJUN.ask), so its rules hold here too: a project shows only the links in his notes, and AERIS never gets a video.
// Needs the globals DATA and AIARJUN (apps.all(), or the three script tags in plain.html).

export const SECTIONS = [['projects', 'Projects'], ['films', 'Films'], ['how', 'How I work'], ['results', 'Results'], ['about', 'About'], ['contact', 'Contact']]

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')
const out = (href) => ` href="${esc(href)}"` + (/^mailto:/.test(href) ? '' : ' target="_blank" rel="noopener"')
const list = (a) => a.map((t, i) => `<span class="tg" style="--i:${i}">${esc(t)}</span>`).join('')      // each its own chip; plain.html joins them with commas
// the lookup's own links for a project (absolute, filtered by its rules)
export function linksFor(p) {
  const r = window.AIARJUN.ask('What is ' + p.title + '?')
  return r.id === p.id ? r.links : []
}

// a launch film's own YouTube thumbnail (DATA.filmThumbs, saved in media/own/), or null
export function filmThumb(href) {
  const id = (String(href || '').match(/[?&]v=([\w-]{11})/) || [])[1]
  return (id && (window.DATA.filmThumbs || {})[id]) || null
}

const BODY = {
  projects: (D) => `<ul class="cards">${D.projects.map((p) => `<li class="card"><h3>${esc(p.title)}</h3><p class="meta">${esc(p.meta)}</p><p>${esc(p.description)}</p>` +
    `<p class="tags">${p.tags.map((t) => `<span>${esc(t)}</span>`).join('')}</p><p class="links">${linksFor(p).map((l) => `<a class="btn"${out(l.href)}>${esc(l.label)}</a>`).join('')}</p></li>`).join('')}</ul>`,

  films: (D, o) => `<ul class="films">${D.projects.map((p) => {
    const l = linksFor(p).find((k) => k.kind === 'video'); if (!l) return ''
    const pic = o.images && (filmThumb(l.href) || D.stills[p.id] || p.visual), size = (window.PICTURE_SIZES || {})[pic]
    return `<li><a class="film"${out(l.href)}>${pic ? `<img src="${esc(pic)}" alt="" loading="lazy" decoding="async"${size ? ` width="${size[0]}" height="${size[1]}"` : ''}>` : ''}<span><strong>${esc(p.title)}</strong><em>${esc(l.label)}</em></span></a></li>`
  }).join('')}</ul>`,

  how: (D) => `<ol class="steps">${D.steps.map((s) => `<li><strong>${esc(s.name)}</strong><span>${esc(s.line)}</span></li>`).join('')}</ol>`,

  results: (D) => `<ul class="rows">${D.record.filter((r) => r.id !== 'medium').map((r) => `<li><strong>${esc(r.title)}</strong><span>${esc(r.summary)}${r.project ? ' · ' + esc(r.project) : ''}</span>` +
    (r.href ? `<a class="btn"${out(r.href)}>${esc(r.cta)}</a>` : '') + `</li>`).join('')}</ul>`,

  about: (D) => {
    const P = D.profile, w = D.record.find((r) => r.id === 'medium')
    return `<p class="lead">${esc(P.headline)}</p><p>${esc(P.summary)}</p><dl class="about"><dt>Who</dt><dd>${esc(P.name)}, ${esc(P.role.toLowerCase())}</dd><dt>Where</dt><dd>${esc(P.location)}</dd>` +
      `<dt>Interests</dt><dd>${list(P.interests)}</dd><dt>Values</dt><dd>${list(P.values)}</dd><dt>Tools</dt><dd>${list(P.tools)}</dd>` +
      (w ? `<dt>Writing</dt><dd><a${out(w.href)}>${esc(w.project)}</a></dd>` : '') + `</dl>`
  },

  contact: (D) => {
    const L = D.profile.links
    return `<ul class="rows"><li><strong>Email</strong><span>${esc(L.email)}</span><a class="btn" href="mailto:${esc(L.email)}">Write to Arjun</a></li>` +
      [['GitHub', L.github], ['LinkedIn', L.linkedin], ['Medium', L.medium]].map(([n, h]) => `<li><strong>${n}</strong><span>${esc(h.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')).replace(/\//g, '/<wbr>')}</span><a class="btn"${out(h)}>Open ${n}</a></li>`).join('') +
      `</ul><p class="note">${esc(D.profile.privacyNote)}</p>`
  },
}

// one section. heading: false leaves the title out (a window already has it in its title bar); images: false is text only
export function sectionHTML(id, opts = {}) {
  const o = { heading: true, images: true, ...opts }, name = SECTIONS.find((s) => s[0] === id)[1]
  return `<section class="s" data-sec="${id}" aria-label="${name}">${o.heading ? `<h2>${name}</h2>` : ''}${BODY[id](window.DATA, o)}</section>`
}
