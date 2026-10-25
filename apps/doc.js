'use strict'
// The document that every screen in the film shows: the reference's "Project Overview" page, block for block,
// with Arjun's words (film/SPEC.md table). One column, 962 px wide, measured from loop.mp4:
//   x: column-local (0 = left edge of the cards and panels = screen x 487 in frame 692)
//   y: "y_c" = distance below the top of the window's content area in the settled frame 692, + DOC.OY
// Reference numbers are in film/research/ui_inventory.md. Text comes from gen/data.js, never typed here,
// except the generic interface words the reference itself shows (reaction chips, "Add a step", column heads).
const DOC = { W: 962, OY: 900, H: 3900 }
const D = window.DATA
const proj = (id) => D.projects.find((p) => p.id === id)
const recd = (id) => D.record.find((r) => r.id === id)

// baseline-positioned text: Segoe UI's baseline sits L/2 + 0.414 F below the top of a line box
const BL = (F, L) => L / 2 + 0.414 * F
function TXT(p, cls, html, x, base, F, L, w) {
  const e = A(p, 'tx ' + cls, html, x, DOC.OY + base - BL(F, L), w)
  e.style.fontSize = F + 'px'; e.style.lineHeight = L + 'px'
  return e
}
// a reaction chip: avatar, words, emoji
const CHIP = (av, text, emo, cls) => `<span class="chip ${cls || ''}">${av || ''}${text ? `<b>${text}</b>` : ''}${emo || ''}</span>`
const ADD = () => `<span class="chip add">${I('react', 21, '', 'Add a reaction', 't')}</span>`
const EM = {
  rainbow: (z) => EMO('🌈', 'rainbow', z), fireheart: (z) => EMO('❤️‍🔥', 'heart_on_fire', z), star: (z) => EMO('🤩', 'star-struck', z),
  up: (z) => EMO('☝🏿', 'index_pointing_up', z), hundred: (z) => EMO('💯', 'hundred_points', z), fire: (z) => EMO('🔥', 'fire', z),
  hearts: (z) => EMO('🥰', 'smiling_face_with_hearts', z), hand: (z) => EMO('🙋🏽‍♀️', 'person_raising_hand', z),
  eyes: (z) => EMO('😍', 'smiling_face_with_heart-eyes', z), sparkle: (z) => EMO('💖', 'sparkling_heart', z),
}
const av = (i, n, z) => AV(i, `var(--a${n})`, z || 21)

// The Films grid: the reference's five tiles, same boxes (column-local x, y_c), our stills.
const GRID = [
  ['ghostbus', 15, 931, 298, 157, '50% 40%'],
  ['lifetime-fire', 15, 1105, 298, 274, '50% 50%'],
  ['shade-route-dusk', 328, 931, 302, 207, '60% 70%'],
  ['folio', 328, 1155, 302, 225, '62% 30%'],
  ['shade-route', 646, 932, 300, 447, '42% 60%'],
]
// The three file cards at the top: [project (its title, its still, its picture), how the still sits in the preview]
const FILES = [['owed', '46% 44% / 150%'], ['before-i-tell', '82% 42% / 190%'], ['second-reader', '22% 20% / 150%']]
// The numbered list: SPEC order. Each line is the project's own title and description.
const LIST = ['second-look', 'ghostbus', 'shade-route', 'owed']
// y_c of each item's first baseline and of the chip row under it (reference: items of 2, 3, 3, 3 lines).
// Ours run 3, 2, 3, 3 lines (SECOND LOOK's description is longer than "Why Storytelling Matters"), so item 2
// starts one line lower and the first chip row sits one line lower. Everything after item 2 is in place.
const LINE = 28.5
const ITEMS = [
  { base: 249.5, chips: 296 + LINE },
  { base: 368.5 + LINE, chips: null },
  { base: 473, chips: 552.5 },
  { base: 620, chips: 700.5 },
]

function buildDoc(parent) {
  const d = h('div', 'doc', parent)
  d.style.width = DOC.W + 'px'; d.style.height = DOC.H + 'px'
  const R = {}   // handles the views animate

  // ---- top of the page (seen on the tablet and the laptop, above the P4 window's first frame) ----
  TXT(d, 'h1', 'Portfolio', -5, -302.6, 51, 60)
  TXT(d, 'intro', esc(D.profile.summary) + ' ' + esc(D.profile.headline), -2, -224, 20, 28, 950)

  // ---- three file cards --------------------------------------------------------------------------
  FILES.forEach(([id, fit], i) => {
    const p = proj(id), x = [0, 316, 633][i]
    A(d, 'file', `<div class="ft">${PIX(id, 18, 22)}<b>${esc(p.title)}</b></div><div class="fp"><i style="background:url(${D.stills[id]}) ${fit}"></i></div>`, x, DOC.OY - 106, i === 2 ? 295 : 294, 160)
  })

  // ---- Projects (reference: "Marketing Ideas") ----------------------------------------------------
  TXT(d, 'h2', 'Projects', 1, 176, 39, 48)
  LIST.forEach((id, i) => {
    const p = proj(id), it = ITEMS[i]
    TXT(d, 'num', (i + 1) + '.', 0, it.base, 17.5, LINE, 33)
    TXT(d, 'li', `${esc(p.title)}. ${esc(p.description)}`, 44.5, it.base, 20, LINE, 866)
  })
  // reaction chips: the reference's own words, in the reference's places
  R.row1 = A(d, 'chips', CHIP(av('Y', 2), 'This one gets my vote', EM.rainbow()) + CHIP(av('J', 3), 'Yesss', EM.fireheart()) + CHIP(av('V', 6), 'Love this', EM.star()) + ADD(), 40, DOC.OY + ITEMS[0].chips)
  R.row3 = A(d, 'chips', CHIP(av('J', 2), 'This is the one!!', EM.up()) + CHIP(av('V', 4), 'Agreed', EM.hundred()) + CHIP(av('Y', 1), '+1', EM.fire() + EM.fire() + EM.fire() + EM.fire()) + ADD(), 43, DOC.OY + ITEMS[2].chips)
  R.row4 = A(d, 'chips', CHIP(av('V', 3), 'This one pls', EM.hearts()) + `<span class="chip grow">${av('J', 4)}<b><span class="typed"></span></b><span class="tail">${EM.hand()}</span></span>` + ADD(), 45, DOC.OY + ITEMS[3].chips)
  R.support = R.row4.querySelector('.grow'); R.supportText = R.support.querySelector('.typed'); R.supportTail = R.support.querySelector('.tail'); R.supportAv = R.support.querySelector('.av')

  // ---- Films (reference: "Concepts") -------------------------------------------------------------
  TXT(d, 'h2', 'Films', 0, 834, 39, 48)
  const panel = A(d, 'panel', '', 0, DOC.OY + 875, 962, 514)
  h('div', 'ph', panel, `${I('image', 22)}<b>Project stills</b><span class="btn">${I('plus', 13)}Add images</span>`)
  GRID.forEach(([id, x, y, w, hh, pos]) => { const t = A(d, 'tile-img', `<img src="${D.stills[id]}" alt="" style="object-position:${pos}">`, x, DOC.OY + y, w, hh); t.dataset.id = id })
  A(d, 'chips big', CHIP(av('Y', 5, 22), '', EM.eyes(21) + EM.eyes(21) + EM.eyes(21) + EM.eyes(21)) + ADD(), -1, DOC.OY + 1406)

  // ---- How I work (reference: "Task List") -------------------------------------------------------
  TXT(d, 'h2', 'How I work', 0, 1567, 39, 48)
  const T0 = 1606, HEAD = 59, ROW = 65.2, ADDH = 51
  const tb = A(d, 'table', '', 0, DOC.OY + T0, 962, HEAD + ROW * D.steps.length + ADDH)
  h('div', 'tr th', tb, `<span class="c1">${I('check', 21)}<b>Steps</b></span><span class="c2">${I('person', 20)}<b>Assigned to</b></span><span class="c3">${I('cal', 20)}<b>Order</b></span><span class="c4">${I('status', 20)}<b>Status</b></span>`).style.height = HEAD + 'px'
  D.steps.forEach((s, i) => {
    // .done (P5: every row ticked, struck through, "Done") swaps the circle for a tick and the status word
    h('div', 'tr', tb, `<span class="c1">${I('circle', 21, 'todo')}${I('check', 21, 'did')}<span class="nm"><b>${esc(s.name)}</b><i>${esc(s.line)}</i></span></span>` +
      `<span class="c2"><span class="pill">${AV('A', 'var(--a1)', 20)}Arjun</span></span>` +
      `<span class="c3"><span class="pill">${I('cal', 16)}Step ${i + 1} of ${D.steps.length}</span></span>` +
      `<span class="c4"><span class="pill"><u style="--f:var(--s${i + 1})"></u><em class="st-a">Every build</em><em class="st-b">Done</em></span></span>`).style.height = ROW + 'px'
  })
  h('div', 'tr addrow', tb, `<span class="c1">${I('plus', 16)}<b>Add a step</b></span>`).style.height = ADDH + 'px'
  const TB = T0 + HEAD + ROW * D.steps.length + ADDH   // table bottom, y_c

  // ---- Results (reference: "Sales Analysis" and its record card) ----------------------------------
  const RH = TB + 104
  TXT(d, 'h2 tint', 'Results', 0, RH, 39, 48)
  A(d, 'hdone', `<span class="pill"><u style="--f:var(--good)"></u>Done</span>`, 870, DOC.OY + RH - 26)   // P5 only
  R.card = A(d, 'rcard', resultsCardHTML(), 0, DOC.OY + RH + 39, 962, 520)
  R.cardTop = RH + 39

  // ---- About (reference: "Our Team Goals") -------------------------------------------------------
  const AH = RH + 39 + 520 + 112
  TXT(d, 'h2 tint', 'About', 0, AH, 39, 48)
  TXT(d, 'li', `${esc(D.profile.name)}, ${esc(D.profile.role.toLowerCase())}, ${esc(D.profile.location)}. Interests: ${esc(D.profile.interests.join(', '))}. Values: ${esc(D.profile.values.join(', '))}.`, 0, AH + 62, 20, LINE, 950)
  DOC.H = DOC.OY + AH + 260
  d.style.height = DOC.H + 'px'
  R.el = d
  return R
}

// The Results card (reference: the record card with a header strip, a title row with four fields, a panel of
// five label/value rows and a score panel). Every word is from TrackRecordRow.jsx.
function resultsCardHTML() {
  const f = (id, link) => { const r = recd(id); return `<span class="fld"><b${link ? ' class="lk"' : ''}>${esc(r.tag)}</b><i>${esc(r.title)}</i></span>` }
  const row = (id, value, link) => `<div class="kv"><i>${esc(recd(id).title)}</i><b${link ? ' class="lk"' : ''}>${esc(value)}</b></div>`
  const bullet = (id) => { const r = recd(id); return `<div class="bl"><u></u>${esc(r.summary)} · ${esc(r.title)}</div>` }
  const results = D.record.filter((r) => r.id !== 'medium')
  return `<div class="rhead">${PIX('results', 20, 24)}${I('chev', 12)}<b>Track record</b><span class="avs">${AV('A', 'var(--a1)', 22)}${AV('R', 'var(--a3)', 22)}${AV('J', 'var(--a6)', 22)}${AV('U', 'var(--a4)', 22)}</span></div>` +
    `<div class="rtitle"><span class="who"><b>${esc(D.profile.name)}</b><i>Results</i></span>${f('peddiehacks')}${f('oregonhacks')}${f('rlchacks')}${f('tks', true)}</div>` +
    `<div class="rpanels"><div class="rleft">${row('peddiehacks', recd('peddiehacks').project, true)}${row('oregonhacks', recd('oregonhacks').project, true)}${row('rlchacks', recd('rlchacks').project)}${row('samsung', recd('samsung').summary)}${row('rise', recd('rise').summary)}</div>` +
    `<div class="rright"><div class="rs">Results so far ${I('info', 15)}<span class="dots">···</span></div><div class="big"><b>${results.length}</b><span><b>Results</b><i>so far</i></span></div>${bullet('samsung')}${bullet('rise')}${bullet('tks')}${bullet('peddiehacks')}</div></div>`
}

// "I support" arrives letter by letter (reference frames 683 to 697). k = 0..1 pop of the chip, n = letters shown, e = 0..1 emoji
function setSupport(R, k, n, e) {
  const full = 'I support'
  R.support.style.display = k <= 0 ? 'none' : ''
  R.support.style.opacity = clamp(k * 2)
  R.supportAv.style.transform = `scale(${mix(0.3, 1, E.back(clamp(k)))})`
  R.supportText.textContent = full.slice(0, n)
  R.supportTail.style.display = e > 0 ? '' : 'none'
  R.supportTail.style.opacity = clamp(e * 1.5)
  R.supportTail.style.transform = `scale(${mix(0.4, 1, E.back(clamp(e)))})`
  R.support.classList.toggle('bare', n === 0)
}
