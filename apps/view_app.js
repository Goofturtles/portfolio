'use strict'
// The whole app as the tablet and the laptop show it: title bar, the workspace sidebar, the page, the taskbar.
// Drawn for a 2400x1600 screen (3:2, the device in the film). Proportions are read off loop.mp4 frame 300, where
// the screen fills the frame; the page inside is the same document as P4 at 1.103x.
//   ?view=tablet-light   P2 daylight (frames 307-326; drawn from 312): light app, the page creeping up from the three cards to "Films"
//   ?view=tablet-dark    P2 blue-and-pink (frames 396-417): dark app on the image grid and "How I work"
//   ?view=laptop-dark    P5 (frames 1176-1221): dark app as a window over the desktop, on "How I work" and "Results"
//   ?view=tablet-mail | tablet-start | tablet-chat   stand-ins for the three other screens P2 passes through
// &s=<y_c> overrides the scroll (y_c of the first visible line, see doc.js).
const APP = { W: 2400, H: 1600, TASK: 71, TB: 71, SIDE: 487, TOOL: 73, K: 1.103, COLX: 430 }

// sidebar tree: the reference's rows and indents, his pages. [level, chevron, picture (a PIC id in kit.js), label, flags]
// Every row has a picture that says what it is: a place has the taskbar's picture for that place, a project its own.
const TREE = () => [
  [0, 'r', 'results', 'Results'],
  [0, 'd', 'films', 'Films'],
  [2, '', 'before-i-tell', proj('before-i-tell').title],
  [0, 'd', 'projects', 'Projects'],
  [1, 'd', 'portfolio', 'Portfolio', 'sel'],
  [2, '', 'second-look', proj('second-look').title],
  [2, '', 'ghostbus', proj('ghostbus').title],
  [2, '', 'shade-route', proj('shade-route').title],
  [2, '', 'owed', proj('owed').title],
  [1, 'd', 'design', 'Design'],
  [2, '', 'folio', proj('folio').title],
  [2, '', 'aeris', proj('aeris').title],
  [1, 'd', 'build', 'Build'],
  [2, '', 'mem', proj('mem').title],
  [0, 'r', 'how', 'How I work'],
  [0, '', 'second-reader', proj('second-reader').title, 'av'],
  [0, 'd', 'writing', 'Writing'],
  [2, '', 'medium', 'Medium'],
]
const LVX = [[39, 71, 100], [73, 107, 134], [0, 141, 174]]   // chevron, icon, text x by level

function buildApp(parent, theme, H) {
  const app = h('div', 'app ' + theme, parent)
  app.style.width = APP.W + 'px'; app.style.height = H + 'px'
  h('div', 'a-tbar', app, `${PIX('app', 20)}<b>${esc(D.profile.name)}</b><span class="wb">${I('min', 14, '', 'Minimise', 'br')}${I('max', 14, '', 'Maximise', 'br')}${I('close', 15, '', 'Close', 'br')}</span>`)
  const side = h('div', 'a-side', app, `<b class="ws">${esc(D.profile.name.split(' ')[0])}'s Portfolio</b>`)
  TREE().forEach(([lv, chev, pic, label, flag], i) => {
    const x = LVX[lv], row = h('div', 'a-row' + (flag === 'sel' ? ' sel' : ''), side)
    row.style.top = (111 - 27 + i * 67) + 'px'
    // the picture sits in the same 26 px box as before; a service's mark keeps the old tile's 22 px
    row.innerHTML = (chev ? `<span class="ch" style="left:${x[0] - 8}px">${I(chev === 'd' ? 'chev' : 'chevR', 16)}</span>` : '') +
      `<span class="ri" style="left:${x[1] - 13}px">${PIX(pic, BRANDS[pic] ? 22 : 26)}</span><b style="left:${x[2]}px">${esc(label)}</b>` +
      (flag === 'sel' ? `<span class="rav">${AV('J', 'var(--a1)', 24)}${AV('U', 'var(--a3)', 24)}<i>+8</i></span>` : flag === 'av' ? `<span class="rav">${AV('A', 'var(--a5)', 26)}</span>` : '')
  })
  h('div', 'a-seg', side, `<span class="on">${I('pages', 24, '', 'Pages', 't')}</span><span>${I('pulse', 24, '', 'Recent activity', 't')}</span>`)
  const tool = h('div', 'a-tool', app, `<span class="pg">${EM.hearts(31)}<b>Portfolio</b>${I('chev', 17)}</span><span class="live">Live</span>` +
    `<span class="avs">${[['A', 4, 1], ['R', 6, 2], ['J', 1, 3], ['U', 2, 4], ['N', 3, 5], ['S', 5, 6], ['H', 4, 2]].map(([c, a, r]) => AV(c, `var(--a${a})`, 34, `var(--r${r})`)).join('')}</span><span class="more">+2</span><span class="cm">${I('comment', 28, '', 'Comments', 'br')}</span>`)
  const content = h('div', 'a-content', app)
  const cover = h('div', 'a-cover', content, '<i></i><i></i><i></i><i></i><i></i>')
  const col = h('div', 'a-col', content)
  const R = buildDoc(col)
  const icon = h('div', 'a-icon', content, EM.hearts(120))
  h('div', 'a-sbar', content, '<i></i>')
  return {
    el: app, R,
    // top = y_c of the first line under the toolbar
    setTop(top) {
      const K = APP.K
      col.style.transform = `translate(${APP.COLX}px,${((-DOC.OY - top) * K).toFixed(2)}px) scale(${K})`
      cover.style.transform = `translateY(${((-839 - top) * K).toFixed(2)}px)`
      icon.style.transform = `translate(${(APP.COLX - 38 * K - 66).toFixed(1)}px,${((-447.5 - top) * K - 66).toFixed(2)}px)`
      content.querySelector('.a-sbar i').style.transform = `translateY(${clamp((top + 839) * 0.2, 0, 900).toFixed(1)}px)`
    },
  }
}
// the taskbar: fifteen slots, as the reference has (frame 300: fourteen pinned apps, then the open one, underlined).
// Ours: the fourteen places film/SPEC.md fixes, in its order, then this app. [picture, name, where it goes]
// Each is a real link with a picture and its name (aria-label, title, and the drawn label on hover). The links to
// outside services are the ones in profile.js; YouTube is his channel (he gave the address on 2026-10-09).
const TASKBAR = () => [
  ['home', 'Home', '#home'], ['ai', 'Search: ask AI Arjun', '#ai-arjun'], ['projects', 'Projects', '#projects'], ['films', 'Films', '#films'],
  ['how', 'How I work', '#how-i-work'], ['results', 'Results', '#results'], ['about', 'About', '#about'], ['contact', 'Contact', '#contact'],
  ['github', 'GitHub', D.profile.links.github], ['linkedin', 'LinkedIn', D.profile.links.linkedin], ['medium', 'Medium', D.profile.links.medium], ['youtube', 'YouTube', 'https://www.youtube.com/@AER-S'],
  ['themes', 'Themes', '#themes'], ['sound', 'Sound', '#sound'], ['app', D.profile.name + ': Portfolio (open)', '#portfolio'],
]
function taskbar(parent, theme) {
  const slots = TASKBAR()
  return h('div', 'taskbar ' + theme, parent, `<span class="tiles">${slots.map(([pic, name, href], i) => {
    const on = i === slots.length - 1, out = /^https?:/.test(href)
    return `<a class="tk${on ? ' on' : ''}" data-ico="${pic}" href="${esc(href)}"${out ? ' target="_blank" rel="noopener"' : ''}${on ? ' aria-current="page"' : ''}${NAME(name)}>${PIX(pic, 36, 42)}${TIP(name, 't')}</a>`
  }).join('')}</span>` +
    `<span class="tray">${I('chev', 18, 'up', 'Show hidden icons', false)}${I('wifi', 22, '', 'Network', 't')}${I('sound', 22, '', 'Volume', 't')}${I('batt', 26, '', 'Battery', 't')}<span class="clock"><b>11:11 AM</b><b>10/9/2026</b></span></span>`)
}
const wallpaper = (parent, theme) => h('div', 'wall ' + theme, parent, '<i></i><i></i><i></i><i></i><i></i><i></i>')

function appView(name, theme, opts) {
  view(name, {
    w: APP.W, h: APP.H, f0: opts.f0, dur: opts.dur, rest: opts.rest,
    build(st) {
      st.classList.add(theme)
      let app
      if (opts.floating) {
        wallpaper(st, theme)
        const box = A(st, 'floatwin', '', 293, 234, 1821, 1091)
        app = buildApp(box, theme, 1437)
        app.el.style.transform = 'scale(0.75875)'; app.el.style.transformOrigin = '0 0'
      } else app = buildApp(st, theme, APP.H - APP.TASK)
      if (opts.done) app.el.classList.add('done')
      taskbar(st, theme)
      setSupport(app.R, 1, 9, 1)
      const fixed = QS.get('s') != null ? parseFloat(QS.get('s')) : null
      return (t) => app.setTop(fixed != null ? fixed : opts.top(opts.f0 + t * FPS))
    },
  })
}
// P2 daylight: at 314 the intro's last lines are under the toolbar and "Films" is at the bottom; by 322 the grid's
// first row is in. About 12 px of page a frame.
appView('tablet-light', 'light', { f0: 312, dur: 15 / FPS, rest: 4 / FPS, top: (f) => -300 + (f - 312) * 12 })
// P2 blue-and-pink: "Films" a quarter of the way down, the grid, "How I work" at the bottom; a slow creep
appView('tablet-dark', 'dark', { f0: 396, dur: 22 / FPS, rest: 8 / FPS, top: (f) => 566 + (f - 396) * 1.5 })
// P5: the app as a window over the desktop, the steps table in the middle, "Results" below it
appView('laptop-dark', 'dark', { f0: 1176, dur: 46 / FPS, rest: 14 / FPS, floating: true, done: true, top: () => 1342 })

// ---- the three screens P2 passes through between the two (reference: a mail app, a start menu, a chat app).
// Neutral stand-ins of the same layout and brightness, filled from his data. No product is imitated.
function standIn(name, theme, build) {
  view(name, { w: APP.W, h: APP.H, dur: 1, rest: 0, build(st) { st.classList.add(theme); wallpaper(st, theme); build(st); taskbar(st, theme); return () => {} } })
}
const lines = (n, w) => Array.from({ length: n }, (_, i) => `<u style="width:${w[i % w.length]}%"></u>`).join('')
standIn('tablet-mail', 'light', (st) => {
  const win = A(st, 'swin light', '', 330, 190, 1620, 1190)
  h('div', 'sw-top', win, `${PIX('contact', 22, 26)}<span class="srch">${I('search', 20)}<b>Search</b></span>${AV('A', 'var(--a1)', 34)}`)
  h('div', 'sw-rib', win, `<b>Home</b><b>View</b><b>Help</b>${lines(9, [5, 4, 6, 3])}`)
  const left = h('div', 'sw-nav', win, `<b>Favourites</b>${['Projects', 'Films', 'Results', 'How I work', 'Writing', 'About'].map((s) => `<i>${s}</i>`).join('')}<b>${esc(D.profile.name.split(' ')[0])}'s Portfolio</b>${lines(8, [52, 40, 61, 46, 35])}`)
  const list = h('div', 'sw-list', win, `<b class="hd">Projects</b>` + D.projects.slice(0, 8).map((p, i) => `<div class="msg${i === 0 ? ' on' : ''}"><b>${esc(p.title)}</b><i>${esc(p.meta)}</i><u>${esc(p.description)}</u></div>`).join(''))
  const p = proj('ghostbus')
  h('div', 'sw-read', win, `<h3>${esc(p.title)}</h3><div class="from">${AV('A', 'var(--a1)', 46)}<span><b>${esc(D.profile.name)}</b><i>${esc(p.meta)}</i></span></div><p>${esc(p.description)}</p>` +
    `<div class="strip">${['ghostbus', 'lifetime-fire', 'shade-route-dusk', 'folio'].map((s) => `<span class="tile-img"><img src="${D.stills[s]}" alt=""></span>`).join('')}</div><p>${esc(D.profile.summary)}</p>`)
  void left; void list
})
standIn('tablet-start', 'light', (st) => {
  const win = A(st, 'smenu', '', 760, 330, 880, 1060)
  // [picture, name]: his projects, then his places, each with the picture it has everywhere else
  const apps = D.projects.map((p) => [p.id, p.title]).concat([['ai', 'AI Arjun'], ['results', 'Results'], ['films', 'Films'], ['how', 'How I work'], ['writing', 'Writing'], ['about', 'About'], ['contact', 'Contact']])
  h('div', 'sm-search', win, `${I('search', 22)}<b>Type here to search</b>`)
  h('div', 'sm-h', win, `<b>Pinned</b><span class="pill">All ${I('chevR', 12)}</span>`)
  h('div', 'sm-grid', win, apps.slice(0, 18).map(([pic, n]) => `<span>${PIX(pic, 46)}<i>${esc(n)}</i></span>`).join(''))
  h('div', 'sm-h', win, `<b>Recommended</b><span class="pill">More ${I('chevR', 12)}</span>`)
  h('div', 'sm-rec', win, D.record.slice(0, 6).map((r) => `<span>${PIX(r.id, 40)}<span><b>${esc(r.title)}</b><i>${esc(r.summary)}</i></span></span>`).join(''))
  h('div', 'sm-foot', win, `${AV('A', 'var(--a1)', 40)}<b>${esc(D.profile.name)}</b>`)
})
standIn('tablet-chat', 'dark', (st) => {
  const win = A(st, 'swin dark chat', '', 290, 150, 1700, 1210)
  h('div', 'sw-top', win, `${PIX('chat', 22, 26)}<span class="srch">${I('search', 20)}<b>Search</b></span>${AV('A', 'var(--a1)', 34)}`)
  h('div', 'ch-rail', win, `${I('pulse', 30, '', 'Activity', 'r')}${I('comment', 30, '', 'Chat', 'r')}${I('cal', 30, '', 'Calendar', 'r')}${I('person', 30, '', 'People', 'r')}`)
  h('div', 'ch-list', win, `<b class="hd">Chat</b>` + D.projects.slice(0, 11).map((p, i) => `<div class="msg${i === 5 ? ' on' : ''}">${AV(p.title[0].toUpperCase(), `var(--a${(i % 6) + 1})`, 40)}<span><b>${esc(p.title)}</b><i>${esc(p.tags.join(' · '))}</i></span></div>`).join(''))
  const p = proj('shade-route')
  h('div', 'ch-main', win, `<div class="ch-head">${AV('J', 'var(--a4)', 40)}<b>Judge</b><i>Chat</i><i>Files</i></div>` +
    `<div class="bub me">${esc(p.description)}</div><div class="bub me">${esc(p.meta)}</div>` +
    `<div class="bub">${AV('J', 'var(--a4)', 34)}<span><i>Judge</i>Thank you for always being so positive!</span></div>` +
    `<div class="bub pics">${['ghostbus', 'lifetime-fire', 'shade-route-dusk', 'folio', 'shade-route', 'owed', 'before-i-tell', 'second-reader', 'ghostbus', 'folio'].map((s) => `<span class="tile-img"><img src="${D.stills[s]}" alt=""></span>`).join('')}</div>` +
    `<div class="ch-in"><b>Type a new message</b></div>`)
})
