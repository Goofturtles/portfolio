'use strict'
// P4: the app window over the soft blobs (loop.mp4 frames 671 to 790, 27.958 s to 32.96 s; 791 is the next shot).
// Everything that moves is driven by tables read off the reference, in reference frame numbers:
//   671-686  the window scales up about its centre (0.875 -> 1) out of a blur, while the page scrolls 100 px
//   684-699  hold. "I support" types itself into the last chip row (683-697)
//   700-721  scroll 751 px to the image grid (peak 101 px a frame at 709)
//   722-732  hold on the grid
//   733-790  the camera tilts into the card: a 3D move that belongs to the Blender shot. This page keeps the
//            flat window going (scroll continues to the Results card) so the same frames can be mapped on the plane.
// ?layer=window | overlay   one layer only (the cursors and bubbles float in front of the glass in 3D)
const P4 = { F0: 671, F1: 790, WIN: { x: 193, y: 55, w: 1535, h: 963 }, TOP: 113 /* title bar 48 + toolbar 64 + rule */ }

const P4_SCALE = [[671, 0.875], [672, 0.946], [673, 0.973], [674, 0.984], [675, 0.989], [676, 0.992], [677, 0.9935], [678, 0.9947], [679, 0.996], [680, 0.998], [683, 0.9987], [686, 1]]
const P4_BLUR = [[671, 5], [672, 1.2], [673, 0.3], [674, 0]]
const P4_FADE = [[671, 0.72], [672, 0.97], [673, 1]]
// scroll in px, 0 = the settled frame 692. Entry and the first scroll are measured frame by frame (row-profile
// correlation, checked against the "Concepts" heading: 751 px). From 733 the reference is in perspective, so the
// last run is an estimate that lands the Results card in the middle of the window.
const P4_SCROLL = [[671, -106], [672, -74], [673, -48], [674, -34], [675, -24], [676, -17], [677, -12], [678, -8], [679, -5], [680, -3], [681, -2], [682, -1], [683, 0],
  [699, 0], [700, 2], [701, 7], [702, 16], [703, 31], [704, 53], [705, 84], [706, 128], [707, 190], [708, 274], [709, 375], [710, 471], [711, 547], [712, 603], [713, 646], [714, 678], [715, 702], [716, 719], [717, 732], [718, 741], [719, 747], [720, 750], [721, 751],
  [732, 751], [733, 753], [734, 761], [735, 779], [736, 809], [737, 856], [738, 926], [739, 1021], [740, 1141], [741, 1281], [742, 1431], [743, 1581], [744, 1711], [745, 1816], [746, 1896], [747, 1951], [748, 1986], [749, 2006], [750, 2015], [751, 2019]]

// name cursors: [frame, x, y] of the arrow's centre on the 1920x1080 frame (colour-tracked; see tools/track_cursors.py)
const CUR = {
  c1: { name: 'Arjun', keys: [[671, 581, 463], [672, 542, 457], [673, 531, 455], [674, 531, 453], [675, 534, 453], [676, 542, 452], [677, 552, 452], [678, 565, 451], [679, 583, 451], [680, 603, 450], [681, 624, 451], [682, 643, 451], [683, 658, 451], [684, 670, 451], [685, 679, 451], [686, 685, 452], [687, 690, 452], [688, 692, 452], [689, 694, 452], [708, 694, 452], [709, 693, 450], [710, 693, 446], [711, 693, 439], [712, 691, 431], [713, 690, 420], [714, 690, 406], [715, 690, 390], [716, 690, 370], [717, 690, 349], [718, 690, 328], [719, 690, 307], [720, 692, 289], [721, 692, 273], [722, 692, 260], [723, 692, 250], [724, 693, 243], [725, 693, 238], [726, 694, 235], [727, 694, 234], [732, 693, 233], [733, 692, 233], [734, 691, 232], [735, 690, 231], [736, 690, 224], [737, 686, 221], [738, 681, 216], [739, 671, 211]] },
  c2: { name: 'You', keys: [[671, 366, 750], [672, 303, 767], [673, 275, 772], [674, 250, 775], [675, 231, 776], [676, 213, 777], [677, 198, 777], [678, 187, 777], [679, 179, 777], [680, 169, 779], [681, 155, 784], [682, 138, 793], [683, 125, 803], [684, 117, 813], [685, 114, 821], [686, 117, 828], [687, 125, 832], [688, 135, 832], [689, 142, 832], [690, 148, 832], [691, 153, 832], [692, 157, 832], [693, 159, 832], [694, 163, 831], [695, 165, 831], [697, 169, 828], [701, 175, 821], [702, 178, 817], [703, 181, 814], [704, 184, 809], [705, 186, 804], [706, 186, 800], [707, 187, 794], [708, 187, 788], [709, 187, 780], [710, 186, 771], [711, 185, 760], [712, 183, 747], [713, 182, 730], [714, 181, 708], [715, 181, 678], [716, 181, 630], [717, 181, 581], [718, 179, 537], [719, 177, 511], [720, 176, 495], [721, 176, 485], [722, 176, 479], [723, 177, 475], [724, 177, 474], [725, 178, 473], [726, 178, 474], [727, 178, 477], [728, 179, 480], [729, 182, 485], [730, 186, 491], [731, 191, 499], [732, 199, 507], [733, 208, 516], [734, 220, 527], [735, 234, 538], [736, 251, 550], [737, 269, 565], [738, 290, 582], [739, 315, 606]] },
  c3: { name: 'Judge', bars: true, keys: [[671, 847, 936], [672, 818, 955], [673, 799, 952], [674, 784, 943], [675, 772, 932], [676, 762, 920], [677, 753, 910], [678, 746, 904], [679, 745, 898], [680, 747, 895], [681, 745, 897], [683, 738, 904], [685, 730, 911], [688, 725, 921], [690, 722, 928], [692, 719, 934], [694, 717, 938], [696, 716, 941], [698, 716, 943], [700, 715, 944], [720, 716, 944], [721, 718, 944], [722, 722, 944], [723, 727, 944], [724, 734, 944], [725, 741, 943], [726, 751, 943], [727, 762, 943], [728, 774, 943], [729, 787, 943], [730, 800, 944], [731, 814, 944], [732, 826, 944], [733, 838, 945], [734, 849, 947], [735, 857, 948], [736, 864, 952], [737, 869, 956], [738, 871, 964], [739, 874, 976]] },
  // the fourth cursor comes in from the left at 715 (read off a strip, not tracked: +-8 px)
  c4: { name: 'Visitor', from: 714, keys: [[714, 60, 884], [715, 80, 884], [716, 96, 884], [717, 104, 883], [718, 118, 882], [719, 138, 883], [720, 158, 884], [721, 176, 885], [722, 190, 886], [723, 202, 886], [724, 210, 886], [725, 217, 886], [726, 222, 886], [727, 226, 886], [728, 228, 886], [730, 231, 885], [732, 228, 880], [733, 225, 875], [734, 221, 868], [735, 217, 860], [736, 214, 852], [737, 208, 843], [738, 200, 836], [739, 185, 838]] },
}
// presence bubbles: [frame, x, y] of the circle's centre; its arrow rides up and to the left of it
const BUB = {
  b1: { initial: 'Y', ring: 'var(--c5)', fill: 'var(--a5)', rot: 8, keys: [[671, 1473, 667], [672, 1575, 620], [675, 1675, 501], [678, 1712, 461], [681, 1727, 446], [684, 1732, 444], [687, 1732, 444], [690, 1732, 446], [693, 1730, 447], [696, 1728, 449], [699, 1725, 451], [702, 1720, 456], [705, 1700, 475], [708, 1690, 510], [711, 1692, 555], [714, 1704, 575], [717, 1720, 577], [720, 1735, 571], [723, 1741, 565], [726, 1740, 566], [729, 1733, 570], [732, 1735, 572], [735, 1749, 577], [738, 1780, 621]],
    arrow: (b) => [b[0] - 40, b[1] - 58] },
  b2: { initial: 'J', ring: 'var(--c6)', fill: 'var(--a6)', rot: -62, from: 687, keys: [[687, 1008, 1124], [688, 1010, 1100], [689, 1013, 1078], [690, 1018, 1053], [691, 1020, 1038], [692, 1021, 1023], [693, 1021, 993], [694, 1017, 962], [695, 1013, 931], [696, 1008, 902], [697, 999, 875], [698, 987, 850], [699, 975, 819], [700, 965, 793], [701, 954, 770], [702, 948, 746], [703, 945, 724], [704, 940, 704], [705, 940, 684], [708, 941, 650], [712, 942, 622], [714, 945, 600], [716, 939, 598], [717, 934, 587], [718, 925, 565], [719, 913, 535], [720, 903, 502], [721, 896, 477], [722, 892, 461], [723, 888, 452], [724, 886, 446], [725, 885, 442], [726, 886, 440], [731, 887, 440], [732, 888, 442], [733, 888, 444], [734, 891, 446], [735, 891, 452], [737, 897, 466], [738, 903, 477]],
    arrowKeys: [[687, 996, 1100], [688, 998, 1071], [689, 1000, 1042], [690, 1005, 1012], [691, 1008, 983], [692, 1009, 952], [693, 1008, 923], [694, 1006, 892], [695, 1000, 862], [696, 992, 832], [697, 985, 802], [698, 975, 773], [699, 957, 750], [700, 944, 723], [701, 932, 699], [702, 921, 675], [703, 913, 652], [704, 908, 631], [705, 904, 612], [708, 899, 585], [712, 897, 570], [716, 893, 548], [720, 862, 440], [724, 848, 386], [728, 848, 380], [732, 850, 382], [735, 853, 392], [738, 865, 417]] },
}
const ARROW = (colour) => `<svg class="arrow" width="40" height="42" viewBox="-20 -21 40 42"><path d="M-9.5,-13 L16.500,0.800 L-6,14.800 Z" fill="${colour}" stroke="${colour}" stroke-width="5" stroke-linejoin="round"/></svg>`

view('window', {
  w: 1920, h: 1080, f0: P4.F0, dur: (P4.F1 - P4.F0 + 1) / FPS, rest: (692 - P4.F0) / FPS,
  build(st) {
    const layer = QS.get('layer') || 'all'
    if (BG) h('div', 'backdrop', st, '<i class="b1"></i><i class="b2"></i><i class="b3"></i><i class="b4"></i>')
    const W = P4.WIN
    const win = A(st, 'win glass', '', W.x, W.y, W.w, W.h)
    // title bar: the app's icon (his initial on the accent tile) + the name. Reference: the Loop mark and "Microsoft Loop"
    h('div', 'tbar', win, `${PIX('app', 16)}<b>${esc(D.profile.name)}</b><span class="wb">${I('min', 11, '', 'Minimise', 'br')}${I('max', 11, '', 'Maximise', 'br')}${I('close', 12, '', 'Close', 'br')}</span>`)
    // toolbar: page emoji + page title, the Live pill, the avatar stack, comments
    const tool = h('div', 'tool', win, `<span class="pg">${EM.hearts(26)}<b>Portfolio</b>${I('chev', 15)}</span><span class="live">Live</span>` +
      `<span class="stack"></span><span class="more">+2</span><span class="cm">${I('comment', 25, '', 'Comments', 'br')}</span>`)
    // six avatars, right to left: the last four are there from the start, the fifth and sixth pop in (708, 716)
    const stack = tool.querySelector('.stack')
    const STACK = [['S', 'var(--a5)', 'var(--r6)', 1432.5], ['N', 'var(--a3)', 'var(--r5)', 1403], ['U', 'var(--a2)', 'var(--r4)', 1374], ['J', 'var(--a1)', 'var(--r3)', 1344.5], ['R', 'var(--a6)', 'var(--r2)', 1315], ['A', 'var(--a4)', 'var(--r1)', 1285.5]]
    const avs = STACK.map(([i, f, r, x]) => { const e = h('span', 'sav', stack, AV(i, f, 31, r)); e.style.left = (x - 15.5) + 'px'; return e })
    const content = A(win, 'content', '', 0, P4.TOP, W.w, W.h - P4.TOP)
    const col = A(content, 'col', '', 294, 0)
    const R = buildDoc(col)
    const bar = A(win, 'sbar', '<i></i>', 1479, 160, 9, 760), thumb = bar.firstChild

    // overlay: cursors and presence bubbles, in frame coordinates
    const ov = h('div', 'overlay', st)
    const cur = {}
    for (const k in CUR) {
      const c = CUR[k]
      const e = h('div', 'cursor ' + k, ov, ARROW(`var(--${k})`) + `<span class="tag"><b>${c.name}</b>${c.bars ? '<span class="bars"><i></i><i></i><i></i><i></i><i></i></span>' : ''}</span>`)
      cur[k] = { e, tag: e.querySelector('.tag'), bars: [...e.querySelectorAll('.bars i')] }
    }
    const bub = {}
    for (const k in BUB) {
      const b = BUB[k]
      const e = h('div', 'bubble ' + k, ov, `<span class="face" style="--r:${b.ring};--f:${b.fill}"><i>${b.initial}</i></span>`)
      const a = h('div', 'barrow', ov, ARROW(b.ring))
      bub[k] = { e, a }
    }
    if (layer === 'window') ov.style.display = 'none'
    if (layer === 'overlay') win.style.visibility = 'hidden'

    return (t) => {
      const f = P4.F0 + t * FPS
      // the window
      const sc = lerpKeys(f, P4_SCALE), blur = lerpKeys(f, P4_BLUR), fade = lerpKeys(f, P4_FADE)
      win.style.transform = sc === 1 ? '' : `scale(${sc})`
      win.style.filter = blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : ''
      win.style.opacity = fade
      ov.style.filter = blur > 0.05 ? `blur(${(blur * 0.8).toFixed(2)}px)` : ''
      ov.style.opacity = fade
      // the page
      const s = lerpKeys(f, P4_SCROLL)
      R.el.style.transform = `translateY(${(-DOC.OY - s).toFixed(2)}px)`
      thumb.style.transform = `translateY(${clamp(115 + 0.213 * s, 0, 706).toFixed(1)}px)`
      // "I support": the chip pops at 683, types a letter a frame from 687, the emoji lands at 694-697
      setSupport(R, clamp((f - 682.5) / 3.5), Math.round(clamp(f - 684, 0, 9)), clamp((f - 693.5) / 3))
      // avatar stack
      avs.forEach((e, i) => { const k = i < 4 ? 1 : clamp((f - (i === 4 ? 707 : 715)) / 4); e.style.opacity = clamp(k * 1.6); e.style.transform = `scale(${mix(0.5, 1, E.back(k))})` })
      // cursors: the tag swings behind the arrow (reference: about 0.65 deg per px/frame sideways, -0.9 deg vertically)
      for (const k in CUR) {
        const c = CUR[k], o = cur[k]
        const p = track(f, c.keys), p0 = track(f - 1, c.keys), p1 = track(f + 1, c.keys)
        const vx = (p1[0] - p0[0]) / 2, vy = (p1[1] - p0[1]) / 2
        o.e.style.transform = `translate(${p[0].toFixed(2)}px,${p[1].toFixed(2)}px)`
        o.tag.style.transform = `rotate(${(clamp(0.65 * vx - 0.9 * vy, -14, 14) * clamp((Math.hypot(vx, vy) - 2.5) / 5)).toFixed(2)}deg)`
        o.e.style.opacity = c.from ? clamp((f - c.from) / 3) : 1
        o.bars.forEach((b, i) => { b.style.transform = `scaleY(${([0.45, 1, 0.66, 0.24, 0.5][i] * (0.75 + 0.25 * Math.sin(f * 0.9 + i * 1.7))).toFixed(3)})` })   // speaking
      }
      for (const k in BUB) {
        const b = BUB[k], o = bub[k]
        const p = track(f, b.keys), a = b.arrowKeys ? track(f, b.arrowKeys) : b.arrow(p)
        const on = b.from ? (f >= b.from ? 1 : 0) : 1
        o.e.style.transform = `translate(${p[0].toFixed(2)}px,${p[1].toFixed(2)}px)`; o.e.style.opacity = on
        o.a.style.transform = `translate(${a[0].toFixed(2)}px,${a[1].toFixed(2)}px) rotate(${b.rot}deg)`; o.a.style.opacity = on
      }
    }
  },
})
