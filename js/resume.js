// His résumé, in the page: opened by his photo on the room's wall (js/room3d/wall.js). What it shows is his résumé
// rebuilt as a real page (media/resume/resume.html, made from his PDF by site/tools/make_resume.py): crisp at any
// size, its text selectable, one column on a phone, and no PDF plug-in needed. It sits in a window of the site's glass
// over the room, which stays behind it dimmed and softly blurred (css/wall.css). Nothing downloads by itself: Download
// asks first ("Download Arjun's résumé? PDF, 788 KB") and only its own Download fetches the original PDF.
// Escape and a click outside close it (the prompt first, then the window); the keyboard stays inside while it is open
// and goes back where it was after.
const PAGE = 'media/resume/resume.html', PDF = 'media/resume.pdf', FILE = 'Arjun Sharma - Résumé.pdf'
const ICON = {
  down: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2v8.3M4.6 7 8 10.4 11.4 7M3 13.5h10" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  close: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 3.5l9 9M12.5 3.5l-9 9" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/></svg>',
  pdf: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 2.75h8.2L19.25 7.8V21.25H6Z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M14 2.9V8h5.1" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>',
}
let shown = null

// the PDF's size, asked of the server without fetching the file (HEAD), shown as Windows shows a size
async function size() {
  try {
    const r = await fetch(PDF, { method: 'HEAD', cache: 'no-store' }), n = +r.headers.get('content-length')
    return r.ok && n > 0 ? (n < 1024 * 1024 ? Math.round(n / 1024) + ' KB' : (n / 1024 / 1024).toFixed(1) + ' MB') : ''
  } catch (e) { return '' }
}

export function openResume(opener) {
  if (shown) { shown.win.focus(); return shown }
  if (!document.querySelector('link[data-wall]')) document.head.append(Object.assign(document.createElement('link'), { rel: 'stylesheet', href: 'css/wall.css' }))
  const host = document.getElementById('app') || document.body
  const el = document.createElement('div')
  el.className = 'rv'
  el.innerHTML = `<div class="rv-back"></div>
<section class="rv-win" role="dialog" aria-modal="true" aria-labelledby="rv-title" tabindex="-1">
  <header class="rv-bar">
    <h2 class="rv-title" id="rv-title">Résumé</h2>
    <button type="button" class="rv-dl">${ICON.down}<span>Download</span></button>
    <button type="button" class="rv-x" aria-label="Close">${ICON.close}</button>
  </header>
  <iframe class="rv-doc" title="Arjun Sharma's résumé" src="${PAGE}"></iframe>
</section>`
  host.append(el)
  document.documentElement.dataset.resume = 'open'
  const win = el.querySelector('.rv-win'), x = el.querySelector('.rv-x'), dl = el.querySelector('.rv-dl'), doc = el.querySelector('.rv-doc')
  const back = opener && opener.isConnected ? opener : null
  let closing = false, ask = null

  // ---- the prompt before a download ----
  function prompt() {
    if (ask) return
    ask = document.createElement('div')
    ask.className = 'rv-ask'
    ask.innerHTML = `<div class="rv-ask-card" role="alertdialog" aria-modal="true" aria-labelledby="rv-ask-t" aria-describedby="rv-ask-d">
  <div class="rv-ask-top"><span class="rv-ask-ico">${ICON.pdf}</span><div><h3 id="rv-ask-t">Download Arjun's résumé?</h3><p id="rv-ask-d">PDF</p></div></div>
  <div class="rv-ask-go"><button type="button" class="rv-ask-yes">Download</button><button type="button" class="rv-ask-no">Cancel</button></div>
</div>`
    win.append(ask)
    size().then((s) => { if (ask && s) ask.querySelector('#rv-ask-d').textContent = 'PDF, ' + s })
    ask.querySelector('.rv-ask-yes').addEventListener('click', () => {
      const a = Object.assign(document.createElement('a'), { href: PDF, download: FILE })
      document.body.append(a); a.click(); a.remove()
      unprompt()
    })
    ask.querySelector('.rv-ask-no').addEventListener('click', unprompt)
    ask.addEventListener('click', (e) => { if (e.target === ask) unprompt() })
    ask.querySelector('.rv-ask-yes').focus({ preventScroll: true })
  }
  function unprompt() {
    if (!ask) return
    const a = ask
    ask = null
    a.classList.add('closing')
    setTimeout(() => a.remove(), 140)
    dl.focus({ preventScroll: true })
  }

  const close = () => {
    if (closing) return
    closing = true
    removeEventListener('keydown', key, true)
    el.classList.add('closing')
    delete document.documentElement.dataset.resume
    setTimeout(() => { el.remove(); if (shown && shown.el === el) shown = null }, 160)
    if (back) back.focus({ preventScroll: true })
  }
  function key(e) {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); ask ? unprompt() : close(); return }
    if (e.key !== 'Tab') return
    const stops = [...(ask || el).querySelectorAll('button, iframe')]
    const i = stops.indexOf(document.activeElement)
    if (e.shiftKey && i <= 0) { e.preventDefault(); stops[stops.length - 1].focus() } else if (!e.shiftKey && (i === stops.length - 1 || i < 0)) { e.preventDefault(); stops[0].focus() }
  }
  addEventListener('keydown', key, true)                         // before the site's own Escape (js/main.js), which would leave the place
  doc.addEventListener('load', () => { try { doc.contentWindow.addEventListener('keydown', (e) => { if (e.key === 'Escape') key(e) }) } catch (err) { /* another origin: its own keys stay its own */ } })
  x.addEventListener('click', close)
  dl.addEventListener('click', prompt)
  el.querySelector('.rv-back').addEventListener('click', close)
  x.focus({ preventScroll: true })
  shown = { el, win, close }
  return shown
}
