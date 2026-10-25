'use strict'
// Single layers for the 3D shots, each on a transparent ground (?bg=0) at its size on the 1920x1080 frame.
// Capture at --dsf 4 for texture resolution.   ?view=parts&id=<id>     (?view=parts&id=index lists them all)
//   P2  the chips and toasts that float over the tablet: chip-vote, chip-love, chip-yesss, chip-eyes, chip-amazing,
//       toast-mail, toast-chat1, toast-chat2; and the website's buttons in the same chip: nav-projects ... nav-ai
//   P3  the words on the fanned sheets: sheet-ideas, sheet-how, sheet-results, sheet-followups   (&ink=ffffff | 3b54d6)
//   P4  the tilt into the card: doc (the whole page), card, card-head, card-left, card-right, menu,
//       and the cursors and bubbles on their own: cursor-arjun, cursor-you, cursor-judge, cursor-visitor, bubble-y, bubble-j
const PID = QS.get('id') || 'index'
const INK = '#' + (QS.get('ink') || 'ffffff')

// P2 chips: white pills, 40 px tall on the frame (frame 320: "Love this" 186x39 at 946,233). Same words as the film.
const bigChip = (avatar, text, emo) => `<span class="pchip">${avatar}${text ? `<b>${text}</b>` : ''}${emo}</span>`
const toast = (pic, name, time, l1, l2, cls) => `<span class="ptoast ${cls}"><span class="ti">${PIX(pic, 22, 26)}<s></s></span><span class="tt"><b>${esc(name)}<i>${esc(time)}</i></b><em>${esc(l1)}</em>${l2 ? `<u>${esc(l2)}</u>` : ''}</span></span>`
const sheet = (title, head, rows) => `<div class="psheet" style="--ink:${INK}"><h2>${esc(title)}</h2><div class="pt"><div class="ptr ph">${head.map((c) => `<b>${esc(c)}</b>`).join('')}</div>` +
  rows.map((r) => `<div class="ptr"><i></i>${r.map((c) => (c == null ? '<u></u>' : `<span>${esc(c)}</span>`)).join('')}</div>`).join('') + `</div></div>`

const PARTS = {
  // ---- P2: the film's own reactions, in the film's chip ------------------------------------------
  'chip-vote': [330, 60, () => bigChip(AV('Y', 'var(--a2)', 30), 'This one gets my vote', EM.rainbow(28))],
  'chip-love': [200, 60, () => bigChip(AV('V', 'var(--a3)', 30), 'Love this', EM.star(28))],
  'chip-yesss': [150, 60, () => bigChip(AV('J', 'var(--a6)', 30), 'Yesss', EM.fireheart(28))],
  // frame 410: 191x40 and 181x42, the same chip as daylight
  'chip-eyes': [220, 60, () => bigChip(AV('Y', 'var(--a2)', 30), '', EM.eyes(28) + EM.eyes(28) + EM.eyes(28) + EM.eyes(28))],
  'chip-amazing': [200, 60, () => bigChip(AV('J', 'var(--a6)', 30), 'Amazing', EM.sparkle(28))],
  // the mail toast (frames 336-358, 374x61 at frame 346) and the two chat toasts (366-392, 225x49 and 268x48 at 378):
  // the app icon is a picture with a count dot (an envelope for mail, a speech balloon for chat, as in the film),
  // his name and words, the generic replies kept
  'toast-mail': [394, 81, () => toast('contact', D.profile.name, '11:11 AM', 'Portfolio', D.profile.summary, 'mail')],
  'toast-chat1': [245, 69, () => toast('chat', 'You', '11:22 AM', 'Yes! That would be wonderful', '', 'chat c1')],
  'toast-chat2': [288, 68, () => toast('chat', 'Judge', '11:21 AM', 'Thank you for always being so positive!', '', 'chat c2')],
  // ---- the website's buttons over the tablet: the same chip, our labels (SPEC: "same chip style, our labels")
  'nav-projects': [170, 60, () => bigChip(AV('A', 'var(--a1)', 30), 'Projects', EM.star(28))],
  'nav-films': [140, 60, () => bigChip(AV('A', 'var(--a1)', 30), 'Films', EM.fireheart(28))],
  'nav-how': [190, 60, () => bigChip(AV('A', 'var(--a1)', 30), 'How I work', EM.rainbow(28))],
  'nav-results': [160, 60, () => bigChip(AV('A', 'var(--a1)', 30), 'Results', EM.hundred(28))],
  'nav-ai': [160, 60, () => bigChip(AV('A', 'var(--a1)', 30), 'AI Arjun', EM.sparkle(28))],
  // ---- P3: the words on the fanned sheets (portrait page 600x800; the sheet's colour and texture are 3D) ----
  'sheet-ideas': [600, 800, () => sheet('Ideas for the next build', ['Ideas'], [[null], [null], [null]])],
  'sheet-how': [600, 800, () => sheet('How I work', ['Step', 'What it is for'], D.steps.map((s) => [s.name, s.line]))],
  'sheet-results': [600, 800, () => sheet('Results so far', ['Where', 'Result'], D.record.filter((r) => r.id !== 'medium').map((r) => [r.title, r.tag]))],
  'sheet-followups': [600, 800, () => sheet('Follow-ups', ['Task', 'Assigned to'], [['Open the live sites', 'You'], ['Watch the films', 'You'], ['Ask AI Arjun', 'You'], ['Email Arjun', 'You']])],
  // the ring (frames 567-624) carries small white cards on its sheets: the steps table, the status menu, a pink note
  table: [1002, 480, () => { const box = document.createElement('div'); buildDoc(box); const t = box.querySelector('.table'); t.style.cssText += ';left:20px;top:16px;background:#fff'; return t.outerHTML }],
  sticky: [200, 200, () => `<div class="psticky">Wow!<br>Love this</div>`],
  // ---- P4 tilt: the page and the card as flat layers -----------------------------------------------
  doc: [1042, 0, null],
  card: [1002, 560, () => `<div class="abs rcard" style="left:20px;top:16px;width:962px;height:520px">${resultsCardHTML()}</div>`],
  'card-head': [1002, 190, () => `<div class="abs rcard cut" style="left:20px;top:16px;width:962px;height:152px">${resultsCardHTML()}</div>`],
  'card-left': [488, 400, () => `<div class="abs only-l" style="left:20px;top:16px;width:448px;height:340px">${resultsCardHTML()}</div>`],
  'card-right': [488, 400, () => `<div class="abs only-r" style="left:20px;top:16px;width:448px;height:340px">${resultsCardHTML()}</div>`],
  // the status menu that lifts off the table (generic status words, as the reference)
  menu: [300, 330, () => `<div class="pmenu">${[['Not started', '#c8c7cf', 0], ['In progress', '#8fa2ff', 0], ['Review time', '#78c0cc', 1], ['Done', '#5fbf7f', 0]].map(([l, c, on]) => `<div class="pm${on ? ' on' : ''}"><s></s><u style="--f:${c}"></u>${l}</div>`).join('')}<div class="pm add">${I('plus', 15)}Create label</div></div>`],
  'cursor-arjun': [200, 90, () => `<div class="cursor c1" style="transform:translate(30px,30px)">${ARROW('var(--c1)')}<span class="tag"><b>Arjun</b></span></div>`],
  'cursor-you': [200, 90, () => `<div class="cursor c2" style="transform:translate(30px,30px)">${ARROW('var(--c2)')}<span class="tag"><b>You</b></span></div>`],
  'cursor-judge': [240, 90, () => `<div class="cursor c3" style="transform:translate(30px,30px)">${ARROW('var(--c3)')}<span class="tag"><b>Judge</b><span class="bars">${[0.45, 1, 0.66, 0.24, 0.5].map((k) => `<i style="transform:scaleY(${k})"></i>`).join('')}</span></span></div>`],
  'cursor-visitor': [220, 90, () => `<div class="cursor c4" style="transform:translate(30px,30px)">${ARROW('var(--c4)')}<span class="tag"><b>Visitor</b></span></div>`],
  'bubble-y': [130, 130, () => `<div class="bubble" style="transform:translate(65px,65px)"><span class="face" style="--r:var(--c5);--f:var(--a5)"><i>Y</i></span></div>`],
  'bubble-j': [130, 130, () => `<div class="bubble" style="transform:translate(65px,65px)"><span class="face" style="--r:var(--c6);--f:var(--a6)"><i>J</i></span></div>`],
}

view('parts', {
  size() { const p = PARTS[PID]; return PID === 'index' ? [1920, 1500] : PID === 'doc' ? [1042, 3300] : [p[0], p[1]] },
  dur: 1, rest: 0,
  build(st) {
    st.classList.add('parts')
    if (PID === 'doc') {
      // the whole page from the three cards down, 40 px of margin, for the glass sheet in the tilt
      const col = A(st, '', '', 40, 0); const R = buildDoc(col); setSupport(R, 1, 9, 1)
      R.el.style.transform = `translateY(${-DOC.OY + 150}px)`
      st.style.height = (DOC.H - DOC.OY + 150) + 'px'; window.__size = [1042, DOC.H - DOC.OY + 150]
    } else if (PID === 'index') {
      st.classList.add('pindex')
      Object.keys(PARTS).filter((k) => k !== 'doc').forEach((k) => { const p = PARTS[k]; const c = h('div', 'pcell', st, `<div class="pbox" style="width:${p[0]}px;height:${p[1]}px;zoom:${Math.min(1, 300 / p[0], 220 / p[1])}">${p[2]()}</div><label>${k}</label>`); void c })
    } else st.innerHTML = PARTS[PID][2]()
    return () => {}
  },
})
