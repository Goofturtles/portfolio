// Loads film/ui's scripts (copied to apps/ by tools/sync_ui.py) in the order apps/files.json gives.
// They are classic scripts that share globals (DATA, PIX, VIEWS, buildDoc, taskbar, AIARJUN ...); the site's modules
// use those names directly once the stage they belong to has loaded.
//   kit()  DATA and kit.js: enough for the room's chips. Nothing else is fetched for the first screen.
//   all()  the rest: the lookup, the document, the windows, the browser.
// kit.js would draw one film view into #stage when the page finishes parsing. It is loaded after that moment,
// so it never does (main.js waits for DOMContentLoaded before calling kit()).
import { retry } from './config.js'
import { install } from './icons.js'

const FIRST = ['gen/data.js', 'kit.js']
let files, kitReady, allReady

const script = (src) => retry(() => new Promise((ok, fail) => {
  const s = document.createElement('script')
  s.src = 'apps/' + src; s.onload = ok; s.onerror = () => { s.remove(); fail(new Error('could not load ' + src)) }
  document.head.appendChild(s)
}))
async function run(list) { for (const src of list) await script(src) }

// the pictures in DATA are written relative to film/ui/; here they live under apps/
function prefix(D) {
  const fix = (s) => (typeof s === 'string' && s.startsWith('img/') ? 'apps/' + s : s)
  for (const k in D.stills) D.stills[k] = fix(D.stills[k])
  for (const k in D.emoji) D.emoji[k] = fix(D.emoji[k])
  for (const p of D.projects) p.visual = fix(p.visual)
  // A result his data files do not carry yet. Arjun, 2026-10-12: Second Opinion won 1st place at the CSC Back-to-School
  // Hackathon (the project and its film are already in DATA). Added here, after the 1st place it sits beside, until
  // TrackRecordRow.jsx has it; then the data has it and this adds nothing.
  if (!D.record.some((r) => r.id === 'csc' || r.projectId === 'second-opinion')) {
    D.record.splice(1, 0, { id: 'csc', title: 'CSC Back-to-School', tag: '1st place', summary: '1st place, CSC Back-to-School Hackathon', award: 'CSC Back-to-School Hackathon',
      cta: 'Watch the video', href: 'https://www.youtube.com/watch?v=TGgBjHqTN44', projectId: 'second-opinion', project: 'Second Opinion', pic: 'peddiehacks' })      // pic: the first-place medal
  }
}

export const apps = {
  kit() {
    kitReady ||= (async () => {
      files = await retry(async () => { const r = await fetch('apps/files.json'); if (!r.ok) throw new Error('apps/files.json ' + r.status); return r.json() })
      await run(files.scripts.filter((s) => FIRST.includes(s)))
      prefix(window.DATA)
      install()                                              // from here on every picture and glyph is the site's one family (js/icons.js)
      // each still's [width, height], by the path the page uses: a picture holds its place before it has loaded
      window.PICTURE_SIZES = Object.fromEntries(Object.entries(files.pictures || {}).map(([k, v]) => ['apps/' + k, v]))
    })()
    return kitReady
  },
  all() {
    allReady ||= (async () => {
      await apps.kit()
      for (const href of files.styles) {
        if (document.querySelector(`link[href="apps/${href}"]`)) continue
        const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'apps/' + href
        document.querySelector('link[href="css/site.css"]').before(l)       // before site.css, which has the last word
      }
      await run(files.scripts.filter((s) => !FIRST.includes(s)))
    })()
    return allReady
  },
}
