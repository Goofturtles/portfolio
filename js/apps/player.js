// Films: Microsoft's Media Player (film/SPEC.md "Films is Microsoft's real player"). References, with measurements in
// film/ref/ui/board/INDEX.md "player": board/player/01-media-player-library.jpg (navigation pane, library page, the
// transport under it), 02-media-player-video-now-playing.jpg (the picture edge to edge on black, the seek row with
// the two times, the control panel in three blocks, the accent on play / pause only).
// The library's tiles have no picture of their own in the board (INDEX item 8): they follow the Media Player's video
// grid (a 16:9 thumbnail with 4 px corners, the name in Body Strong, a grey second line).
// Anatomy: navigation pane (search, Video library, Now playing); the library of his launch films as thumbnails (a
// film's own still; one with no still gets a plain dark tile, never a drawn poster); the now-playing view; and one
// transport: the seek bar with the elapsed and total time, the film's thumbnail and title at the left, previous /
// play-pause / next in the middle, volume, full screen and More at the right ("Open on YouTube" lives under More).
// The films are the video links in his notes, through the lookup, so AERIS never appears. Nothing is fetched from
// outside until Play is pressed. Then a YouTube film plays in YouTube's own player (the privacy-enhanced address, its
// own controls hidden) and this bar drives it with the player's documented messages; a film file plays in a <video>.
import { el, reduced } from '../config.js'
import { line } from '../icons.js'
import { esc, film, poster, menu } from './common.js'

const YT = 'https://www.youtube-nocookie.com'
const clock = (s) => (isFinite(s) && s >= 0 ? Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0') : '0:00')

export function mount(box, ctx) {
  const films = window.DATA.projects.map((p) => ({ p, l: film(p) })).filter((f) => f.l).map(({ p, l }) => ({ p, href: l.href, yt: (l.href.match(/[?&]v=([\w-]{11})/) || [])[1] || null }))
  const root = box.appendChild(el('div', 'pl'))
  const btn = (act, icon, name, cls = '') => `<button type="button" data-do="${act}"${cls ? ` class="${cls}"` : ''} aria-label="${name}" title="${name}">${line(icon, 24)}</button>`
  root.innerHTML = `<nav class="pl-nav" aria-label="Media player"><label class="pl-find">${line('search16', 16)}<input type="search" autocomplete="off" spellcheck="false" placeholder="Search" aria-label="Search the library"></label>` +
    `<button type="button" data-do="lib" aria-current="page">${line('mLib', 20)}<span>Video library</span></button><button type="button" data-do="now">${line('present', 20)}<span>Now playing</span></button></nav>` +
    `<div class="pl-main"><section class="pl-lib" aria-label="Video library"><h3>Video library</h3><p class="pl-sub">${films.length} launch films</p>` +
    `<div class="pl-list" role="list">${films.map((f, i) => `<button type="button" role="listitem" data-i="${i}" style="--i:${i}"><span class="pl-pic">${poster(f.p, '', true)}</span>` +
      `<span><b>${esc(f.p.title)}</b><em>${esc(f.p.meta.split(' · ')[0])}</em></span></button>`).join('')}</div></section>` +
    `<section class="pl-now" aria-label="Now playing" hidden><div class="pl-stage"><div class="pl-poster"></div><div class="pl-screen"></div><p class="pl-note" role="status"></p></div></section></div>` +
    `<footer class="pl-bar"><div class="pl-seekrow"><span class="pl-t">0:00</span><input class="pl-seek" type="range" min="0" max="1000" value="0" step="1" aria-label="Seek"><span class="pl-d">0:00</span></div>` +
    `<div class="pl-ctl"><div class="pl-info"><span class="pl-th"></span><span><h3></h3><p></p></span></div>` +
    `<div class="pl-mid">${btn('prev', 'mPrev', 'Previous film')}${btn('play', 'mPlay', 'Play', 'pl-pp')}${btn('next', 'mNext', 'Next film')}</div>` +
    `<div class="pl-end">${btn('mute', 'mVol', 'Mute')}<input class="pl-vol" type="range" min="0" max="100" value="80" step="1" aria-label="Volume">${btn('full', 'mFull', 'Full screen')}${btn('more', 'mMore', 'More')}</div></div></footer>`
  const $ = (s) => root.querySelector(s), screen = $('.pl-screen'), seek = $('.pl-seek'), vol = $('.pl-vol'), note = $('.pl-note')
  let i = 0, on = null, frame = null, video = null, t = 0, dur = 0, playing = false, muted = false, dragging = false, heard = false, timer = 0

  const say = (func, args = []) => frame && frame.contentWindow.postMessage(JSON.stringify({ event: 'command', func, args }), YT)
  function view(name) {
    $('.pl-lib').hidden = name !== 'lib'; $('.pl-now').hidden = name !== 'now'
    for (const b of root.querySelectorAll('.pl-nav button')) b.toggleAttribute('aria-current', b.dataset.do === name)
  }
  function paint() {
    root.classList.toggle('playing', playing); root.classList.toggle('loaded', !!on)
    const pp = $('.pl-pp'); pp.innerHTML = line(playing ? 'mPause' : 'mPlay', 24); pp.setAttribute('aria-label', playing ? 'Pause' : 'Play'); pp.title = playing ? 'Pause' : 'Play'
    const m = $('[data-do="mute"]'); m.innerHTML = line(muted ? 'mMute' : 'mVol', 24); m.setAttribute('aria-label', muted ? 'Unmute' : 'Mute')
    $('.pl-t').textContent = clock(t); $('.pl-d').textContent = clock(dur)
    if (!dragging) seek.value = dur ? Math.round(t / dur * 1000) : 0
    seek.style.setProperty('--p', (dur ? t / dur * 100 : 0) + '%'); vol.style.setProperty('--p', (muted ? 0 : vol.value) + '%')
    seek.disabled = !dur
  }
  // the film in the bar and on the stage: its still on black and its name. Nothing plays, and nothing is fetched, until Play.
  function pick(n) {
    stop()
    i = (n + films.length) % films.length
    const f = films[i]
    $('.pl-poster').innerHTML = poster(f.p, '', true); $('.pl-th').innerHTML = poster(f.p, '', true)
    $('.pl-info h3').textContent = f.p.title; $('.pl-info p').textContent = f.p.meta
    for (const b of root.querySelectorAll('.pl-list button')) b.toggleAttribute('aria-current', +b.dataset.i === i)
    paint()
  }
  function stop() {
    clearTimeout(timer)
    screen.innerHTML = ''; frame = video = on = null
    t = dur = 0; playing = heard = false; note.textContent = ''
    paint()
  }
  function start() {
    const f = films[i]
    on = f; note.textContent = 'Loading the film…'
    view('now')
    if (f.yt) {
      frame = screen.appendChild(el('iframe'))
      frame.title = f.p.title + ': launch film'; frame.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen'
      frame.src = `${YT}/embed/${f.yt}?autoplay=1&playsinline=1&rel=0&controls=0&enablejsapi=1&origin=${encodeURIComponent(location.origin)}`
      let tries = 0
      const hello = () => { if (!frame || heard || ++tries > 24) return; frame.contentWindow.postMessage(JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }), YT); timer = setTimeout(hello, 250) }
      frame.addEventListener('load', hello)
      setTimeout(() => { if (on === f && !heard) note.textContent = 'YouTube did not answer here. Use More, then "Open on YouTube".' }, 8000)
    } else {
      video = screen.appendChild(el('video'))
      video.playsInline = true; video.src = f.href; video.volume = vol.value / 100; video.muted = muted
      const read = () => { t = video.currentTime; dur = video.duration || 0; playing = !video.paused && !video.ended; if (dur) note.textContent = ''; paint() }
      for (const ev of ['timeupdate', 'durationchange', 'play', 'pause', 'playing']) video.addEventListener(ev, read)
      video.addEventListener('ended', () => next(true))
      video.addEventListener('error', () => { if (on === f) note.textContent = 'The film file did not load. Use More, then "Open the film file".' })
      video.play().catch(() => {})
    }
    paint()
  }
  // YouTube's player reports its state in messages (currentTime, duration, playerState: 1 playing, 2 paused, 0 ended)
  function hear(e) {
    if (!root.isConnected) return removeEventListener('message', hear)
    if (e.origin !== YT || !frame || e.source !== frame.contentWindow) return
    let d; try { d = JSON.parse(e.data) } catch (err) { return }
    if (!heard) { heard = true; note.textContent = ''; say('setVolume', [+vol.value]); if (muted) say('mute') }
    const n = d.info; if (!n || typeof n !== 'object') return
    if (typeof n.currentTime === 'number') t = n.currentTime
    if (typeof n.duration === 'number' && n.duration) dur = n.duration
    if (typeof n.playerState === 'number') { playing = n.playerState === 1 || n.playerState === 3; if (n.playerState === 0) return next(true) }
    paint()
  }
  addEventListener('message', hear)

  function toggle() {
    if (!on) return start()
    if (video) video.paused ? video.play().catch(() => {}) : video.pause()
    else { say(playing ? 'pauseVideo' : 'playVideo'); playing = !playing; paint() }
  }
  function next(auto) { pick(i + 1); if (auto && i !== 0) start() }       // a film that ends leads into the next one; the last one does not start the list over

  root.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return
    const d = b.dataset.do
    if (b.dataset.i) { pick(+b.dataset.i); start() }
    else if (d === 'lib' || d === 'now') view(d)
    else if (d === 'play') toggle()
    else if (d === 'prev' || d === 'next') { const was = on; pick(i + (d === 'next' ? 1 : -1)); if (was) start() }      // a film that was on leads straight into the other one
    else if (d === 'mute') { muted = !muted; if (video) video.muted = muted; else say(muted ? 'mute' : 'unMute'); paint() }
    else if (d === 'full') { if (document.fullscreenElement) document.exitFullscreen(); else if (root.requestFullscreen) { view('now'); root.requestFullscreen().catch(() => {}) } }
    else if (d === 'more') {
      const f = films[i]
      menu(root, b, [[f.yt ? 'Open on YouTube' : 'Open the film file', 'out'], ['Open the project\'s folder', 'folder']], (v) => (v === 'out' ? window.open(f.href, '_blank', 'noopener') : ctx.act('projects', f.p.id)))
    }
  })
  $('.pl-find input').addEventListener('input', (e) => { const q = e.target.value.trim().toLowerCase(); view('lib'); root.querySelectorAll('.pl-list button').forEach((b, n) => { b.hidden = !!q && !(films[n].p.title + ' ' + films[n].p.meta).toLowerCase().includes(q) }) })
  seek.addEventListener('input', () => { dragging = true; t = seek.value / 1000 * dur; paint() })
  seek.addEventListener('change', () => { dragging = false; if (video) video.currentTime = t; else say('seekTo', [t, true]) })
  vol.addEventListener('input', () => { muted = false; if (video) { video.volume = vol.value / 100; video.muted = false } else { say('unMute'); say('setVolume', [+vol.value]) } paint() })
  $('.pl-stage').addEventListener('click', toggle)
  const full = () => { if (!root.isConnected) return document.removeEventListener('fullscreenchange', full); const f = document.fullscreenElement === root; const b = $('[data-do="full"]'); b.innerHTML = line(f ? 'mSmall' : 'mFull', 24); b.setAttribute('aria-label', f ? 'Leave full screen' : 'Full screen'); b.title = f ? 'Leave full screen' : 'Full screen' }
  document.addEventListener('fullscreenchange', full)

  pick(0)
  if (!reduced()) root.classList.add('alive')
  return {
    title: 'Films',
    show(id) { const n = films.findIndex((f) => f.p.id === id); if (n >= 0) { if (n !== i) pick(n); view('now') } },
    stop: () => pick(i),
    focus() { ($('.pl-list button[aria-current]') || $('.pl-pp')).focus({ preventScroll: true }) },
  }
}
